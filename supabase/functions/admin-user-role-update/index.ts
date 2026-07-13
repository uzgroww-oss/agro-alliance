import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PATCH") return errorResponse("Method not allowed", 405)

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const { user_id, role_id } = body

    if (!user_id) return errorResponse("user_id kerak", 400)
    if (!role_id) return errorResponse("role_id kerak", 400)

    // Verify user exists
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", user_id)
      .is("deleted_at", null)
      .single()

    if (!profile) return errorResponse("Foydalanuvchi topilmadi", 404)

    // Verify role exists
    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("id", role_id)
      .is("deleted_at", null)
      .single()

    if (!role) return errorResponse("Rol topilmadi", 404)

    // Remove existing roles and assign the new one
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("profile_id", user_id)

    if (delErr) return errorResponse(delErr.message, 500)

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ profile_id: user_id, role_id })

    if (insErr) return errorResponse(insErr.message, 500)

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
