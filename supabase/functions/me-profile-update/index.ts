import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PUT") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    const body = await req.json().catch(() => ({}))
    const userId = auth.user.id

    const updates: Record<string, unknown> = {}
    const metaUpdates: Record<string, string> = {}

    if (body.name) updates.name = body.name
    if (body.photo) updates.avatar = body.photo

    const metaFields = ["age", "gender", "region", "language", "niche"]
    for (const field of metaFields) {
      if (body[field] !== undefined) metaUpdates[field] = body[field]
    }

    if (Object.keys(metaUpdates).length > 0) {
      const { data: current } = await supabaseAdmin
        .from("profiles")
        .select("metadata")
        .eq("id", userId)
        .is("deleted_at", null)
        .single()

      const existingMeta = (current?.metadata as Record<string, unknown>) || {}
      updates.metadata = { ...existingMeta, ...metaUpdates }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("id", userId)
        .is("deleted_at", null)

      if (updateError) {
        return errorResponse(updateError.message, 500)
      }
    }

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
