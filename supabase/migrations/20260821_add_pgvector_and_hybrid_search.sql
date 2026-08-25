-- ==============================================================================
-- MIGRATION: Add pgvector and Hybrid Search Functionality
-- Run this in the Supabase SQL Editor:
-- ==============================================================================

-- 1. Enable pgvector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add 768-dimension Vector Column for Gemini Embeddings
ALTER TABLE public.document_chunks 
ADD COLUMN IF NOT EXISTS embedding VECTOR(768);

-- 3. Create HNSW Cosine Index for Sub-Millisecond Nearest Neighbor Search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- 4. Create Hybrid Search RPC Function (combining Cosine Distance & Full-Text Search tsvector)
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
