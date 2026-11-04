import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wrmvfqgkpbivjcsnvdyl.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YyexzvZz4352DAHNQgS8gQ_LGGJaL_g'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)