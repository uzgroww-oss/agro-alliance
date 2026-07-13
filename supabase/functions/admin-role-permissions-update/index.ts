import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PUT") return errorResponse("Method not allowed", 405)

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const { role_id, permission_ids } = body

    if (!role_id) return errorResponse("role_id kerak", 400)
    if (!Array.isArray(permission_ids)) return errorResponse("permission_ids array kerak", 400)

    // Get role to check if system role permissions should be modifiable
    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("is_system, name")
      .eq("id", role_id)
      .is("deleted_at", null)
      .single()

    if (!role) return errorResponse("Rol topilmadi", 404)

    // Replace all permissions for this role in a transaction
    const { error: delErr } = await supabaseAdmin
      .from("role_permissions")
      .delete()
      .eq("role_id", role_id)

    if (delErr) return errorResponse(delErr.message, 500)

    if (permission_ids.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("role_permissions")
        .insert(permission_ids.map((pid: string) => ({ role_id, permission_id: pid })))

      if (insErr) return errorResponse(insErr.message, 500)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
