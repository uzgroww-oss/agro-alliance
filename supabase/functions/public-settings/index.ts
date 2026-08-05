import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { langOf } from "../_shared/translate.ts"

const CACHE_TTL = 300

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    /**
     * Sozlamalarda ham matn bor: ish vaqti, manzil, sayt tavsifi.
     * Ular saytda ko'rinadi, shuning uchun tarjimasi qo'llanadi.
     * Havolalar, telefon va brend nomi tarjimasiz — ularda
     * `translations` bo'sh bo'ladi va asl qiymat qaytadi.
     */
    const lang = langOf(new URL(req.url))

    const { data, error } = await supabaseAdmin
      .from("public_settings")
      .select("key, value, type, translations")
      .eq("is_public", true)
      .is("deleted_at", null)

    if (error) return errorResponse(error.message, 500)

    const settings: Record<string, string> = {}
    for (const row of data || []) {
      const tr = (row.translations as Record<string, { value?: string }> | null)?.[lang || ""]
      settings[row.key] = (tr?.value && tr.value.trim()) ? tr.value : row.value
    }

    return cachedJsonResponse({ settings }, CACHE_TTL)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
