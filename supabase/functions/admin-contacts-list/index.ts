import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin", "admin")
  if (auth.response) return auth.response

  try {
    let query = supabaseAdmin
      .from("contact_messages")
      .select("id, name, email, phone, subject, message, is_read, read_at, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    const isRead = new URL(req.url).searchParams.get("is_read")
    if (isRead === "true") {
      query = query.eq("is_read", true)
    } else if (isRead === "false") {
      query = query.eq("is_read", false)
    }

    const { data, error } = await query

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ messages: data || [] })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
