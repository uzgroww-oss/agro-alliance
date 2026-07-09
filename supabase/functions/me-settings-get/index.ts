import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", auth.user.id)
      .single()

    if (error) return errorResponse(error.message, 500)
    const settings = (data?.metadata as Record<string, unknown>)?.settings ?? {}
    return jsonResponse({ settings })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
