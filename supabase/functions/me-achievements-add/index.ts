import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { validate, required } from "../_shared/validation.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") return errorResponse("Method not allowed", 405)

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  const body = await req.json().catch(() => ({}))
  const errors = validate(body, { title: [required] })
  if (errors.length > 0) return errorResponse(errors[0], 400)

  try {
    const { data, error } = await supabaseAdmin
      .from("blogger_achievements")
      .insert({ blogger_id: auth.user.id, ...body, created_by: auth.user.id })
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return jsonResponse({ success: true, achievement: data })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
