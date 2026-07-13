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
      .from("permissions")
      .select("id, code, name, description, resource, action")
      .is("deleted_at", null)
      .order("resource", { ascending: true })
      .order("action", { ascending: true })

    if (error) return errorResponse(error.message, 500)

    // Group by resource
    const grouped: Record<string, typeof data> = {}
    for (const p of data || []) {
      if (!grouped[p.resource]) grouped[p.resource] = []
      grouped[p.resource].push(p)
    }

    return jsonResponse({ permissions: data, grouped })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
