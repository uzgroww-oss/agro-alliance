import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { applyLang, langOf } from "../_shared/translate.ts"

const CACHE_TTL = 300

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const lang = langOf(new URL(req.url))

    /**
     * TARJIMA BU YERDA QILINMAYDI — ATAYLAB.
     *
     * Ilgari tarjimasi yo'q yozuvlar aynan shu so'rov ichida
     * tarjima qilinardi. Natijada AI kvotasi tugaganda har bir
     * tashrifchi 7-8 soniya kutardi va tarjima baribir chiqmasdi:
     * kutish bor, foyda yo'q. Kesh eskirgan sari bu takrorlanardi.
     *
     * Endi tarjima FAQAT ikki joyda bo'ladi:
     *   1) admin kontentni saqlaganda (yangi kontent darrov tarjima
     *      bo'ladi);
     *   2) admin panelidagi "qayta tarjima" tugmasi bosilganda
     *      (eski yozuvlarni to'ldirish uchun).
     * Ommaviy sahifa esa hech qachon AI ni kutmaydi.
     */

    const { data, error } = await supabaseAdmin
      .from("team_members")
      .select("id, name, role, image_url, sort_order, translations")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (error) return errorResponse(error.message, 500)


    // Ism tarjima qilinmaydi, LAVOZIM tarjima qilinadi
    const members = (data || []).map((m) => applyLang(m as Record<string, unknown>, lang, ["role"]))

    return cachedJsonResponse({ members }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
