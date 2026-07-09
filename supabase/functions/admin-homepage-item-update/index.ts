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

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return errorResponse("id kerak", 400)

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description
    if (body.icon !== undefined) updates.icon = body.icon
    if (body.link !== undefined) updates.link = body.link
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order
    if (body.is_active !== undefined) updates.is_active = body.is_active

    if (Object.keys(updates).length === 0) {
      return errorResponse("Hech qanday o'zgarish kiritilmadi", 400)
    }

    const { data, error } = await supabaseAdmin
      .from("homepage_section_items")
      .update(updates)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id, section_id, item_key, title, description, icon, link, sort_order, is_active")
      .single()

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ success: true, item: data })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
