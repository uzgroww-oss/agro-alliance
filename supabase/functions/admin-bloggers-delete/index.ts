import { handleCors } from "../_shared/cors.ts"
import { requireRole, verifyAuth } from "../_shared/auth.ts"
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
    if (!id) return errorResponse("ID kerak", 400)

    const { data: blogger, error: fetchError } = await supabaseAdmin
      .from("bloggers")
      .select("id")
      .eq("id", id)
      .is("deleted_at", null)
      .single()

    if (fetchError || !blogger) return errorResponse("Blogger topilmadi", 404)

    const now = new Date().toISOString()

    const { error: updateBloggerError } = await supabaseAdmin
      .from("bloggers")
      .update({ deleted_at: now, deleted_by: auth.user.id })
      .eq("id", id)

    if (updateBloggerError) return errorResponse(updateBloggerError.message, 500)

    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({ status: "pending", deleted_at: now })
      .eq("id", id)

    if (updateProfileError) return errorResponse(updateProfileError.message, 500)

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
