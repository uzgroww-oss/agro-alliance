import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "DELETE") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) {
      return errorResponse("ID kerak", 400)
    }

    const userId = auth.user.id

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", userId)
      .is("deleted_at", null)
      .single()

    if (!profile) {
      return errorResponse("Profil topilmadi", 404)
    }

    const meta = (profile.metadata as Record<string, unknown>) || {}
    const videos = (meta.videos as unknown[]) || []

    const filtered = videos.filter((v: unknown) => (v as Record<string, unknown>).id !== id)
    if (filtered.length === videos.length) {
      return errorResponse("Video topilmadi", 404)
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        metadata: { ...meta, videos: filtered },
      })
      .eq("id", userId)
      .is("deleted_at", null)

    if (updateError) {
      return errorResponse(updateError.message, 500)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
