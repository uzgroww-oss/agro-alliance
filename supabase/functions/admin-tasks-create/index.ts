import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * admin-tasks-create — Blogerlarga TZ (topshiriq) yuborish.
 * Body: { title, description?, priority?, deadline?, blogger_ids: string[] | "all" }
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== "POST") return errorResponse("Method not allowed", 405)

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const title = String(body.title || "").trim()
    if (!title) return errorResponse("Sarlavha majburiy", 400)

    const priority = ["low", "normal", "high"].includes(body.priority) ? body.priority : "normal"

    // Qabul qiluvchi blogerlarni aniqlash
    let bloggerIds: string[] = []
    if (body.blogger_ids === "all" || (Array.isArray(body.blogger_ids) && body.blogger_ids.length === 0)) {
      const { data } = await supabaseAdmin.from("bloggers").select("id").is("deleted_at", null)
      bloggerIds = (data || []).map((b: { id: string }) => b.id)
    } else if (Array.isArray(body.blogger_ids)) {
      bloggerIds = body.blogger_ids.map((x: unknown) => String(x))
    }
    if (bloggerIds.length === 0) return errorResponse("Hech bo'lmaganda bitta bloger tanlang", 400)

    // TZ yaratish
    const { data: task, error: taskErr } = await supabaseAdmin
      .from("blogger_tasks")
      .insert({
        title,
        description: body.description ? String(body.description) : null,
        priority,
        deadline: body.deadline || null,
        file_url: body.file_url ? String(body.file_url) : null,
        file_name: body.file_name ? String(body.file_name) : null,
        created_by: auth.user.id,
      })
      .select("id")
      .single()
    if (taskErr || !task) return errorResponse(taskErr?.message || "TZ yaratilmadi", 500)

    // Har bir blogerga biriktirish
    const rows = bloggerIds.map((bid) => ({ task_id: task.id, blogger_id: bid, status: "new" }))
    const { error: assignErr } = await supabaseAdmin.from("blogger_task_assignments").insert(rows)
    if (assignErr) return errorResponse(assignErr.message, 500)

    return jsonResponse({ success: true, task_id: task.id, assigned: bloggerIds.length })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
