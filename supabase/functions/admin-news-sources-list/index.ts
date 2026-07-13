import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await requireRole(req, "super_admin", "admin", "editor")
    if (auth.response) return auth.response

    const url = new URL(req.url)
    const type = url.searchParams.get("type")
    const isActive = url.searchParams.get("is_active")

    let query = supabaseAdmin
      .from("news_sources")
      .select("*")
      .is("deleted_at", null)

    if (type) {
      query = query.eq("type", type)
    }

    if (isActive !== null && isActive !== "") {
      query = query.eq("is_active", isActive === "true")
    }

    query = query.order("created_at", { ascending: false })

    const { data: sources, error } = await query

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ sources: sources || [] })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
