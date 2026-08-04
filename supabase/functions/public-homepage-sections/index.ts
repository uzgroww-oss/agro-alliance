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

    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from("homepage_sections")
      .select("id, section_key, title, subtitle, is_active, sort_order, translations")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (sectionsError) return errorResponse(sectionsError.message, 500)

    if (!sections || sections.length === 0) {
      return cachedJsonResponse({ sections: [] }, CACHE_TTL)
    }

    // Tarjimasi yo'q bo'limlarni fonda tarjima qilib qo'yamiz

    const sectionIds = sections.map((s) => s.id)

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("homepage_section_items")
      .select("id, section_id, item_key, title, description, icon, link, sort_order, is_active, translations")
      .in("section_id", sectionIds)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (itemsError) return errorResponse(itemsError.message, 500)


    const itemsBySection: Record<string, typeof items> = {}
    for (const item of items ?? []) {
      if (!itemsBySection[item.section_id]) {
        itemsBySection[item.section_id] = []
      }
      itemsBySection[item.section_id].push(applyLang(item, lang, ["title", "description"]))
    }

    const result = sections.map((raw) => {
      // Tanlangan tilda: tarjima bo'lsa u, bo'lmasa o'zbekcha
      const s = applyLang(raw, lang, ["title", "subtitle"])
      return {
      section_key: s.section_key,
      title: s.title,
      subtitle: s.subtitle,
      items: itemsBySection[raw.id] || [],
      }
    })

    return cachedJsonResponse({ sections: result }, CACHE_TTL)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
