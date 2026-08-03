import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { applyLang, langOf, fondaTarjima } from "../_shared/translate.ts"

const CACHE_TTL = 300

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const lang = langOf(new URL(req.url))

    const { data, error } = await supabaseAdmin
      .from("team_members")
      .select("id, name, role, image_url, sort_order, translations")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (error) return errorResponse(error.message, 500)

    await fondaTarjima("team_members", (data || []) as Record<string, unknown>[], lang, ["role"])

    // Ism tarjima qilinmaydi, LAVOZIM tarjima qilinadi
    const members = (data || []).map((m) => applyLang(m as Record<string, unknown>, lang, ["role"]))

    return cachedJsonResponse({ members }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
