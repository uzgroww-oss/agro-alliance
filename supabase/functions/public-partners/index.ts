import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { applyLang, langOf } from "../_shared/translate.ts"

const CACHE_TTL = 600

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const lang = langOf(new URL(req.url))
/**
     * TARJIMA BU YERDA QILINMAYDI — ATAYLAB.
     *
     * Ilgari tarjimasi yo'q yozuvlar aynan shu so'rov ichida tarjima
     * qilinardi. Natijada AI kvotasi tugaganda har bir tashrifchi
     * 7-8 soniya kutardi va tarjima baribir chiqmasdi: kutish bor,
     * foyda yo'q. Kesh eskirgan sari bu takrorlanardi.
     *
     * Endi tarjima FAQAT ikki joyda bo'ladi: admin kontentni
     * saqlaganda va admin panelidagi "qayta tarjima" tugmasi
     * bosilganda. Ommaviy sahifa hech qachon AI ni kutmaydi.
     */

    const { data: partners, error } = await supabaseAdmin
      .from("partners")
      .select("id, name, slug, sphere, logo, direction, sort_order, translations")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (error) return errorResponse(error.message, 500)


    const list = (partners || []).map((raw: Record<string, unknown>) => {
      // Kompaniya NOMI tarjima qilinmaydi — u brend
      const p = applyLang(raw, lang, ["sphere", "direction"])
      return {
      // `id` bloger video qo'shayotganda kompaniyani belgilash uchun kerak
      id: p.id,
      name: p.name,
      slug: p.slug,
      sphere: p.sphere || "",
      logo: p.logo || null,
      direction: p.direction || "",
      }
    })

    const stats = {
      total: list.length,
      countries: 15,
      strategic: 8,
      coverage: "1M+",
    }

    return cachedJsonResponse({ partners: list, stats }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
