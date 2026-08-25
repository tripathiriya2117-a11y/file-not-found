import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are not set. Ensure .env is properly configured.');
}

// Admin client for backend operations (file storage upload/download, DB inserts)
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper to create a Supabase client on behalf of an authenticated user token
export function createUserSupabaseClient(accessToken) {
  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

export const STORAGE_BUCKET = process.env.SUPABASE_BUCKET_NAME || 'pdf-documents';
