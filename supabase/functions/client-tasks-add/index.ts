import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { validate, required } from "../_shared/validation.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") return errorResponse("Method not allowed", 405)

  const auth = await requireRole(req, "company")
  if (auth.response) return auth.response

  const body = await req.json().catch(() => ({}))
  const errors = validate(body, { title: [required] })
  if (errors.length > 0) return errorResponse(errors[0], 400)

  try {
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id")
      .eq("client_profile_id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!partner) return errorResponse("Hamkor topilmadi", 404)

    const { data: maxOrder } = await supabaseAdmin
      .from("partner_tasks")
      .select("sort_order")
      .eq("partner_id", partner.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (maxOrder?.sort_order ?? -1) + 1

    const { data: task, error } = await supabaseAdmin
      .from("partner_tasks")
      .insert({
        partner_id: partner.id,
        title: body.title,
        status: "pending",
        sort_order: nextOrder,
        created_by: auth.user.id,
      })
      .select("id, title, status")
      .single()

    if (error) return errorResponse(error.message, 500)
    return jsonResponse({ success: true, task })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
