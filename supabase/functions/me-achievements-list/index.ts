import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  try {
    const { data, error } = await supabaseAdmin
      .from("blogger_achievements")
      .select("*")
      .is("deleted_at", null)
      .eq("blogger_id", auth.user.id)
      .order("sort_order", { ascending: true })

    if (error) return errorResponse(error.message, 500)
    return jsonResponse({ achievements: data || [] })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
