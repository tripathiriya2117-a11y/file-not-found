-- Ensure the columns required by hybrid search document enrichment exist.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS smart_title TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
