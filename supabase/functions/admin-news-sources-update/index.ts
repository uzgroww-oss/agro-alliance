import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PUT" && req.method !== "PATCH") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await requireRole(req, "super_admin")
    if (auth.response) return auth.response

    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return errorResponse("id kerak", 400)

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    const fields: string[] = [
      "name", "type", "url", "category_id", "language",
      "is_active", "fetch_interval_minutes", "config",
    ]

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse("Hech qanday maydon yuborilmadi", 400)
    }

    if (updates.type && !["rss", "website", "telegram"].includes(updates.type as string)) {
      return errorResponse("type rss/website/telegram bo'lishi kerak", 400)
    }

    updates.updated_by = auth.user.id

    const { error } = await supabaseAdmin
      .from("news_sources")
      .update(updates)
      .eq("id", id)

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
