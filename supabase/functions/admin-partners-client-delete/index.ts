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

  const auth = await requireRole(req, "super_admin", "admin")
  if (auth.response) return auth.response

  try {
    const pid = new URL(req.url).searchParams.get("pid")
    if (!pid) return errorResponse("pid kerak", 400)

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from("partners")
      .select("id, client_profile_id")
      .eq("id", pid)
      .is("deleted_at", null)
      .single()

    if (partnerError || !partner) return errorResponse("Partner topilmadi", 404)
    if (!partner.client_profile_id) return errorResponse("Client mavjud emas", 404)

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
      partner.client_profile_id,
    )
    if (deleteAuthError) throw deleteAuthError

    const { error: updateError } = await supabaseAdmin
      .from("partners")
      .update({ client_profile_id: null })
      .eq("id", pid)

    if (updateError) throw updateError

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
