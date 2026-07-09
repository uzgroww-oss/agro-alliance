import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const { data: categories, error } = await supabaseAdmin
      .from("categories")
      .select("id, key, label, type, icon, sort_order")
      .is("deleted_at", null)
      .order("type", { ascending: true })
      .order("sort_order", { ascending: true })

    if (error) throw error

    return jsonResponse({ categories: categories || [] })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
