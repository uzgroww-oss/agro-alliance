import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { getDynamicStats } from "../_shared/stats.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const { data, error } = await supabaseAdmin
      .from("homepage_stats")
      .select("key, value, label")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (error) return errorResponse(error.message, 500)

    const dynamicStats = await getDynamicStats()

    return jsonResponse({ stats: dynamicStats })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
