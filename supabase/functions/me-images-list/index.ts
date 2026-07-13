import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    const { data: current } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", auth.user.id)
      .is("deleted_at", null)
      .single()

    const meta = (current?.metadata as Record<string, unknown>) || {}
    const images: Array<{ id: string; url: string; caption?: string; createdAt: string }> = meta.images as any[] || []

    return jsonResponse({ images })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
