-- ==============================================================================
-- FILE NOT FOUND: Supabase Database Schema & Storage Setup
-- ==============================================================================

-- 0. Enable pgvector Extension for Hybrid Semantic Search
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Create Documents Table (with AI Smart Title & Topic Tags)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    smart_title TEXT,
    tags TEXT[] DEFAULT '{}',
    file_size BIGINT NOT NULL,
    mime_type TEXT DEFAULT 'application/pdf',
    storage_path TEXT NOT NULL,
    page_count INTEGER DEFAULT 1,
    extracted_text TEXT NOT NULL,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist if table was created previously
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS smart_title TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 2. Create Document Chunks Table (with 768-d Gemini Vector Embeddings & Full-Text tsvector)
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    page_number INTEGER DEFAULT 1,
    content TEXT NOT NULL,
    tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED,
    embedding VECTOR(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure embedding column exists if table was created previously
ALTER TABLE public.document_chunks ADD COLUMN IF NOT EXISTS embedding VECTOR(768);

-- 3. Create Indexes for High Performance Hybrid Search
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_extracted_text_tsv ON public.documents USING gin(to_tsvector('english', coalesce(extracted_text, '')));

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON public.document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_tsv ON public.document_chunks USING gin(tsv);

-- HNSW Vector Index for Sub-Millisecond Cosine Similarity Search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for documents
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
CREATE POLICY "Users can view their own documents"
    ON public.documents FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents"
    ON public.documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents"
    ON public.documents FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents"
    ON public.documents FOR DELETE
    USING (auth.uid() = user_id);

-- 6. RLS Policies for document_chunks
DROP POLICY IF EXISTS "Users can view their own chunks" ON public.document_chunks;
CREATE POLICY "Users can view their own chunks"
    ON public.document_chunks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own chunks" ON public.document_chunks;
CREATE POLICY "Users can insert their own chunks"
    ON public.document_chunks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chunks" ON public.document_chunks;
CREATE POLICY "Users can delete their own chunks"
    ON public.document_chunks FOR DELETE
    USING (auth.uid() = user_id);

-- 7. Hybrid Search RPC Function (combining Cosine Distance & Full-Text Search tsvector)
CREATE OR REPLACE FUNCTION public.hybrid_match_document_chunks (
    query_embedding VECTOR(768),
    query_text TEXT,
    target_user_id UUID,
    match_count INT DEFAULT 15,
    semantic_weight FLOAT DEFAULT 0.6,
    keyword_weight FLOAT DEFAULT 0.4
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    user_id UUID,
    chunk_index INT,
    page_number INT,
    content TEXT,
    similarity FLOAT,
    rank_score FLOAT,
    combined_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.document_id,
        c.user_id,
        c.chunk_index,
        c.page_number,
        c.content,
        -- Cosine similarity: 1 - cosine distance
        CASE 
            WHEN c.embedding IS NOT NULL AND query_embedding IS NOT NULL 
            THEN (1 - (c.embedding <=> query_embedding))::float
            ELSE 0.0::float
        END AS similarity,
        -- Full-text keyword rank score
        COALESCE(ts_rank_cd(c.tsv, plainto_tsquery('english', query_text)), 0.0)::float AS rank_score,
        -- Weighted hybrid score
        (
            (semantic_weight * CASE 
                WHEN c.embedding IS NOT NULL AND query_embedding IS NOT NULL 
                THEN (1 - (c.embedding <=> query_embedding)) 
                ELSE 0.0 
             END) +
            (keyword_weight * COALESCE(ts_rank_cd(c.tsv, plainto_tsquery('english', query_text)), 0.0))
        )::float AS combined_score
    FROM public.document_chunks c
    WHERE c.user_id = target_user_id
      AND (
          (c.embedding IS NOT NULL AND query_embedding IS NOT NULL AND (1 - (c.embedding <=> query_embedding)) > 0.35)
          OR c.tsv @@ plainto_tsquery('english', query_text)
          OR c.content ILIKE '%' || query_text || '%'
      )
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

REVOKE ALL ON FUNCTION public.hybrid_match_document_chunks(VECTOR(768), TEXT, UUID, INT, FLOAT, FLOAT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hybrid_match_document_chunks(VECTOR(768), TEXT, UUID, INT, FLOAT, FLOAT) TO service_role;
