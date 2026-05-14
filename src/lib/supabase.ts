import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isPlaceholder = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder');
const isValidUrl = supabaseUrl?.startsWith('https://') && (supabaseUrl?.includes('.supabase.co') || supabaseUrl?.includes('.supabase.net'));

if (isPlaceholder) {
  console.warn('[Supabase] Missing or placeholder credentials.');
} else if (!isValidUrl) {
  console.error('[Supabase] INVALID URL DETECTED:', supabaseUrl, '. It must start with https:// and end with .supabase.co');
} else {
  // Silent init
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
