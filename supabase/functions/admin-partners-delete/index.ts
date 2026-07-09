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
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return errorResponse("id kerak", 400)

    const now = new Date().toISOString()
    const userId = auth.user.id

    const { error: tasksError } = await supabaseAdmin
      .from("partner_tasks")
      .update({ deleted_at: now, deleted_by: userId })
      .eq("partner_id", id)
      .is("deleted_at", null)

    if (tasksError) throw tasksError

    const { error: partnerError } = await supabaseAdmin
      .from("partners")
      .update({ deleted_at: now, deleted_by: userId })
      .eq("id", id)
      .is("deleted_at", null)

    if (partnerError) throw partnerError

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
