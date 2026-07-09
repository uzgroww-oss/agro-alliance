import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { now } from "../_shared/time.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "DELETE") return errorResponse("Method not allowed", 405)

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

    const { data: task, error } = await supabaseAdmin
      .from("partner_tasks")
      .update({ deleted_at: now(), deleted_by: auth.user.id })
      .eq("id", id)
      .eq("partner_id", partner.id)
      .select("id")
      .maybeSingle()

    if (error) return errorResponse(error.message, 500)
    if (!task) return errorResponse("Vazifa topilmadi", 404)

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
