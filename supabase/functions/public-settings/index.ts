import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

const CACHE_TTL = 300

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { data, error } = await supabaseAdmin
      .from("public_settings")
      .select("key, value, type")
      .eq("is_public", true)
      .is("deleted_at", null)

    if (error) return errorResponse(error.message, 500)

    const settings: Record<string, string> = {}
    for (const row of data || []) {
      settings[row.key] = row.value
    }

    return cachedJsonResponse({ settings }, CACHE_TTL)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
