import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { getDynamicStats } from "../_shared/stats.ts"

const CACHE_TTL = 300

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { data, error } = await supabaseAdmin
      .from("homepage_stats")
      .select("key, value, label")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (error) return errorResponse(error.message, 500)

    const dynamicStats = await getDynamicStats(data || [])

    return cachedJsonResponse({ stats: dynamicStats }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
