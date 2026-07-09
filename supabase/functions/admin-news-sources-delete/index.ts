import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "DELETE") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await requireRole(req, "super_admin")
    if (auth.response) return auth.response

    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return errorResponse("id kerak", 400)

    const now = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from("news_sources")
      .update({ deleted_at: now, deleted_by: auth.user.id })
      .eq("id", id)
      .is("deleted_at", null)

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
