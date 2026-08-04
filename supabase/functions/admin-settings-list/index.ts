import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { translateFields, birlashtir, kerakliTillar, TR_VERSION } from "../_shared/translate.ts"

/**
 * Tarjima qilinadigan jadvallar va ularning matn maydonlari.
 * Jadval nomi KODDA qat'iy — mijoz tanlay olmaydi.
 */
const KONTENT: { table: string; fields: string[] }[] = [
  { table: "homepage_sections", fields: ["title", "subtitle"] },
  { table: "homepage_section_items", fields: ["title", "description"] },
  { table: "news_articles", fields: ["title", "excerpt", "content"] },
  { table: "partners", fields: ["sphere", "direction"] },
  { table: "team_members", fields: ["role"] },
]

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin", "admin")
  if (auth.response) return auth.response

  const url = new URL(req.url)

  /**
   * QAYTA TARJIMA — admin panelidagi tugma shu yerga keladi.
   *
   * Nega kerak: kontent tarjimasi sahifa ochilgani sari 2 tadan
   * to'ldiriladi, ya'ni ko'p yozuv bo'lsa uzoq davom etadi. Bu tugma
   * bir bosishda imkon qadar ko'p yozuvni tarjima qiladi.
   *
   * `reset=1` — mavjud tarjimalarni O'CHIRIB, hammasini boshidan
   * qiladi (sifatsiz tarjima qolib ketgan bo'lsa).
   *
   * Bir chaqiruvda ~45 soniya ishlaydi va nechta yozuv qolganini
   * qaytaradi — admin tugmani yana bosib davom ettiradi.
   */
  if (req.method === "POST" && url.searchParams.get("action") === "retranslate") {
    const reset = url.searchParams.get("reset") === "1"
    const deadline = Date.now() + 45_000
    let qilindi = 0
    let qoldi = 0

    for (const { table, fields } of KONTENT) {
      if (reset) {
        await supabaseAdmin.from(table).update({ translations: {} }).neq("id", "00000000-0000-0000-0000-000000000000")
      }

      const { data } = await supabaseAdmin
        .from(table)
        .select(`id, translations, ${fields.join(", ")}`)
        .is("deleted_at", null)
        .limit(200)

      // Ustunlar ro'yxati o'zgaruvchi (`fields.join`), shuning uchun
      // supabase-js turini aniqlay olmaydi — qo'lda ko'rsatamiz
      for (const r of (data || []) as unknown as Record<string, unknown>[]) {
        const tr = r.translations as Record<string, unknown> | undefined
        // JORIY versiyada bo'lsa tegilmaydi — tarjimasi bo'lmasa ham.
        // Ba'zi yozuvlar ATAYLAB tarjima qilinmaydi (brend nomi kabi),
        // ular ham "tayyor" hisoblanadi va qayta urinilmaydi.
        const tayyor = tr && Number(tr._v ?? 0) >= TR_VERSION
        if (tayyor) continue
        if (!fields.some((f) => typeof r[f] === "string" && (r[f] as string).trim())) continue

        if (Date.now() > deadline) { qoldi++; continue }

        const fl: Record<string, string | null | undefined> = {}
        for (const f of fields) fl[f] = r[f] as string | undefined
        const natija = await translateFields(
          fl,
          kerakliTillar(r.translations),
          Math.min(deadline, Date.now() + 20_000),
        )

        // BO'SH NATIJA HAM YOZILADI: eski buzuq tarjima o'chsin va yozuv
        // joriy versiyada deb belgilansin. Aks holda "AGRO ALLIANCE"
        // o'rniga eski "AGRICULTURE Partnership" qolib ketardi —
        // brend endi tarjima qilinmaydi, lekin eskisini hech kim
        // o'chirmasdi. Farqni `birlashtir` hal qiladi.
        const yoziladi = birlashtir(r.translations, natija)

        const { error } = await supabaseAdmin.from(table).update({ translations: yoziladi }).eq("id", r.id as string)
        if (error) { console.error(`retranslate ${table}:`, error.message); qoldi++; continue }
        qilindi++
      }
    }

    return jsonResponse({ success: true, qilindi, qoldi })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("public_settings")
      .select("id, key, value, type, description, is_public")
      .is("deleted_at", null)
      .order("key", { ascending: true })

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ settings: data || [] })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
