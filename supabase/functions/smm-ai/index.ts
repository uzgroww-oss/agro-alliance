import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { geminiJson, geminiChat, type InlineImage } from "../_shared/gemini.ts"
import { groqJson, groqChat } from "../_shared/groq.ts"
import { nimJson, nimChat } from "../_shared/nim.ts"
import { nimImage, type GenAspect } from "../_shared/nimImage.ts"
import { gatherCompetitors, fetchCompetitor, webTrends, type Competitor } from "../_shared/market.ts"
import { getFacebookPage } from "../_shared/facebook.ts"

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
async function askAi<T>(prompt: string, validate: (v: unknown) => boolean, maxTokens = 3500): Promise<T> {
  const errs: string[] = []

  // Uchta provayder: biri kvotasi tugasa keyingisi ishlaydi.
  // Groq oxirida emas, o'rtada — uning bepul chegarasi eng keng.
  for (const [name, fn] of [
    ["Groq", groqJson],
    ["Gemini", geminiJson],
    ["NVIDIA", nimJson],
  ] as const) {
    try {
      // maxTokens: tahlil javobi 4+ tavsiya bilan uzun bo'ladi.
      // 2048 da javob o'rtasida kesilib, JSON yarim qolardi.
      const raw = await fn<unknown>(prompt, { retries: 1, maxTokens })
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
 * Raqobatchilarni AVTOMATIK topish.
 *
 * MUHIM QOIDA: AI faqat NOMZOD taklif qiladi, raqamlarni O'YLAB
 * TOPMAYDI. Har bir nomzod Instagram business_discovery orqali
 * tekshiriladi va faqat HAQIQATAN mavjud, ochiq ko'rsatkichlari
 * keladigan hisoblar qoladi. Mavjud bo'lmagani jimgina tashlanadi.
 *
 * Shu sababli tahlilga tushadigan har bir raqam API dan keladi.
 */
async function discoverCompetitors(): Promise<Competitor[]> {
  const { data: tok } = await supabaseAdmin
    .from("instagram_tokens")
    .select("access_token, instagram_account_id, instagram_username")
    .order("created_at", { ascending: false }).limit(1).maybeSingle()

  if (!tok?.access_token || !tok?.instagram_account_id) return []

  let names: string[] = []
  try {
    const raw = await askAi<{ nomzodlar: string[] }>(
      `O'zbekistondagi qishloq xo'jaligi, fermerlik, agro biznes va oziq-ovqat
sohasida Instagram'da faol bo'lgan kompaniya va media hisoblarini sanab ber.

Qoidalar:
- Faqat O'ZBEKISTON bilan bog'liq hisoblar
- Kompaniya, do'kon, agro media, fermer xo'jaligi hisoblari
- Faqat foydalanuvchi nomi (username), @ belgisisiz
- Ishonchsiz bo'lsang ham yoz — ular keyin tekshiriladi
- 20 ta nom ber

FAQAT JSON qaytar:
{ "nomzodlar": ["nom1", "nom2"] }`,
      (v) => Array.isArray((v as { nomzodlar?: unknown }).nomzodlar),
    )
    names = (raw.nomzodlar || [])
      .map((n) => String(n).trim().replace(/^@/, "").replace(/\s+/g, ""))
      .filter((n) => /^[a-z0-9._]{2,30}$/i.test(n))
      .slice(0, 20)
  } catch {
    return [] // AI javob bermasa avtomatik topish o'tkazib yuboriladi
  }

  // O'zimizni ro'yxatdan chiqaramiz
  const own = String(tok.instagram_username || "").toLowerCase()
  names = names.filter((n) => n.toLowerCase() !== own)

  // Tekshiruv: bir vaqtda 4 tadan — Graph API ni bo'g'ib qo'ymaslik uchun
  const found: Competitor[] = []
  for (let i = 0; i < names.length && found.length < 8; i += 4) {
    const batch = names.slice(i, i + 4)
    const res = await Promise.all(
      batch.map((n) => fetchCompetitor(tok.instagram_account_id, tok.access_token, n, null)),
    )
    for (const c of res) {
      // Faqat HAQIQIY raqam qaytganini olamiz
      if (!c.error && c.followers !== null) found.push(c)
    }
  }

  // Topilganlarni saqlaymiz — keyingi safar qayta qidirilmasin
  for (const c of found) {
    await supabaseAdmin.from("smm_competitors").upsert({
      platform: "instagram",
      username: c.username,
      label: null,
      followers: c.followers,
      posts: c.posts,
      avg_likes: c.avgLikes,
      last_error: null,
      checked_at: new Date().toISOString(),
    }, { onConflict: "platform,username" })
  }

  return found
}

/**
 * Oddiy MATN javobi uchun zanjir (JSON emas).
 * Suhbatda AI erkin gapiradi, qat'iy shakl talab qilinmaydi.
 */
async function askText(prompt: string): Promise<string> {
  const errs: string[] = []
  for (const [name, fn] of [
    ["Groq", groqChat],
    ["Gemini", geminiChat],
    ["NVIDIA", nimChat],
  ] as const) {
    try {
      const { text } = await fn(prompt, { retries: 1, maxTokens: 1500 })
      if (text && text.trim()) return text.trim()
      errs.push(`${name}: bo'sh javob`)
    } catch (e) {
      errs.push(`${name}: ${e instanceof Error ? e.message : "xatolik"}`)
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
  // Token muddati tugagan bo'lsa Instagram tokenidan qayta chiqariladi
  const page = await getFacebookPage()
  if (!page) return null
  const pageId = page.id
  const token = page.token

  const base: NetworkStat = {
    platform: "facebook", name: page.name,
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

/**
 * AI so'ralgan JSON shaklini har doim ham aniq bermaydi. Masalan
 * "bozor" matn o'rniga { description, position, goals } obyekti bo'lib
 * kelgan va frontend uni chizmoqchi bo'lganda butun sahifa yiqilgan
 * ("Objects are not valid as a React child").
 *
 * Shuning uchun javob FRONTENDGA BERILISHDAN OLDIN majburan
 * to'g'rilanadi: matn kutilgan joyda matn, ro'yxat kutilgan joyda
 * matnlar ro'yxati bo'ladi.
 */
function asText(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(" ")
  if (typeof v === "object") {
    // Obyekt bo'lsa qiymatlarini birlashtiramiz — kalitlar odatda
    // ichki sarlavhalar bo'ladi va matnning o'zi qiymatda turadi
    return Object.values(v as Record<string, unknown>).map(asText).filter(Boolean).join(". ")
  }
  return ""
}

function asTextList(v: unknown): string[] {
  if (!v) return []
  const arr = Array.isArray(v) ? v : [v]
  return arr.map(asText).map((x) => x.trim()).filter(Boolean)
}

function normalizePlan(raw: unknown): MarketPlan {
  const o = (raw || {}) as Record<string, unknown>
  const reja = Array.isArray(o.reja) ? o.reja : []
  return {
    bozor: asText(o.bozor),
    raqobat: asTextList(o.raqobat),
    sotuv: asTextList(o.sotuv),
    reja: reja.map((r, i) => {
      const it = (r || {}) as Record<string, unknown>
      const kun = Number(it.kun)
      return {
        kun: Number.isFinite(kun) && kun > 0 ? kun : i + 1,
        mavzu: asText(it.mavzu),
        format: asText(it.format) || "post",
        platforma: asText(it.platforma) || "telegram",
        vaqt: asText(it.vaqt),
        maqsad: asText(it.maqsad),
      }
    }).filter((r) => r.mavzu),
  }
}

/**
 * Matn o'zini takrorlayaptimi?
 *
 * Kichik modellar ba'zan bir xil jumlani o'nlab marta yozib ketadi.
 * Bunday javob foydasiz, lekin "bo'sh emas" bo'lgani uchun tekshiruvdan
 * o'tib ketardi va ekranga chiqardi.
 */
function isRepetitive(text: string): boolean {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean)
  // Qisqa matnda takror bo'lishi tabiiy — tekshirmaymiz
  if (words.length < 40) return false

  // Besh so'zli ketma-ketlik 4 marta takrorlansa — model qotib qolgan
  const seen = new Map<string, number>()
  let worst = 0
  for (let i = 0; i + 5 <= words.length; i++) {
    const k = words.slice(i, i + 5).join(" ")
    const n = (seen.get(k) || 0) + 1
    seen.set(k, n)
    if (n > worst) worst = n
  }

  // Yoki lug'at juda tor bo'lsa (bir xil so'zlar aylanib yuribdi)
  const uniqueRatio = new Set(words).size / words.length
  return worst >= 4 || uniqueRatio < 0.3
}

type MarketPlan = {
  bozor: string
  raqobat: string[]
  sotuv: string[]
  reja: { kun: number; mavzu: string; format: string; platforma: string; vaqt?: string; maqsad?: string }[]
}

type Generated = {
  sarlavha: string
  matn: string
  hashtaglar: string[]
  /** Faqat describe uchun: AI rasmda nima ko'rganini yozadi */
  tasvir?: string
  /** Faqat describe uchun: rasm/video nima haqida ekani */
  mazmun?: string
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

      // MUHIM: bu yerda platformadagi BLOGERLAR statistikasi (oylik
      // ko'rishlar, viloyatlar soni) berilmaydi. Ilgari berilardi va AI
      // uni ulangan hisoblarning natijasi deb o'ylab, "kuchli tomon"
      // sifatida ko'rsatardi — aslida ular boshqa narsa.
      const prompt = `Sen "Agro Alliance" ning SMM strategisisan.

ULANGAN IJTIMOIY TARMOQLAR VA ULARNING HOLATI:
${connLine}
JOYLASH NATIJALARI (oxirgi 20 ta): ${okCount} muvaffaqiyatli, ${failCount} xato

SHU PANEL ORQALI YOZILGAN OXIRGI POSTLAR:
${recentLine}

Vazifa: keyingi 1 hafta uchun ijtimoiy tarmoq kontenti bo'yicha tavsiya ber.

QAT'IY QOIDALAR:
- FAQAT yuqoridagi ulangan tarmoqlar raqamlaridan foydalan
- Boshqa hech qanday raqamni ishlatma va o'ylab topma
- Ulanmagan tarmoq uchun tavsiya berma
Auditoriya — O'zbekistondagi fermerlar, dehqonlar, chorvadorlar va agro kompaniyalar.
Til — o'zbek tili.

Tahlilni yuqoridagi RAQAMLARGA asosla. Umumiy gap yozma — qaysi son
nimani ko'rsatayotganini ayt.

FAQAT JSON qaytar, boshqa matn yozma:
{
  "holat": "ulangan tarmoqlar raqamlariga asoslangan 2-3 jumlalik tahlil",
  "kuchli": ["ulangan tarmoqlarda nima yaxshi ishlayapti — aniq raqam bilan"],
  "zaif": ["ulangan tarmoqlarda nima yomon — aniq raqam bilan"],
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
        if (!o || typeof o !== "object" || typeof o.matn !== "string" || !o.matn.trim()) return false
        // Juda uzun yoki o'zini takrorlaydigan javobni qabul qilmaymiz —
        // keyingi provayder yaxshiroq yozishi mumkin
        if (o.matn.length > 2500) return false
        return !isRepetitive(o.matn)
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

      // Videoda mijoz KADR yuboradi (base64). Butun videoni yuborish
      // juda ko'p token yeydi va bepul kvota darhol tugaydi. Kadr esa
      // oddiy rasm — har qanday ko'ruvchi model uni o'qiy oladi.
      const b64 = String(body.image_b64 || "").trim()
      let image: InlineImage
      let fromVideoFrame = false

      if (b64) {
        image = { mimeType: String(body.mime || "image/jpeg"), data: b64 }
        fromVideoFrame = Boolean(body.from_video)
      } else {
        if (!imageUrl) return errorResponse("Avval rasm yoki video yuklang", 400)
        try {
          image = await fetchInlineImage(imageUrl)
        } catch (e) {
          return errorResponse(e instanceof Error ? e.message : "Faylni o'qib bo'lmadi", 400)
        }
      }
      const isVideo = fromVideoFrame || image.mimeType.startsWith("video/")
      const what = isVideo ? "videoni" : "rasmni"

      // MUHIM: "tasvir" maydoni — AI rasmda AYNAN nima ko'rganini
      // yozadi. Usiz model rasmni ko'rmasa ham chiroyli post to'qib
      // beraverardi va buni bilib bo'lmasdi. Endi ko'rmasa "KO'RINMADI"
      // deb yozishi shart va biz keyingi provayderga o'tamiz.
      const src = isVideo ? "videodan olingan kadr" : "rasm"
      const prompt = `Sen "Agro Alliance" agro-media platformasi uchun kontent yozuvchisan.

Yuqorida ${src} berilgan. Uch bosqichda ishla.

1) KO'R: unda aynan nima ko'rinyapti — narsalar, odamlar, joy,
   yozuvlar bo'lsa o'sha yozuvlar. Taxmin qilma.
   Agar ${src}ni umuman ko'rmasang yoki o'qiy olmasang, "tasvir"
   maydoniga faqat KO'RINMADI deb yoz, qolganini bo'sh qoldir.

2) TUSHUN: bu ${src} NIMA HAQIDA? Gap nima ustida ketyapti,
   nima taklif qilinyapti yoki nima ko'rsatilyapti? Buni "mazmun"
   maydoniga BITTA jumlada yoz.

3) YOZ: shu mazmunni odamlarga yetkazadigan post yoz.

POST QOIDALARI — qat'iy:
- QISQA: 2-4 jumla, 400 belgidan oshmasin
- Birinchi jumlada asosiy fikr bo'lsin
- Faqat ${src}da BOR narsa haqida yoz. Yo'q narsani qo'shma
- "Zamonaviy texnologiyalar", "hosildorlikni oshiring" kabi umumiy
  shiorlarni YOZMA — aniq gapir
- Reklama ohangida emas, odam gapiradigandek yoz

PLATFORMA: ${platform}
Auditoriya — O'zbekistondagi fermerlar, dehqonlar, chorvadorlar.
Til — o'zbek tili (lotin alifbosi).

FAQAT JSON qaytar, boshqa matn yozma:
{
  "tasvir": "nima ko'rinyapti (1-2 jumla)",
  "mazmun": "nima haqida, nima taklif qilinyapti (1 jumla)",
  "sarlavha": "qisqa sarlavha, 60 belgigacha",
  "matn": "post matni, 2-4 jumla",
  "hashtaglar": ["#agro", "#fermer"]
}`

      /** Javob haqiqatan rasmga asoslanganmi? */
      const saw = (r: Generated | undefined) => {
        const t = String(r?.tasvir || "").trim()
        if (!t) return false
        if (/ko'rinmadi|korinmadi|ko‘rinmadi/i.test(t)) return false
        // "rasm yo'q", "men rasmni ko'ra olmayman" kabi rad javoblari
        if (/(ko'r|kor)\w*\s+(olmayman|olmadim)|rasm\s+(yo'q|yoq)|no image|cannot see/i.test(t)) return false
        return true
      }

      // Ko'ruvchi provayderlar. NVIDIA ikki xil formatda sinaladi:
      // ba'zi VLM modellari OpenAI'ning image_url qismini tushunmaydi.
      const attempts = [
        { name: "Gemini", run: () => geminiJson<Generated>(prompt, { retries: 1, maxTokens: 2048, image }) },
        { name: "NVIDIA", run: () => nimJson<Generated>(prompt, { retries: 0, maxTokens: 2048, image }) },
        { name: "NVIDIA(inline)", run: () => nimJson<Generated>(prompt, { retries: 0, maxTokens: 2048, image, imageStyle: "inline" as const }) },
      ]

      const errs: string[] = []
      for (const a of attempts) {
        try {
          const result = await a.run()
          if (!result?.matn?.trim()) { errs.push(`${a.name}: bo'sh javob`); continue }
          if (isRepetitive(result.matn)) { errs.push(`${a.name}: matn takrorlanib ketdi`); continue }
          if (!saw(result)) {
            // Rasmni ko'rmagan — bu javobni ISHLATMAYMIZ, aks holda
            // aloqasiz matn chiqadi.
            errs.push(`${a.name}: rasmni ko'ra olmadi`)
            continue
          }
          return jsonResponse({ generated: result })
        } catch (e) {
          errs.push(`${a.name}: ${e instanceof Error ? e.message : "xatolik"}`)
        }
      }
      return errorResponse(errs.join(" | "), 500)
    }

    /* ---------------- SUHBAT ---------------- */
    // Tahlildan keyin savol berish uchun. Har safar tarmoq raqamlari
    // qayta yuboriladi — AI oldingi javobini eslamaydi, kontekst
    // so'rov ichida bo'lishi shart.
    if (action === "chat") {
      const raw = Array.isArray(body.messages) ? body.messages : []
      // Oxirgi 8 ta xabar yetadi: uzun tarix tokenni behuda yeydi
      const history = raw
        .slice(-8)
        .filter((m: unknown) => m && typeof (m as { content?: unknown }).content === "string")
        .map((m: { role?: string; content: string }) => ({
          role: m.role === "ai" ? "AI" : "Foydalanuvchi",
          content: String(m.content).slice(0, 1500),
        }))
      if (!history.length) return errorResponse("Savol yozing", 400)

      const nets = await gatherNetworks()
      const ctx = nets.length
        ? nets.map((n) => {
            if (n.error) return `${n.platform} (${n.name}) — xato: ${n.error}`
            const parts = [
              n.followers !== null ? `${n.followers} obunachi` : null,
              n.posts !== null ? `${n.posts} post` : null,
              n.avgLikes !== null ? `o'rtacha ${n.avgLikes} layk` : null,
              n.avgComments !== null ? `${n.avgComments} izoh` : null,
            ].filter(Boolean)
            return `${n.platform} (${n.name}): ${parts.join(", ") || "ma'lumot yo'q"}`
          }).join("\n")
        : "(hech qaysi tarmoq ulanmagan)"

      const dialog = history.map((m) => `${m.role}: ${m.content}`).join("\n\n")

      const prompt = `Sen "Agro Alliance" agro-media platformasining SMM maslahatchisisan.

TARMOQLAR HOLATI:
${ctx}

SUHBAT:
${dialog}

Oxirgi savolga javob ber. Qoidalar:
- O'zbek tilida (lotin alifbosi), sodda va qisqa yoz
- Yuqoridagi RAQAMLARGA asoslan, umumiy maslahat berma
- Ma'lumot yetarli bo'lmasa buni ochiq ayt, o'ylab topma
- 150 so'zdan oshirma
- JSON emas, oddiy matn yoz`

      const answer = await askText(prompt)
      return jsonResponse({ answer })
    }

    /* ---------------- RASM YARATISH ---------------- */
    // Post matni asosida rasm chizadi.
    //
    // Ikki bosqich: avval matn modeli o'zbekcha matndan INGLIZCHA
    // tasvir so'rovi yasaydi, keyin rasm modeli chizadi. Rasm modellari
    // ingliz tilida ancha yaxshi ishlaydi — o'zbekcha so'rovda natija
    // tasodifiy chiqadi.
    if (action === "image") {
      const text = String(body.text || "").trim()
      const aspect = (String(body.aspect || "16:9")) as GenAspect
      if (!text) return errorResponse("Avval post matnini yozing", 400)

      let imgPrompt = ""
      try {
        imgPrompt = await askText(`Quyidagi o'zbekcha post matni uchun rasm so'rovi (image prompt) yoz.

POST:
${text.slice(0, 800)}

Qoidalar:
- INGLIZ tilida yoz
- Faqat so'rovning o'zini yoz, boshqa hech narsa yozma
- Fotosurat uslubida: real, tabiiy yorug'lik
- O'zbekiston qishloq xo'jaligi muhiti
- Matn, yozuv, logotip BO'LMASIN
- 40 so'zdan oshmasin`)
      } catch (e) {
        return errorResponse(`Rasm so'rovi tayyorlanmadi — ${e instanceof Error ? e.message : "xatolik"}`, 500)
      }

      // Model ba'zan izoh qo'shib yuboradi — birinchi qatorni olamiz
      imgPrompt = imgPrompt.split("\n")[0].replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 400)
      if (!imgPrompt) return errorResponse("Rasm so'rovi bo'sh chiqdi", 500)

      try {
        const img = await nimImage(imgPrompt, aspect)
        return jsonResponse({ image_b64: img.data, prompt: imgPrompt, model: img.model })
      } catch (e) {
        return errorResponse(e instanceof Error ? e.message : "Rasm yaratilmadi", 500)
      }
    }

    /* ---------------- MARKETING TAHLILI ---------------- */
    // O'z hisoblarimiz + raqobatchilar + (kalit bo'lsa) veb tendensiyalari
    // -> sotuvni oshirish yo'llari va kunlik kontent reja.
    if (action === "market") {
      const days = [7, 14, 30].includes(Number(body.days)) ? Number(body.days) : 7

      // Raqobatchilarni har safar qaytadan qidirish qimmat: 20 ta nomzod
      // + 20 ta Graph so'rovi. Ro'yxat yangi bo'lsa saqlangani ishlatiladi,
      // bir haftadan eski bo'lsa qaytadan qidiriladi.
      const WEEK = 7 * 24 * 60 * 60 * 1000
      const { data: freshest } = await supabaseAdmin
        .from("smm_competitors")
        .select("checked_at")
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      const stale =
        !freshest?.checked_at ||
        Date.now() - new Date(freshest.checked_at).getTime() > WEEK
      const needDiscovery = stale || Boolean(body.rediscover)

      // Uchala manba parallel — ketma-ket bo'lsa javob juda cho'ziladi.
      // Qayta qidirish kerak bo'lsa saqlanganini tekshirish behuda ish.
      const [nets, savedComps, hits] = await Promise.all([
        gatherNetworks(),
        needDiscovery ? Promise.resolve([]) : gatherCompetitors(),
        webTrends("O'zbekiston qishloq xo'jaligi fermerlar 2026 tendensiya narx"),
      ])

      let comps = savedComps
      if (!comps.length) {
        const found = await discoverCompetitors()
        if (found.length) comps = found
      }

      const ownLine = nets.length
        ? nets.map((n) => {
            if (n.error) return `${n.platform} (${n.name}) — xato: ${n.error}`
            const parts = [
              n.followers !== null ? `${n.followers} obunachi` : null,
              n.posts !== null ? `${n.posts} post` : null,
              n.avgLikes !== null ? `o'rtacha ${n.avgLikes} layk` : null,
            ].filter(Boolean)
            return `${n.platform} (${n.name}): ${parts.join(", ") || "ma'lumot yo'q"}`
          }).join("\n")
        : "(hech qaysi tarmoq ulanmagan)"

      const compLine = comps.length
        ? comps.map((c) => {
            if (c.error) return `@${c.username} — ${c.error}`
            const parts = [
              c.followers !== null ? `${c.followers} obunachi` : null,
              c.avgLikes !== null ? `o'rtacha ${c.avgLikes} layk` : null,
              c.avgComments !== null ? `${c.avgComments} izoh` : null,
            ].filter(Boolean)
            const posts = c.recent.length
              ? ` | Oxirgi postlari: ${c.recent.slice(0, 5).map((r) => `"${r.text.slice(0, 60)}" (${r.likes ?? "?"} layk)`).join("; ")}`
              : ""
            return `@${c.username}: ${parts.join(", ")}${posts}`
          }).join("\n")
        : "(raqobatchi qo'shilmagan)"

      const webLine = hits.length
        ? hits.map((h) => `- ${h.title}: ${h.snippet.slice(0, 160)}`).join("\n")
        : "(veb qidiruv sozlanmagan)"

      const prompt = `Sen O'zbekiston agro bozorida ishlaydigan marketolog va SMM strategisisan.

BIZNING HISOBLARIMIZ:
${ownLine}

RAQOBATCHILAR:
${compLine}

VEB TENDENSIYALARI:
${webLine}

Vazifa: yuqoridagi ma'lumotlarni tahlil qilib, ${days} kunlik kontent reja tuz.

QAT'IY QOIDALAR:
- FAQAT yuqoridagi raqamlar va faktlardan foydalan
- Ma'lumot yetarli bo'lmagan joyda buni ochiq ayt, raqam o'ylab topma
- Raqobatchi ma'lumoti yo'q bo'lsa taqqoslash qilma
- Har bir tavsiya nima uchun kerakligini raqam bilan asosla
- Auditoriya: O'zbekistondagi fermerlar, dehqonlar, chorvadorlar va agro kompaniyalar
- Til: o'zbek tili (lotin alifbosi), sodda

FAQAT JSON qaytar, boshqa matn yozma:
{
  "bozor": "bozor holati va bizning o'rnimiz haqida 2-3 jumla",
  "raqobat": ["raqobatchilardan o'rganish mumkin bo'lgan aniq narsa"],
  "sotuv": ["sotuvni oshirish uchun aniq qadam — nima qilish va nega"],
  "reja": [
    { "kun": 1, "mavzu": "aniq mavzu", "format": "post|video|karusel|storis", "platforma": "telegram|instagram|facebook", "vaqt": "18:00", "maqsad": "bu post nimaga xizmat qiladi" }
  ]
}
"reja" ichida ${days} ta element bo'lsin, kun 1 dan ${days} gacha.`

      const rawPlan = await askAi<unknown>(prompt, (v) => {
        const o = v as { reja?: unknown }
        return Boolean(o && typeof o === "object" && Array.isArray(o.reja) && o.reja.length > 0)
      })
      const result = normalizePlan(rawPlan)
      if (!result.reja.length) return errorResponse("AI reja tuza olmadi — qaytadan urining", 500)

      // Rejani saqlaymiz — panel qayta so'ramasdan ko'rsata olsin
      await supabaseAdmin.from("smm_plans").insert({
        data: { ...result, networks: nets, competitors: comps, web: hits },
        days,
        created_by: auth.user.id,
      })

      return jsonResponse({ plan: result, networks: nets, competitors: comps, web: hits })
    }

    if (action === "last_plan") {
      const { data } = await supabaseAdmin
        .from("smm_plans")
        .select("data, days, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      return jsonResponse({ last: data || null })
    }

    return errorResponse("Noma'lum amal", 400)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xatolik"
    return errorResponse(msg, 500)
  }
})
