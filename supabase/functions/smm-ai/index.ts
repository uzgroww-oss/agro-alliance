import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { getDynamicStats } from "../_shared/stats.ts"
import { geminiJson, type InlineImage } from "../_shared/gemini.ts"
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

/**
 * Rasmni yuklab olib base64 ga o'giradi.
 *
 * Nega serverda: rasm Storage'da turadi va Gemini unga URL orqali
 * murojaat qila olmaydi (imzolangan manzil, tashqi kirish yopiq).
 * Shuning uchun baytlarni o'zimiz olib, so'rov ichida yuboramiz.
 *
 * 4 MB dan katta rasm rad etiladi — inline_data cheklovi.
 */
// Gemini so'rovi butunligicha ~20 MB dan oshmasligi kerak. base64
// hajmni ~33% oshiradi, shuning uchun xom fayl chegarasi 14 MB.
const MAX_MEDIA_BYTES = 14 * 1024 * 1024

async function fetchInlineImage(url: string): Promise<InlineImage> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error("Faylni yuklab bo'lmadi")
  const type = resp.headers.get("content-type") || "image/jpeg"
  const isImage = type.startsWith("image/")
  const isVideo = type.startsWith("video/")
  if (!isImage && !isVideo) throw new Error("Bu fayl rasm ham, video ham emas")

  const buf = new Uint8Array(await resp.arrayBuffer())
  if (buf.byteLength > MAX_MEDIA_BYTES) {
    throw new Error(isVideo ? "Video juda katta (14 MB gacha)" : "Rasm juda katta (14 MB gacha)")
  }

  // btoa katta massivda stek to'lib ketadi — bo'laklab o'giramiz
  let bin = ""
  const CHUNK = 8192
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK))
  }
  return { mimeType: type, data: btoa(bin) }
}

/* ================= TARMOQLARDAN HAQIQIY MA'LUMOT ================= */
/**
 * Tahlil haqiqiy raqamlarga asoslanishi kerak. Ilgari AI faqat
 * platformadagi blogerlar statistikasini ko'rardi — ijtimoiy tarmoq
 * hisoblarining o'zi haqida hech narsa bilmasdi va tavsiyalari umumiy
 * chiqardi.
 *
 * Har bir tarmoq alohida yiqilishi mumkin (token eskirgan, ruxsat yo'q).
 * Shuning uchun har biri o'z try ichida — bittasi yiqilsa qolganlari
 * baribir keladi.
 */
export type NetworkStat = {
  platform: string
  name: string
  followers: number | null
  posts: number | null
  avgLikes: number | null
  avgComments: number | null
  recent: { text: string; likes: number | null; comments: number | null; date: string }[]
  error?: string
}

async function conf(platform: string, key: string, envName: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("smm_connections").select("config").eq("platform", platform).maybeSingle()
  const v = data?.config?.[key]
  if (v && String(v).trim()) return String(v).trim()
  return Deno.env.get(envName) || null
}

async function gatherInstagram(): Promise<NetworkStat | null> {
  const { data: tok } = await supabaseAdmin
    .from("instagram_tokens")
    .select("access_token, instagram_account_id, instagram_username")
    .order("created_at", { ascending: false }).limit(1).maybeSingle()
  const id = tok?.instagram_account_id
  const token = tok?.access_token
  if (!id || !token) return null

  const base: NetworkStat = {
    platform: "instagram", name: `@${tok.instagram_username || "?"}`,
    followers: null, posts: null, avgLikes: null, avgComments: null, recent: [],
  }
  try {
    const p = await fetch(`https://graph.facebook.com/v22.0/${id}?fields=username,followers_count,media_count&access_token=${token}`)
    const pd = await p.json().catch(() => ({}))
    if (pd.error) return { ...base, error: pd.error.message }
    base.name = `@${pd.username || tok.instagram_username || "?"}`
    base.followers = pd.followers_count ?? null
    base.posts = pd.media_count ?? null

    const m = await fetch(`https://graph.facebook.com/v22.0/${id}/media?fields=caption,like_count,comments_count,timestamp,media_type&limit=12&access_token=${token}`)
    const md = await m.json().catch(() => ({}))
    const items = (md.data || []) as { caption?: string; like_count?: number; comments_count?: number; timestamp?: string; media_type?: string }[]
    base.recent = items.slice(0, 8).map((it) => ({
      text: (it.caption || "(matnsiz)").slice(0, 80),
      likes: it.like_count ?? null,
      comments: it.comments_count ?? null,
      date: (it.timestamp || "").slice(0, 10),
    }))
    const withLikes = items.filter((i) => typeof i.like_count === "number")
    if (withLikes.length) {
      base.avgLikes = Math.round(withLikes.reduce((a, i) => a + (i.like_count || 0), 0) / withLikes.length)
      base.avgComments = Math.round(withLikes.reduce((a, i) => a + (i.comments_count || 0), 0) / withLikes.length)
    }
    return base
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Tarmoq xatosi" }
  }
}

async function gatherTelegram(): Promise<NetworkStat | null> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")
  const chatId = await conf("telegram", "chat_id", "TELEGRAM_CHAT_ID")
  if (!token || !chatId) return null

  const base: NetworkStat = {
    platform: "telegram", name: String(chatId),
    followers: null, posts: null, avgLikes: null, avgComments: null, recent: [],
  }
  try {
    const c = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`)
    const cd = await c.json().catch(() => ({}))
    if (!cd.ok) return { ...base, error: cd.description || "Kanalga kirib bo'lmadi" }
    base.name = cd.result?.title || String(chatId)

    const n = await fetch(`https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=${encodeURIComponent(chatId)}`)
    const nd = await n.json().catch(() => ({}))
    if (nd.ok) base.followers = nd.result ?? null
    // Telegram Bot API kanaldagi eski postlarni o'qishga ruxsat bermaydi —
    // shuning uchun bu yerda post ro'yxati bo'lmaydi.
    return base
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Tarmoq xatosi" }
  }
}

async function gatherFacebook(): Promise<NetworkStat | null> {
  const pageId = await conf("facebook", "page_id", "FACEBOOK_PAGE_ID")
  const token = await conf("facebook", "page_token", "FACEBOOK_PAGE_TOKEN")
  if (!pageId || !token) return null

  const base: NetworkStat = {
    platform: "facebook", name: pageId,
    followers: null, posts: null, avgLikes: null, avgComments: null, recent: [],
  }
  try {
    const p = await fetch(`https://graph.facebook.com/v22.0/${pageId}?fields=name,fan_count,followers_count&access_token=${token}`)
    const pd = await p.json().catch(() => ({}))
    if (pd.error) return { ...base, error: pd.error.message }
    base.name = pd.name || pageId
    base.followers = pd.followers_count ?? pd.fan_count ?? null

    const f = await fetch(`https://graph.facebook.com/v22.0/${pageId}/posts?fields=message,created_time,likes.summary(true),comments.summary(true)&limit=10&access_token=${token}`)
    const fd = await f.json().catch(() => ({}))
    const items = (fd.data || []) as Record<string, any>[]
    base.posts = items.length || null
    base.recent = items.slice(0, 8).map((it) => ({
      text: String(it.message || "(matnsiz)").slice(0, 80),
      likes: it.likes?.summary?.total_count ?? null,
      comments: it.comments?.summary?.total_count ?? null,
      date: String(it.created_time || "").slice(0, 10),
    }))
    const l = base.recent.filter((r) => typeof r.likes === "number")
    if (l.length) {
      base.avgLikes = Math.round(l.reduce((a, r) => a + (r.likes || 0), 0) / l.length)
      base.avgComments = Math.round(l.reduce((a, r) => a + (r.comments || 0), 0) / l.length)
    }
    return base
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Tarmoq xatosi" }
  }
}

async function gatherNetworks(): Promise<NetworkStat[]> {
  const all = await Promise.all([gatherInstagram(), gatherTelegram(), gatherFacebook()])
  return all.filter((x): x is NetworkStat => x !== null)
}

type Analysis = {
  holat: string
  kuchli: string[]
  zaif: string[]
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
        .select("title, content, status, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10)

      const recentLine = (recent || []).length
        ? (recent as { title: string | null; content: string; status?: string }[])
            .map((p, i) => `${i + 1}. [${p.status || "?"}] ${p.title || p.content.slice(0, 60)}`)
            .join("\n")
        : "(hali post yo'q)"

      // HAQIQIY tarmoq raqamlari — obunachi soni, o'rtacha layk/izoh,
      // oxirgi postlar. Tavsiya shu raqamlarga asoslanadi.
      const nets = await gatherNetworks()
      const connLine = nets.length
        ? nets.map((n) => {
            if (n.error) return `${n.platform} (${n.name}) — XATO: ${n.error}`
            const parts = [
              n.followers !== null ? `${n.followers} obunachi` : null,
              n.posts !== null ? `${n.posts} post` : null,
              n.avgLikes !== null ? `o'rtacha ${n.avgLikes} layk` : null,
              n.avgComments !== null ? `${n.avgComments} izoh` : null,
            ].filter(Boolean)
            const recent = n.recent.length
              ? `\n   Oxirgi postlar: ${n.recent.map((r) => `"${r.text}" (${r.likes ?? "?"} layk)`).join("; ")}`
              : ""
            return `${n.platform} (${n.name}): ${parts.join(", ") || "ma'lumot yo'q"}${recent}`
          }).join("\n")
        : "(hech qaysi tarmoq ulanmagan)"

      // Nima ishlagan, nima yiqilgan — tavsiya shuni hisobga olsin
      const { data: outcomes } = await supabaseAdmin
        .from("smm_post_results")
        .select("platform, success")
        .order("created_at", { ascending: false })
        .limit(20)
      const okCount = (outcomes || []).filter((r) => r.success).length
      const failCount = (outcomes || []).length - okCount

      const prompt = `Sen O'zbekistondagi "Agro Alliance" agro-media platformasining SMM strategisisan.

PLATFORMA HOLATI: ${statLine}

ULANGAN TARMOQLAR VA ULARNING HOLATI:
${connLine}
JOYLASH NATIJALARI (oxirgi 20 ta): ${okCount} muvaffaqiyatli, ${failCount} xato

OXIRGI POSTLAR:
${recentLine}

Vazifa: keyingi 1 hafta uchun ijtimoiy tarmoq kontenti bo'yicha tavsiya ber.
MUHIM: tavsiyalarni FAQAT ulangan tarmoqlar uchun ber. Ulanmagan tarmoqni tavsiya qilma.
Auditoriya — O'zbekistondagi fermerlar, dehqonlar, chorvadorlar va agro kompaniyalar.
Til — o'zbek tili.

Tahlilni yuqoridagi RAQAMLARGA asosla. Umumiy gap yozma — qaysi son
nimani ko'rsatayotganini ayt.

FAQAT JSON qaytar, boshqa matn yozma:
{
  "holat": "raqamlarga asoslangan 2-3 jumlalik tahlil",
  "kuchli": ["nima yaxshi ishlayapti — aniq raqam bilan"],
  "zaif": ["nima yomon — aniq raqam bilan"],
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
      return jsonResponse({ analysis: result, networks: nets })
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

    /* ---------------- RASMDAN KONTENT ---------------- */
    // Rasmni AI ning O'ZI ko'radi va shunga qarab post yozadi.
    //
    // FAQAT GEMINI: Groq'da ishlatayotgan llama-3.1-8b-instant rasmni
    // ko'ra olmaydi. Shuning uchun bu yerda zaxira provayder yo'q va
    // Gemini kaliti ishlamasa buni ochiq aytamiz.
    if (action === "describe") {
      const imageUrl = String(body.image_url || "").trim()
      const platform = String(body.platform || "telegram").trim()
      if (!imageUrl) return errorResponse("Avval rasm yoki video yuklang", 400)

      let image: InlineImage
      try {
        image = await fetchInlineImage(imageUrl)
      } catch (e) {
        return errorResponse(e instanceof Error ? e.message : "Faylni o'qib bo'lmadi", 400)
      }
      const isVideo = image.mimeType.startsWith("video/")
      const what = isVideo ? "videoni" : "rasmni"

      const prompt = `Sen O'zbekistondagi "Agro Alliance" agro-media platformasi uchun kontent yozuvchisan.

Yuqoridagi ${what} diqqat bilan ko'r. Aynan shunga mos post yoz.
${isVideo ? "Videoda nima sodir bo'layotganini" : "Rasmda nima borligini"} aniq nomlab o't — umumiy gaplar yozma.

PLATFORMA: ${platform}
Auditoriya — O'zbekistondagi fermerlar, dehqonlar, chorvadorlar va agro kompaniyalar.
Til — o'zbek tili (lotin alifbosi). Ohang — foydali, sodda, ishonchli.

FAQAT JSON qaytar, boshqa matn yozma:
{
  "sarlavha": "qisqa sarlavha",
  "matn": "postning to'liq matni",
  "hashtaglar": ["#agro", "#fermer"]
}`

      try {
        const result = await geminiJson<Generated>(prompt, { retries: 1, maxTokens: 2048, image })
        if (!result?.matn?.trim()) return errorResponse(`AI ${what} tavsiflay olmadi`, 500)
        return jsonResponse({ generated: result })
      } catch (e) {
        const m = e instanceof Error ? e.message : "Xatolik"
        return errorResponse(`Faylni o'qish uchun Gemini kerak — ${m}`, 500)
      }
    }

    return errorResponse("Noma'lum amal", 400)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xatolik"
    return errorResponse(msg, 500)
  }
})
