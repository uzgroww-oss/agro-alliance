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
      .from("homepage_stats")
      .select("key, value, label")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ stats: data || [] })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
