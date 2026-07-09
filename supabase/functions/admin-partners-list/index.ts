import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const { data: partners, error: partnersError } = await supabaseAdmin
      .from("partners")
      .select("id, name, sphere, contract_no, contract_amount, signed_date, status, client_profile_id")
      .is("deleted_at", null)

    if (partnersError) throw partnersError

    if (!partners || partners.length === 0) {
      return jsonResponse({ partners: [] })
    }

    const partnerIds = partners.map((p) => p.id)

    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from("partner_tasks")
      .select("id, title, status, partner_id")
      .in("partner_id", partnerIds)
      .is("deleted_at", null)

    if (tasksError) throw tasksError

    const clientProfileIds = partners
      .filter((p) => p.client_profile_id)
      .map((p) => p.client_profile_id)

    let clientProfiles: Record<string, { id: string; name: string; email: string }> = {}
    if (clientProfileIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email")
        .in("id", clientProfileIds)

      if (profilesError) throw profilesError

      for (const p of profiles ?? []) {
        clientProfiles[p.id] = p
      }
    }

    const tasksByPartner: Record<string, Array<{ id: string; title: string; status: string }>> = {}
    for (const task of tasks ?? []) {
      if (!tasksByPartner[task.partner_id]) {
        tasksByPartner[task.partner_id] = []
      }
      tasksByPartner[task.partner_id].push({ id: task.id, title: task.title, status: task.status })
    }

    const result = partners.map((p) => ({
      id: p.id,
      name: p.name,
      sphere: p.sphere,
      contractNo: p.contract_no,
      amount: p.contract_amount,
      signedDate: p.signed_date,
      status: p.status,
      tasks: tasksByPartner[p.id] || [],
      client: p.client_profile_id && clientProfiles[p.client_profile_id]
        ? clientProfiles[p.client_profile_id]
        : null,
    }))

    return jsonResponse({ partners: result })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
