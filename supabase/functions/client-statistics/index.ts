import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "company")
  if (auth.response) return auth.response

  try {
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id")
      .eq("client_profile_id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!partner) return errorResponse("Hamkor topilmadi", 404)

    const [tasksRes, totalPartnersRes] = await Promise.all([
      supabaseAdmin
        .from("partner_tasks")
        .select("status")
        .eq("partner_id", partner.id)
        .is("deleted_at", null),
      supabaseAdmin
        .from("partners")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
    ])

    const allTasks = tasksRes.data || []
    const total = allTasks.length
    const done = allTasks.filter((t: { status: string }) => t.status === "done").length
    const progress = allTasks.filter((t: { status: string }) => t.status === "progress").length
    const pending = allTasks.filter((t: { status: string }) => t.status === "pending").length

    return jsonResponse({
      statistics: {
        totalTasks: total,
        doneTasks: done,
        progressTasks: progress,
        pendingTasks: pending,
        completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
        totalPartners: totalPartnersRes.count ?? 0,
      },
    })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
