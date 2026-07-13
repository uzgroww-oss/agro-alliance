import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    const { data: brands, error } = await supabaseAdmin
      .from("blogger_brands")
      .select("id, name, logo_url, sort_order")
      .eq("blogger_id", auth.user.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ brands: brands || [] })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
