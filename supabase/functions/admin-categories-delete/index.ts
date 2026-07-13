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

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return errorResponse("id kerak", 400)

    const { error } = await supabaseAdmin
      .from("news_categories")
      .delete()
      .eq("id", id)

    if (error) throw error

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
