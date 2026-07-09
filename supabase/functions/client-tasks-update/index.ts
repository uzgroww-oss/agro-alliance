import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "company")
  if (auth.response) return auth.response

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return errorResponse("ID kerak", 400)

  try {
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id")
      .eq("client_profile_id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!partner) return errorResponse("Hamkor topilmadi", 404)

    const body = await req.json().catch(() => ({}))
    if (Object.keys(body).length === 0) return errorResponse("Hech qanday maydon kiritilmagan", 400)

    const updates: Record<string, unknown> = {}
    if (body.title) updates.title = body.title
    if (body.status) {
      if (!["pending", "progress", "done"].includes(body.status)) {
        return errorResponse("Notog'ri status", 400)
      }
      updates.status = body.status
    }

    if (Object.keys(updates).length === 0) return jsonResponse({ success: true })

    const { data: task, error } = await supabaseAdmin
      .from("partner_tasks")
      .update(updates)
      .eq("id", id)
      .eq("partner_id", partner.id)
      .select("id, title, status")
      .maybeSingle()

    if (error) return errorResponse(error.message, 500)
    if (!task) return errorResponse("Vazifa topilmadi", 404)

    return jsonResponse({ success: true, task })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
