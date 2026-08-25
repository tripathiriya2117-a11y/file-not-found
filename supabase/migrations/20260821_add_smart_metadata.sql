-- ==============================================================================
-- MIGRATION: Add Smart Title and Tags to Documents Table
-- Run this in the Supabase SQL Editor:
-- ==============================================================================

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS smart_title TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
