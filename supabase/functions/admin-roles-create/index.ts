import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") return errorResponse("Method not allowed", 405)

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    if (!body.name?.trim()) return errorResponse("Rol nomi kerak", 400)

    const { data, error } = await supabaseAdmin
      .from("roles")
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        priority: typeof body.priority === "number" ? body.priority : 0,
        is_system: false,
      })
      .select("id, name, description, is_system, priority, created_at")
      .single()

    if (error) {
      if (error.message.includes("idx_roles_name")) {
        return errorResponse("Bu nomli rol allaqachon mavjud", 409)
      }
      return errorResponse(error.message, 500)
    }

    return jsonResponse({ role: data }, 201)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
