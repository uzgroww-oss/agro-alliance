import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY muhit o'zgaruvchilari .env faylida belgilanishi kerak.",
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
