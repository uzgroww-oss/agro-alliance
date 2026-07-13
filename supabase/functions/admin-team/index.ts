import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  const method = req.method

  try {
    // DELETE /team?id=...
    if (method === "DELETE") {
      if (!id) return errorResponse("id talab qilinadi", 400)
      const { error } = await supabaseAdmin
        .from("team_members")
        .update({ deleted_at: new Date().toISOString(), deleted_by: auth.user.id })
        .eq("id", id)
        .is("deleted_at", null)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    // PATCH /team?id=...
    if (method === "PATCH" || method === "PUT") {
      if (!id) return errorResponse("id talab qilinadi", 400)
      const body = await req.json().catch(() => ({}))
      const { name, role, image_url, sort_order, is_active } = body as {
        name?: string; role?: string; image_url?: string; sort_order?: number; is_active?: boolean
      }
      const updates: Record<string, unknown> = { updated_by: auth.user.id }
      if (name !== undefined) updates.name = name.trim()
      if (role !== undefined) updates.role = role?.trim() || null
      if (image_url !== undefined) updates.image_url = image_url || null
      if (sort_order !== undefined) updates.sort_order = sort_order
      if (is_active !== undefined) updates.is_active = is_active

      const { data, error } = await supabaseAdmin
        .from("team_members")
        .update(updates)
        .eq("id", id)
        .is("deleted_at", null)
        .select("id, name, role, image_url, sort_order, is_active")
        .single()
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true, member: data })
    }

    // POST /team
    if (method === "POST") {
      const body = await req.json().catch(() => ({}))
      const { name, role, image_url } = body as { name?: string; role?: string; image_url?: string }
      if (!name || !name.trim()) return errorResponse("Ism talab qilinadi", 400)

      const { data, error } = await supabaseAdmin
        .from("team_members")
        .insert({ name: name.trim(), role: role?.trim() || null, image_url: image_url || null, created_by: auth.user.id })
        .select("id, name, role, image_url, sort_order, is_active")
        .single()
      if (error) throw new Error(error.message)
      return jsonResponse({ success: true, member: data })
    }

    // GET /team (list all, including ?id=... for single)
    const query = supabaseAdmin
      .from("team_members")
      .select("id, name, role, image_url, sort_order, is_active, created_at")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (id) query.eq("id", id)

    const { data, error } = await query
    if (error) return errorResponse(error.message, 500)
    return jsonResponse({ members: data || [] })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorResponse(msg || "Xatolik yuz berdi", 500)
  }
})
