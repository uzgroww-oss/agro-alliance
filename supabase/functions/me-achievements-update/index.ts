import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PATCH" && req.method !== "PUT") return errorResponse("Method not allowed", 405)

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return errorResponse("id kiritilmagan", 400)

  const body = await req.json().catch(() => ({}))
  if (Object.keys(body).length === 0) return errorResponse("Hech qanday maydon kiritilmagan", 400)

  try {
    const { data, error } = await supabaseAdmin
      .from("blogger_achievements")
      .update(body)
      .eq("id", id)
      .eq("blogger_id", auth.user.id)
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    if (!data) return errorResponse("Yutuq topilmadi", 404)
    return jsonResponse({ success: true, achievement: data })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
