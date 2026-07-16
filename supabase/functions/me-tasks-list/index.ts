import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * me-tasks-list — Blogerga biriktirilgan TZ'lar ro'yxati.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  try {
    const { data: assigns, error } = await supabaseAdmin
      .from("blogger_task_assignments")
      .select("id, status, is_read, note, created_at, task:blogger_tasks!task_id(id, title, description, priority, deadline, file_url, file_name, created_at)")
      .eq("blogger_id", auth.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
    if (error) return errorResponse(error.message, 500)

    // O'chirilgan TZ'larni chiqarib tashlash + tekis format
    const tasks = (assigns || [])
      .filter((a: Record<string, unknown>) => a.task)
      .map((a: Record<string, unknown>) => {
        const t = a.task as Record<string, unknown>
        return {
          assignment_id: a.id,
          status: a.status,
          is_read: a.is_read,
          note: a.note,
          title: t.title,
          description: t.description,
          priority: t.priority,
          deadline: t.deadline,
          file_url: t.file_url,
          file_name: t.file_name,
          created_at: t.created_at,
        }
      })

    const unread = tasks.filter((t: { is_read: boolean }) => !t.is_read).length

    return jsonResponse({ tasks, unread })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
