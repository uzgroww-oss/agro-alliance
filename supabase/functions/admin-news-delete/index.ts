import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { now } from "../_shared/time.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "DELETE") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response
    if (auth.user.role !== "super_admin" && auth.user.role !== "admin") {
      return errorResponse("Ruxsat yo'q", 403, "FORBIDDEN")
    }

    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return errorResponse("ID kerak", 400)

    const { data: article, error: fetchError } = await supabaseAdmin
      .from("news_articles")
      .select("id")
      .eq("id", id)
      .is("deleted_at", null)
      .single()

    if (fetchError || !article) return errorResponse("Yangilik topilmadi", 404)

    const timestamp = now()

    const { error } = await supabaseAdmin
      .from("news_articles")
      .update({ deleted_at: timestamp, deleted_by: auth.user.id })
      .eq("id", id)

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
