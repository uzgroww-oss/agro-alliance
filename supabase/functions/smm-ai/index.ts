import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { getDynamicStats } from "../_shared/stats.ts"
import { geminiJson } from "../_shared/gemini.ts"
import { groqJson } from "../_shared/groq.ts"

/**
 * smm-ai — AI yordamida ijtimoiy tarmoq kontentini tahlil qilish va yaratish.
 *
 * Ikkita amal (edge funksiya limiti sababli bitta funksiyada):
 *   POST ?action=analyze  — nima yaratish kerakligi bo'yicha tavsiya
 *   POST ?action=generate — tayyor post matni + hashtag
 *
 * MUHIM: bu funksiya HECH NARSA JOYLAMAYDI. U faqat matn tayyorlaydi.
 * Joylash — smm-publish, va faqat odam tasdiqlagandan keyin.
 */

/** Gemini birinchi, xato bo'lsa Groq. Ikkalasi ham yiqilsa — aniq xato. */
async function askAi<T>(prompt: string): Promise<T> {
  try {
    return await geminiJson<T>(prompt)
  } catch (_e) {
    try {
      return await groqJson<T>(prompt)
    } catch (_e2) {
      throw new Error("AI xizmati javob bermadi")
    }
  }
}

type Analysis = {
  holat: string
  tavsiyalar: { mavzu: string; sabab: string; platforma: string; format: string }[]
  eng_yaxshi_vaqt: string
}

type Generated = {
  sarlavha: string
  matn: string
  hashtaglar: string[]
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") return errorResponse("Method not allowed", 405)

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "analyze"
    const body = await req.json().catch(() => ({}))

    /* ---------------- TAHLIL ---------------- */
    if (action === "analyze") {
      // Kontekst: platforma statistikasi + oxirgi postlar
      const stats = await getDynamicStats()
      const statLine = stats.map((s) => `${s.label}: ${s.value}`).join(", ")

      const { data: recent } = await supabaseAdmin
        .from("smm_posts")
        .select("title, content, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10)

      const recentLine = (recent || []).length
        ? (recent as { title: string | null; content: string }[])
            .map((p, i) => `${i + 1}. ${p.title || p.content.slice(0, 60)}`)
            .join("\n")
        : "(hali post yo'q)"

      const prompt = `Sen O'zbekistondagi "Agro Alliance" agro-media platformasining SMM strategisisan.

PLATFORMA HOLATI: ${statLine}

OXIRGI POSTLAR:
${recentLine}

Vazifa: keyingi 1 hafta uchun ijtimoiy tarmoq kontenti bo'yicha tavsiya ber.
Auditoriya — O'zbekistondagi fermerlar, dehqonlar, chorvadorlar va agro kompaniyalar.
Til — o'zbek tili.

FAQAT JSON qaytar, boshqa matn yozma:
{
  "holat": "hozirgi holatning 1-2 jumlalik tahlili",
  "tavsiyalar": [
    { "mavzu": "aniq mavzu", "sabab": "nega aynan shu", "platforma": "telegram|instagram|facebook", "format": "post|video|karusel" }
  ],
  "eng_yaxshi_vaqt": "joylash uchun eng yaxshi kun va soat"
}
Kamida 4 ta tavsiya ber.`

      const result = await askAi<Analysis>(prompt)
      return jsonResponse({ analysis: result })
    }

    /* ---------------- KONTENT YARATISH ---------------- */
    if (action === "generate") {
      const topic = String(body.topic || "").trim()
      const platform = String(body.platform || "telegram").trim()
      if (!topic) return errorResponse("Mavzu kiriting", 400)
      if (topic.length > 300) return errorResponse("Mavzu juda uzun", 400)

      const limits: Record<string, string> = {
        telegram: "1000 belgigacha, Telegram uchun",
        instagram: "2000 belgigacha, Instagram uchun (emoji ishlatsa bo'ladi)",
        facebook: "1500 belgigacha, Facebook uchun",
        linkedin: "1500 belgigacha, professional ohangda, LinkedIn uchun",
        youtube: "video tavsifi, 1500 belgigacha",
      }

      const prompt = `Sen O'zbekistondagi "Agro Alliance" agro-media platformasi uchun kontent yozuvchisan.

MAVZU: ${topic}
PLATFORMA: ${platform} (${limits[platform] || limits.telegram})

Auditoriya — O'zbekistondagi fermerlar, dehqonlar, chorvadorlar va agro kompaniyalar.
Til — o'zbek tili (lotin alifbosi). Ohang — foydali, sodda, ishonchli. Reklama shiori emas.

FAQAT JSON qaytar, boshqa matn yozma:
{
  "sarlavha": "qisqa sarlavha",
  "matn": "postning to'liq matni",
  "hashtaglar": ["#agro", "#fermer"]
}`

      const result = await askAi<Generated>(prompt)
      return jsonResponse({ generated: result })
    }

    return errorResponse("Noma'lum amal", 400)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xatolik"
    return errorResponse(msg, 500)
  }
})
