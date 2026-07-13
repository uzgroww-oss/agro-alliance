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
      .from("roles")
      .select("id, name, description, is_system, priority, created_at, updated_at")
      .is("deleted_at", null)
      .order("priority", { ascending: false })

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ roles: data || [] })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
