import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

const CACHE_TTL = 600

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const type = url.searchParams.get("type") || ""

    let query = supabaseAdmin
      .from("categories")
      .select("type, key, label, icon, sort_order")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (type) {
      query = query.eq("type", type)
    }

    const { data, error } = await query

    if (error) return errorResponse(error.message, 500)

    return cachedJsonResponse({ categories: data || [] }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
