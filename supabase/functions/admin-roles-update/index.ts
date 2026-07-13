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
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return errorResponse("id kerak", 400)

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.priority !== undefined) updates.priority = body.priority

    if (Object.keys(updates).length === 0) return errorResponse("Yangilanadigan maydon kerak", 400)

    const { data, error } = await supabaseAdmin
      .from("roles")
      .update(updates)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id, name, description, is_system, priority, updated_at")
      .single()

    if (error) {
      if (error.message.includes("idx_roles_name")) {
        return errorResponse("Bu nomli rol allaqachon mavjud", 409)
      }
      return errorResponse(error.message, 500)
    }

    return jsonResponse({ role: data })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
