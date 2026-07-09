import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PUT" && req.method !== "PATCH") return errorResponse("Method not allowed", 405)

  const auth = await requireRole(req, "company")
  if (auth.response) return auth.response

  const body = await req.json().catch(() => ({}))
  if (Object.keys(body).length === 0) return errorResponse("Hech qanday maydon kiritilmagan", 400)

  try {
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id")
      .eq("client_profile_id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!partner) return errorResponse("Hamkor topilmadi", 404)

    const updates: Record<string, unknown> = {}
    if (body.name) updates.name = body.name
    if (body.sphere) updates.sphere = body.sphere
    if (body.contractNo) updates.contract_no = body.contractNo
    if (body.amount !== undefined) updates.contract_amount = body.amount

    if (Object.keys(updates).length === 0) return jsonResponse({ success: true })

    const { error } = await supabaseAdmin
      .from("partners")
      .update(updates)
      .eq("id", partner.id)

    if (error) return errorResponse(error.message, 500)
    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
