import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const pid = new URL(req.url).searchParams.get("pid")
    if (!pid) return errorResponse("pid kerak", 400)

    const body = await req.json().catch(() => ({}))
    const errors = validate(body, { title: [required] })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const { data: task, error } = await supabaseAdmin
      .from("partner_tasks")
      .insert({
        partner_id: pid,
        title: body.title,
        status: "pending",
      })
      .select("id, title, status")
      .single()

    if (error) throw error

    return jsonResponse({ success: true, task })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
