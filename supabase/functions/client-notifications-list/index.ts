import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "company")
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const unreadOnly = url.searchParams.get("unread") === "true"

    let query = supabaseAdmin
      .from("notifications")
      .select("id, title, body, type, is_read, link, created_at")
      .eq("user_id", auth.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50)

    if (unreadOnly) {
      query = query.eq("is_read", false)
    }

    const { data, error } = await query

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ notifications: data || [] })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
