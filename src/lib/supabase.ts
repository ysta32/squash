import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL
const key: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient<Database>(url, key, {
  auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
})
