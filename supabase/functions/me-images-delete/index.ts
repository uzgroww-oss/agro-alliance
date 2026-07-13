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

    const imageId = new URL(req.url).searchParams.get("id")
    if (!imageId) return errorResponse("id kerak", 400)

    const { data: current } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", auth.user.id)
      .is("deleted_at", null)
      .single()

    const existingMeta = (current?.metadata as Record<string, unknown>) || {}
    const images: Array<{ id: string; url: string; caption?: string; createdAt: string }> = existingMeta.images as any[] || []
    const filtered = images.filter((img) => img.id !== imageId)

    if (filtered.length === images.length) {
      return errorResponse("Rasm topilmadi", 404)
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ metadata: { ...existingMeta, images: filtered } })
      .eq("id", auth.user.id)
      .is("deleted_at", null)

    if (updateError) return errorResponse(updateError.message, 500)

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
