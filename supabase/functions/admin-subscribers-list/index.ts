import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    let query = supabaseAdmin
      .from("newsletter_subscribers")
      .select("id, email, name, is_active, subscribed_at, unsubscribed_at")
      .is("deleted_at", null)
      .order("subscribed_at", { ascending: false })

    const isActive = new URL(req.url).searchParams.get("is_active")
    if (isActive === "true") {
      query = query.eq("is_active", true)
    } else if (isActive === "false") {
      query = query.eq("is_active", false)
    }

    const { data, error } = await query

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ subscribers: data || [] })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
