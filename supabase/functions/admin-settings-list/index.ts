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
    const { data, error } = await supabaseAdmin
      .from("public_settings")
      .select("id, key, value, type, description, is_public")
      .is("deleted_at", null)
      .order("key", { ascending: true })

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ settings: data || [] })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
