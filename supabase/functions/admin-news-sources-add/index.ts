import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await requireRole(req, "super_admin", "admin", "editor")
    if (auth.response) return auth.response

    const body = await req.json().catch(() => ({}))

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return errorResponse("name majburiy", 400)
    }
    if (!body.type || !["rss", "website", "telegram"].includes(body.type)) {
      return errorResponse("type majburiy va rss/website/telegram bo'lishi kerak", 400)
    }
    if (!body.url || typeof body.url !== "string" || !body.url.trim()) {
      return errorResponse("url majburiy", 400)
    }

    const payload: Record<string, unknown> = {
      name: body.name.trim(),
      type: body.type,
      url: body.url.trim(),
      created_by: auth.user.id,
    }

    if (body.category_id) payload.category_id = body.category_id
    if (body.language) payload.language = body.language
    if (body.fetch_interval_minutes !== undefined) payload.fetch_interval_minutes = body.fetch_interval_minutes
    if (body.config !== undefined) payload.config = body.config

    const { data: source, error } = await supabaseAdmin
      .from("news_sources")
      .insert(payload)
      .select("id, name, type, url")
      .single()

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ success: true, source })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
