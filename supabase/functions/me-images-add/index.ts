import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    const body = await req.json().catch(() => ({}))
    const errors = validate(body, { url: [required] })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const { url, caption } = body as { url: string; caption?: string }

    const { data: current } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", auth.user.id)
      .is("deleted_at", null)
      .single()

    const existingMeta = (current?.metadata as Record<string, unknown>) || {}
    const images: Array<{ id: string; url: string; caption?: string; createdAt: string }> = existingMeta.images as any[] || []

    const newImage = {
      id: crypto.randomUUID(),
      url,
      caption: caption || "",
      createdAt: new Date().toISOString(),
    }
    images.push(newImage)

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ metadata: { ...existingMeta, images } })
      .eq("id", auth.user.id)
      .is("deleted_at", null)

    if (updateError) return errorResponse(updateError.message, 500)

    return jsonResponse({ success: true, image: newImage })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
