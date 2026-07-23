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

/**
 * Gemini birinchi, xato bo'lsa Groq.
 *
 * MUHIM: retries=1. Standart 3 ta qayta urinish + backoff bilan javob
 * 60 soniyadan oshib ketardi va brauzer so'rovni uzib qo'yardi. Tez
 * taslim bo'lib zaxira provayderga o'tgan ma'qul.
 *
 * Ikkalasi ham yiqilsa — HAQIQIY sababni qaytaramiz (kalit yo'qmi,
 * kvota tugaganmi), "AI javob bermadi" degan umumiy xabar emas.
 */
async function askAi<T>(prompt: string, validate: (v: unknown) => boolean): Promise<T> {
  const errs: string[] = []

  for (const [name, fn] of [
    ["Gemini", geminiJson],
    ["Groq", groqJson],
  ] as const) {
    try {
      // maxTokens: tahlil javobi 4+ tavsiya bilan uzun bo'ladi.
      // 2048 da javob o'rtasida kesilib, JSON yarim qolardi.
      const raw = await fn<unknown>(prompt, { retries: 1, maxTokens: 3500 })
      // MUHIM: AI javob bergani yetarli emas — kutilgan maydonlar bormi?
      // Ilgari tekshirilmasdi, shuning uchun noto'g'ri shakl kelsa ekranda
      // xatosiz BO'SH quti chiqardi va sabab noma'lum bo'lardi.
      if (validate(raw)) return raw as T
      const peek = JSON.stringify(raw).slice(0, 200)
      errs.push(`${name}: kutilmagan javob — ${peek}`)
    } catch (e) {
      errs.push(`${name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  throw new Error(errs.join(" | "))
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

      const result = await askAi<Analysis>(prompt, (v) => {
        const o = v as Analysis
        return Boolean(o && typeof o === "object" && Array.isArray(o.tavsiyalar) && o.tavsiyalar.length > 0)
      })
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

      const result = await askAi<Generated>(prompt, (v) => {
        const o = v as Generated
        return Boolean(o && typeof o === "object" && typeof o.matn === "string" && o.matn.trim())
      })
      return jsonResponse({ generated: result })
    }

    return errorResponse("Noma'lum amal", 400)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xatolik"
    return errorResponse(msg, 500)
  }
})
