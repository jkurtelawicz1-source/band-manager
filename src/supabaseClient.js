import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wrmvfqgkpbivjcsnvdyl.supabase.co'
const supabaseAnonKey = 'sb_publishable_YyexzvZz4352DAHNQgS8gQ_LGGJaL_g'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})