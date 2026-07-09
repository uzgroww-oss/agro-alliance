import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

const STATUS_CYCLE: Record<string, string> = {
  pending: "progress",
  progress: "done",
  done: "pending",
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PATCH") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const pid = new URL(req.url).searchParams.get("pid")
    const tid = new URL(req.url).searchParams.get("tid")
    if (!pid || !tid) return errorResponse("pid va tid kerak", 400)

    const { data: task, error: readError } = await supabaseAdmin
      .from("partner_tasks")
      .select("id, title, status")
      .eq("id", tid)
      .eq("partner_id", pid)
      .is("deleted_at", null)
      .single()

    if (readError || !task) return errorResponse("Topshiriq topilmadi", 404)

    const newStatus = STATUS_CYCLE[task.status] || "pending"

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("partner_tasks")
      .update({ status: newStatus })
      .eq("id", tid)
      .select("id, title, status")
      .single()

    if (updateError) throw updateError

    return jsonResponse({ success: true, task: updated })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
