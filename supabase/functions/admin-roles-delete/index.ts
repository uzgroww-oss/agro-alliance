import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "DELETE") return errorResponse("Method not allowed", 405)

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return errorResponse("id kerak", 400)

    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("is_system, name")
      .eq("id", id)
      .single()

    if (!role) return errorResponse("Rol topilmadi", 404)
    if (role.is_system) return errorResponse("Tizim rolini o'chirib bo'lmaydi", 400)

    const { error } = await supabaseAdmin
      .from("roles")
      .delete()
      .eq("id", id)

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
