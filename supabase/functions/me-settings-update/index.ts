import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PUT" && req.method !== "PATCH") return errorResponse("Method not allowed", 405)

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  const body = await req.json().catch(() => ({}))
  if (Object.keys(body).length === 0) return errorResponse("Hech qanday maydon kiritilmagan", 400)

  try {
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", auth.user.id)
      .single()

    if (fetchError) return errorResponse(fetchError.message, 500)

    const currentMetadata = (profile?.metadata as Record<string, unknown>) ?? {}
    const mergedSettings = { ...(currentMetadata.settings as Record<string, unknown> ?? {}), ...body }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ metadata: { ...currentMetadata, settings: mergedSettings } })
      .eq("id", auth.user.id)

    if (error) return errorResponse(error.message, 500)
    return jsonResponse({ success: true, settings: mergedSettings })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
