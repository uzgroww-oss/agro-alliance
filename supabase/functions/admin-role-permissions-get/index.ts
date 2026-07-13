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
    const roleId = new URL(req.url).searchParams.get("role_id")
    if (!roleId) return errorResponse("role_id kerak", 400)

    const { data, error } = await supabaseAdmin
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId)

    if (error) return errorResponse(error.message, 500)

    const permissionIds = (data || []).map((rp: { permission_id: string }) => rp.permission_id)

    return jsonResponse({ permission_ids: permissionIds })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
