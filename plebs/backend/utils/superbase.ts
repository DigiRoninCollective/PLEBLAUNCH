import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_KEY.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);