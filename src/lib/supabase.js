import { createClient } from '@supabase/supabase-js'

// These env vars must be set in .env.local
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// Without them, note sharing won't work but local notes will
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

export const isSupabaseEnabled = !!(supabaseUrl && supabaseKey)
