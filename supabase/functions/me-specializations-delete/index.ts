import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { now } from "../_shared/time.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "DELETE") return errorResponse("Method not allowed", 405)

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return errorResponse("id kiritilmagan", 400)

  try {
    const { error } = await supabaseAdmin
      .from("blogger_specializations")
      .update({ deleted_at: now(), deleted_by: auth.user.id })
      .eq("id", id)
      .eq("blogger_id", auth.user.id)

    if (error) return errorResponse(error.message, 500)
    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
