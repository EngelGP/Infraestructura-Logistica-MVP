import { createClient } from '@supabase/supabase-js';

const isDev = process.env.NODE_ENV === 'development';

const supabaseUrl = isDev 
  ? process.env.NEXT_PUBLIC_SUPABASE_URL_DEV 
  : process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey = isDev 
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV 
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);