import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PATCH") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return errorResponse("ID kerak", 400)

    const body = await req.json().catch(() => ({}))
    const allowedFields = ["key", "name_uz", "name_ru", "name_en", "icon", "sort_order", "is_active"]
    const updates: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse("Yangilash uchun maydon kerak", 400)
    }

    updates.updated_by = auth.user.id

    const { data: category, error } = await supabaseAdmin
      .from("news_categories")
      .update(updates)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id, key, name_uz, name_ru, name_en, icon, sort_order, is_active")
      .single()

    if (error) throw error

    return jsonResponse({ success: true, category })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
