import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * admin-tasks-list — Yuborilgan TZ'lar ro'yxati + har birining holat statistikasi.
 * DELETE ?id=... — TZ'ni o'chirish.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)

    if (req.method === "DELETE") {
      const id = url.searchParams.get("id")
      if (!id) return errorResponse("id talab qilinadi", 400)
      const { error } = await supabaseAdmin.from("blogger_tasks")
        .update({ deleted_at: new Date().toISOString() }).eq("id", id)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    const { data: tasks, error } = await supabaseAdmin
      .from("blogger_tasks")
      .select("id, title, description, priority, deadline, file_url, file_name, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
    if (error) return errorResponse(error.message, 500)

    const taskIds = (tasks || []).map((t: { id: string }) => t.id)
    const statsMap: Record<string, { total: number; new: number; in_progress: number; done: number }> = {}
    if (taskIds.length > 0) {
      const { data: assigns } = await supabaseAdmin
        .from("blogger_task_assignments")
        .select("task_id, status")
        .in("task_id", taskIds)
        .is("deleted_at", null)
      for (const a of (assigns || []) as Array<{ task_id: string; status: string }>) {
        const s = statsMap[a.task_id] || { total: 0, new: 0, in_progress: 0, done: 0 }
        s.total++
        if (a.status === "in_progress") s.in_progress++
        else if (a.status === "done") s.done++
        else s.new++
        statsMap[a.task_id] = s
      }
    }

    const result = (tasks || []).map((t: Record<string, unknown>) => ({
      ...t,
      stats: statsMap[t.id as string] || { total: 0, new: 0, in_progress: 0, done: 0 },
    }))

    return jsonResponse({ tasks: result })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
