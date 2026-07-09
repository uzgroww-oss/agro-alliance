import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "DELETE") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const tid = new URL(req.url).searchParams.get("tid")
    if (!tid) return errorResponse("tid kerak", 400)

    const now = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from("partner_tasks")
      .update({ deleted_at: now, deleted_by: auth.user.id })
      .eq("id", tid)
      .is("deleted_at", null)

    if (error) throw error

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
