import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { geminiJson, geminiChat, type InlineImage } from "../_shared/gemini.ts"
import { groqJson, groqChat } from "../_shared/groq.ts"
import { nimJson, nimChat } from "../_shared/nim.ts"
import { nimImage, type GenAspect } from "../_shared/nimImage.ts"
import { transcribeVideo, transcribeAvailable } from "../_shared/transcribe.ts"
import { webTrends } from "../_shared/market.ts"
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
/**
 * Kaliti sozlanmagan provayderni sinash behuda — vaqt yeydi va
 * baribir yiqiladi.
 */
function hasKey(name: string): boolean {
  if (name === "Groq") return Boolean(Deno.env.get("GROQ_API_KEY"))
  if (name === "Gemini") return Boolean(Deno.env.get("GEMINI_API_KEY"))
  if (name === "NVIDIA") return Boolean(Deno.env.get("NVIDIA_API_KEY"))
  return true
}

/**
 * Har provayderga alohida chegara. Bir xil emas:
 * Groq tez javob beradi, NVIDIA'ning 70B modeli sekinroq va 22
 * soniyada "Signal timed out" bilan uzilib qolardi.
 */
const PROVIDER_TIMEOUT: Record<string, number> = {
  Groq: 20_000,
  Gemini: 15_000,
  NVIDIA: 45_000,
}
const TIMEOUT_FOR = (name: string) => PROVIDER_TIMEOUT[name] ?? 25_000

/**
 * AI so'ralgan obyektni har xil o'rab qaytaradi:
 *   [{...}]            — massiv ichida
 *   [{...}, {...}]     — bir nechta variant
 *   {"post": {...}}    — kalit ostida
 *
 * Tekshiruv obyekt kutgani uchun bularning hammasi rad etilardi,
 * holbuki ichidagi ma'lumot to'g'ri edi. Endi kerakli maydoni bor
 * obyekt qidirib topiladi.
 */
function unwrap(v: unknown, keys: string[] = [], depth = 0): unknown {
  const has = (o: unknown) =>
    Boolean(o && typeof o === "object" && !Array.isArray(o) &&
      (keys.length === 0 || keys.some((k) => k in (o as Record<string, unknown>))))

  if (has(v)) return v
  // Chuqurlik cheklangan — cheksiz rekursiyaga tushib qolmaslik uchun
  if (depth > 3 || !v || typeof v !== "object") return v

  const children = Array.isArray(v) ? v : Object.values(v as Record<string, unknown>)
  for (const c of children) {
    const found = unwrap(c, keys, depth + 1)
    if (has(found)) return found
  }

  // Mos maydonli obyekt topilmadi — hech bo'lmasa birinchi obyektni
  // qaytaramiz, tekshiruv o'zi hukm qiladi
  if (Array.isArray(v) && v.length && v[0] && typeof v[0] === "object") return v[0]
  return v
}

async function askAi<T>(
  prompt: string,
  validate: (v: unknown) => boolean,
  maxTokens = 3500,
  /** Javobda bo'lishi kerak bo'lgan maydonlar — o'rashni ochish uchun */
  keys: string[] = [],
  /**
   * Yumshoq tekshiruv: qat'iy tekshiruvdan o'tmagan, lekin YAROQLI javob.
   * Hech bir provayder qat'iy shartni bajarmasa, xato o'rniga shu javob
   * qaytariladi — bo'sh ekrandan ko'ra biroz nomukammal matn yaxshiroq.
   */
  soft?: (v: unknown) => boolean,
): Promise<T> {
  const errs: string[] = []
  let softHit: unknown = null

  // Uchta provayder: biri kvotasi tugasa keyingisi ishlaydi.
  // Groq birinchi — uning bepul chegarasi eng keng.
  for (const [name, fn] of [
    ["Groq", groqJson],
    ["Gemini", geminiJson],
    ["NVIDIA", nimJson],
  ] as const) {
    if (!hasKey(name)) { errs.push(`${name}: kalit yo'q`); continue }
    try {
      // retries: 0 — bir provayderni qayta sinash o'rniga darhol
      // keyingisiga o'tamiz. Zanjirning o'zi zaxira vazifasini bajaradi
      // va uch provayder x ikki urinish 90 soniyadan oshib ketardi.
      const raw = unwrap(await fn<unknown>(prompt, { retries: 0, maxTokens, timeoutMs: TIMEOUT_FOR(name) }), keys)
      // MUHIM: AI javob bergani yetarli emas — kutilgan maydonlar bormi?
      // Ilgari tekshirilmasdi, shuning uchun noto'g'ri shakl kelsa ekranda
      // xatosiz BO'SH quti chiqardi va sabab noma'lum bo'lardi.
      if (validate(raw)) return raw as T
      if (!softHit && soft?.(raw)) softHit = raw
      const peek = JSON.stringify(raw).slice(0, 200)
      errs.push(`${name}: kutilmagan javob — ${peek}`)
    } catch (e) {
      errs.push(`${name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (softHit) return softHit as T
  // Uzun xato matni ekranni to'ldirib yuboradi — har provayderdan
  // qisqacha sabab yetarli
  throw new Error(errs.map((e) => e.slice(0, 140)).join(" | "))
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
    if (!hasKey(name)) { errs.push(`${name}: kalit yo'q`); continue }
    try {
      const { text } = await fn(prompt, { retries: 0, maxTokens: 1500, timeoutMs: TIMEOUT_FOR(name) })
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

/**
 * Post matnidan INGLIZCHA rasm so'rovi yasaydi.
 *
 * Nega ingliz tilida: rasm modellari o'zbekcha so'rovda tasodifiy
 * natija beradi. Nega alohida funksiya: rasm ham, video ham shu
 * so'rovdan boshlanadi (video rasmdan yasaladi).
 */
async function buildImagePrompt(text: string): Promise<string> {
  // JSON so'raymiz, erkin matn emas. Ilgari askText ishlatilardi va
  // model javob oldiga "Here is the image prompt:" kabi kirish so'zi
  // qo'shsa, birinchi qator o'sha kirish bo'lib qolardi — natijada
  // rasm mavzuga umuman aloqasiz chiqardi.
  const res = await askAi<{ prompt?: string; subject?: string }>(
    `Quyidagi o'zbekcha post uchun rasm so'rovi (image prompt) yoz.

POST:
${text.slice(0, 800)}

Ikki bosqich:
1) "subject" — POSTDAGI asosiy MODDIY narsani ingliz tilida 2-4 so'z
   bilan yoz. Postda nima haqida gap ketsa — o'sha.
   Mavhum tushuncha YOZMA: "convenience", "efficiency", "partnership".
2) "prompt" — shu subject asosida to'liq rasm so'rovi.

"prompt" QAT'IY QOIDALARI:
- SUBJECT SO'ROVNING BOSHIDA turishi shart va kadrni EGALLASHI kerak.
  Odamni birinchi qo'ysang, u kadrni egallab, asosiy narsa
  ko'rinmay qoladi.
- Subject odam bo'lmasa, so'rovni "close-up" yoki "detailed view"
  bilan boshla va odam qo'shma
- INGLIZ tilida
- photorealistic, natural light, sharp focus
- O'zbekiston/Markaziy Osiyo qishloq xo'jaligi muhiti
- Matn, yozuv, logotip bo'lmasin
- 40 so'zdan oshmasin

FAQAT JSON qaytar:
{ "subject": "…", "prompt": "…" }`,
    (v) => {
      const o = v as { prompt?: unknown }
      const p = typeof o?.prompt === "string" ? o.prompt.trim() : ""
      if (p.length < 20 || p.length > 400) return false
      if (leaksInstructions(p)) return false
      // Ingliz tilida bo'lishi shart — o'zbekcha so'rovda rasm
      // modellari tasodifiy natija beradi
      const latin = (p.match(/[a-z]/gi) || []).length
      return latin / p.length > 0.6
    },
    600,
    ["prompt"],
  )

  let prompt = String(res.prompt || "").trim().slice(0, 400)
  const subject = String(res.subject || "").toLowerCase()

  /**
   * Model qoidani unutib, so'rovga odam qo'shib yuboradi va o'shanda
   * odam kadrni egallab, asosiy narsa ko'rinmay qoladi.
   *
   * Subject odam haqida bo'lmasa — buni SO'ROV ICHIDA taqiqlaymiz.
   * negative_prompt ishlatib bo'lmaydi: FLUX uni qabul qilmaydi.
   */
  const aboutPeople = /farmer|people|person|worker|man|woman|child|hand/.test(subject)
  if (!aboutPeople && !/no people/i.test(prompt)) {
    prompt = `${prompt}, no people in frame`
  }

  return prompt.slice(0, 400)
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

/**
 * Matn faqat sarlavhalardan iborat quruq ro'yxatmi?
 *
 * Kichik modellar mavzuni "1. Texnologiya 2. Hamkorlik 3. Savdo" kabi
 * ma'nosiz ro'yxat bilan yopib qo'yadi. Bunday post odamga hech narsa
 * bermaydi, lekin uzunligi yetarli bo'lgani uchun tekshiruvdan o'tardi.
 */
function isSkeletonList(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  if (lines.length < 3) return false
  // Raqam yoki belgi bilan boshlanadigan, lekin jumla bo'lmagan qatorlar
  const stubs = lines.filter((l) => {
    if (!/^([0-9]+[.)]|[-•*])\s/.test(l)) return false
    const body = l.replace(/^([0-9]+[.)]|[-•*])\s*/, "")
    // Qisqa va tinish belgisi yo'q — ya'ni sarlavha, jumla emas
    return body.length < 45 && !/[.!?]/.test(body)
  })
  return stubs.length >= 3 && stubs.length >= lines.length * 0.4
}

/**
 * Matn odam o'qiydigan jumlaga o'xshaydimi?
 *
 * AI ba'zan matn maydoniga raqam yoki kalit-qiymat qaytaradi. Normalizator
 * ularni birlashtirganda "0. 3. 0. 2. 0" kabi bema'nilik hosil bo'lardi —
 * xatosiz, lekin foydasiz.
 */
function looksLikeSentence(t: string): boolean {
  const s = (t || "").trim()
  if (s.length < 40) return false
  const words = s.split(/\s+/).filter((w) => /\p{L}{3,}/u.test(w))
  return words.length >= 8
}

/**
 * Javobga so'rovning O'ZI sizib chiqqanmi?
 *
 * NEGA: kichik modellar ko'rsatmadagi namunani mavzu haqida o'ylash
 * o'rniga shundoq ko'chirib qo'yadi. Postda "<narsa> <qancha> foyda
 * beradi" degan bo'sh o'rinlar chiqib qolgan edi. Namunalar so'rovdan
 * olib tashlandi, bu esa ikkinchi qavat: bunday matnni qabul qilmaymiz.
 *
 * Burchakli qavs ichidagi so'z HTML tegi bo'lsa ruxsat — matn muharriri
 * <b>, <li> kabi teglarni haqiqatan ishlatadi.
 */
const HTML_TAGS = new Set([
  "b", "i", "u", "s", "em", "strong", "strike", "br", "p", "a",
  "ul", "ol", "li", "div", "span", "h1", "h2", "h3", "blockquote", "code",
])
/**
 * Matn media'ni TASVIRLAYAPTIMI? Bizga tayyor post kerak, "bu videoda
 * ... ko'rsatilgan" degan tavsif emas.
 */
function describesMedia(text: string): boolean {
  return /videoda|videoni|videoning|videodagi|bu\s+video|ushbu\s+video|mazkur\s+video|klipda|kadrda|bu\s+rasmda|rasmda\s+ko|suratda|tasvirda\s+ko/i.test(text || "")
}

function leaksInstructions(text: string): boolean {
  const t = text || ""
  for (const m of t.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9']{0,20})\s*\/?>/g)) {
    if (!HTML_TAGS.has(m[1].toLowerCase())) return true
  }
  return /\b(?:QOIDALARI|image prompt|yaxshi uslub|yomon uslub)\b|MAVZU:|PLATFORMA:|FAQAT JSON/i.test(t)
}

/**
 * Yozilgan matn so'ralgan MAVZU haqidami?
 *
 * NEGA KERAK: kichik modellar mavzuni e'tiborsiz qoldirib, so'rovdagi
 * MISOLNI ko'chirib qo'yadi. Marketing rejasida "Qiziqarli hikoyalar"
 * bosilganda post "tomchilatib sug'orish" haqida chiqib qolgan edi —
 * chunki misolda aynan shu yozilgandi. Misol tuzatildi, bu esa
 * ikkinchi qavat himoya: mavzuga aloqasiz matnni qabul qilmaymiz.
 *
 * O'zbek tilida qo'shimchalar ko'p (hikoya -> hikoyalarni), shuning
 * uchun so'zning O'ZAGI (dastlabki 5 harfi) bo'yicha solishtiramiz.
 */
function matchesTopic(topic: string, text: string): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ")
  const stems = norm(topic).split(/\s+/).filter((w) => w.length >= 5).map((w) => w.slice(0, 5))
  if (!stems.length) return true // mavzu juda qisqa — tekshirib bo'lmaydi
  const body = norm(text)
  return stems.some((st) => body.includes(st))
}

function normalizePlan(raw: unknown): MarketPlan {
  const o = (raw || {}) as Record<string, unknown>
  const reja = Array.isArray(o.reja) ? o.reja : []
  return {
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
      }, 3500, ["tavsiyalar", "holat"])
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
Til — o'zbek tili (lotin alifbosi). Ohang — foydali, sodda, ishonchli.

MATN QOIDALARI — qat'iy:
- FAQAT yuqoridagi MAVZU haqida yoz. Boshqa mavzuga o'tib ketma.
- Bu ko'rsatmalarning o'zini javobga ko'chirma. Javobda faqat
  o'quvchiga qaratilgan tayyor post bo'lsin.
- TO'LIQ JUMLALAR yoz. Faqat sarlavhalardan iborat ro'yxat YOZMA.
- Ro'yxat ishlatsang, HAR BAND kamida bitta to'liq jumla bo'lsin
- Aniq gapir: raqam, muddat, usul nomi, narsalarning nomi
- Kamida 3 ta mazmunli jumla bo'lsin
- "Qulaylik yaratish", "samaradorlikni oshirish" kabi bo'sh iboralarni
  ishlatma — nima qilinishini aniq yoz
- Reklama shiori emas, foydali maslahat

FAQAT JSON qaytar, boshqa matn yozma:
{
  "sarlavha": "qisqa sarlavha",
  "matn": "postning to'liq matni",
  "hashtaglar": ["#agro", "#fermer"]
}`

      // Yumshoq shart: matn yaroqli, lekin mavzuga mos kelmasligi mumkin
      const usable = (v: unknown) => {
        const o = v as Generated
        if (!o || typeof o !== "object" || typeof o.matn !== "string" || !o.matn.trim()) return false
        // Juda uzun yoki o'zini takrorlaydigan javobni qabul qilmaymiz —
        // keyingi provayder yaxshiroq yozishi mumkin
        if (o.matn.length > 2500) return false
        // Juda qisqa yoki quruq ro'yxat bo'lsa keyingi provayder yozsin
        if (o.matn.trim().length < 120) return false
        if (isSkeletonList(o.matn)) return false
        if (leaksInstructions(o.matn)) return false
        return !isRepetitive(o.matn)
      }

      const result = await askAi<Generated>(
        prompt,
        // Qat'iy shart: yaroqli VA mavzuga mos
        (v) => usable(v) && matchesTopic(topic, `${(v as Generated).sarlavha || ""} ${(v as Generated).matn}`),
        3500,
        ["matn", "sarlavha"],
        usable,
      )
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

      // VIDEO uchun: ovozdan olingan matn (transcript) berilsa, postni
      // AYNAN videoda gapirilgani asosida yozamiz. Bu bitta kadrni
      // ko'rishdan ancha aniq — video mazmuni ko'pincha gapda bo'ladi.
      const transcript = String(body.transcript || "").trim()
      if (transcript) {
        const tPrompt = `Sen "Agro Alliance" ning tajribali SMM mutaxassisisan.
Quyida videoning ovozidan olingan matn (mavzu) bor. Shu MAVZU bo'yicha
${platform} uchun tayyor post yoz — xuddi odam o'z sahifasiga qo'yadigan
jonli, qiziqarli post.

VIDEO MAVZUSI:
"""
${transcript.slice(0, 4000)}
"""

ENG MUHIM:
- Videoning ANIQ MAVZUSINI aniqla (masalan "issiqxona qurish",
  "tomchilatib sug'orish", "urug' sotish") va post AYNAN shu haqda
  bo'lsin. Umumiy "qishloq xo'jaligini rivojlantiramiz", "biz bilan
  ishlang", "mahsulotingizni eksport qiling" kabi HECH NARSA
  demaydigan gaplarni YOZMA.
- Video matnidagi ANIQ narsalarni ishlat: taklif qilinayotgan xizmat/
  mahsulot nomi, aniq foyda, raqam, shart bo'lsa — o'shalarni yoz.
- Videoni TASVIRLAMA ("bu videoda", "videoда ko'rsatilgan" ISHLATMA).
  Go'yo o'zing shu xizmatni taklif qilayotgandek yoz.
- Jozibali boshla (hook), aniq foyda ayt, oxirida yengil harakatga
  undash (masalan "batafsil — profilda").

QOIDALAR:
- QISQA: 2-4 jumla, 500 belgidan oshmasin
- Aniq va tabiiy, quruq shior emas
- O'zbek tili (lotin alifbosi), odam gapiradigandek

FAQAT JSON:
{ "mazmun": "mavzu bir jumlada (o'zingga eslatma)", "sarlavha": "qisqa sarlavha 60 belgigacha", "matn": "tayyor post matni, videoni tasvirlamasdan", "hashtaglar": ["#agro","#fermer"] }`

        // Videoni TASVIRLAYDIGAN matnni rad etamiz — bizga tayyor post
        // kerak, "bu videoda ... ko'rsatilgan" degan tavsif emas.
        const usableT = (v: unknown) => {
          const o = v as Generated
          const m = String(o?.matn || "")
          return Boolean(m.trim().length >= 40 && !isRepetitive(m) && !describesMedia(m))
        }
        try {
          const res = await askAi<Generated>(tPrompt,
            (v) => usableT(v) && matchesTopic(transcript.slice(0, 400), String((v as Generated).matn)),
            2048, ["matn", "sarlavha"], usableT)
          return jsonResponse({ generated: { ...res, tasvir: "", mazmun: (res as Generated).mazmun || "" } })
        } catch (e) {
          return errorResponse(e instanceof Error ? e.message : "Videodan matn yozib bo'lmadi", 500)
        }
      }

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

3) YOZ: shu MAVZU bo'yicha odam o'z sahifasiga qo'yadigan JONLI post yoz.

POST QOIDALARI — qat'iy:
- ${src}ni TASVIRLAMA. "Bu rasmda", "${src}da ko'rsatilgan",
  "... turibdi", "logotip ko'rinyapti" kabi TASVIR iboralari MUTLAQO
  ISHLATMA. Nima ko'rganingni emas, o'sha MAVZU haqida gapir.
- O'quvchiga qaratilgan tayyor post: jozibali boshlanish, foydali gap,
  oxirida yengil harakatga undash.
- QISQA: 2-4 jumla, 400 belgidan oshmasin
- Aniq gapir. "Zamonaviy texnologiyalar", "hosildorlikni oshiring" kabi
  quruq shiorlarni yozma
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
        if (/ko'rinma|korinma|ko‘rinma/i.test(t)) return false
        // "rasm yo'q", "men rasmni ko'ra olmayman" kabi rad javoblari
        if (/(ko'r|kor)\w*\s+(olmayman|olmadim)|rasm\s+(yo'q|yoq)|no image|cannot see/i.test(t)) return false
        return true
      }

      // Ko'ruvchi provayderlar. NVIDIA ikki xil formatda sinaladi:
      // ba'zi VLM modellari OpenAI'ning image_url qismini tushunmaydi.
      const attempts = [
        { name: "Gemini", run: () => geminiJson<Generated>(prompt, { retries: 0, maxTokens: 2048, image, timeoutMs: TIMEOUT_FOR("Gemini") }) },
        { name: "NVIDIA", run: () => nimJson<Generated>(prompt, { retries: 0, maxTokens: 2048, image, timeoutMs: TIMEOUT_FOR("NVIDIA") }) },
        { name: "NVIDIA(inline)", run: () => nimJson<Generated>(prompt, { retries: 0, maxTokens: 2048, image, imageStyle: "inline" as const, timeoutMs: TIMEOUT_FOR("NVIDIA") }) },
      ]

      const errs: string[] = []
      let soft: Generated | null = null // ko'rgan, lekin tasvirlab yozgan
      for (const a of attempts) {
        try {
          const result = unwrap(await a.run(), ["matn", "tasvir"]) as Generated
          if (!result?.matn?.trim()) { errs.push(`${a.name}: bo'sh javob`); continue }
          if (isRepetitive(result.matn)) { errs.push(`${a.name}: matn takrorlanib ketdi`); continue }
          if (!saw(result)) {
            // Rasmni ko'rmagan — bu javobni ISHLATMAYMIZ, aks holda
            // aloqasiz matn chiqadi.
            errs.push(`${a.name}: rasmni ko'ra olmadi`)
            continue
          }
          // Tasvirlab yozgan bo'lsa — keyingi provayder yaxshiroq
          // yozishi mumkin. Toza javob topilmasa shu ishlatiladi.
          if (describesMedia(result.matn)) {
            if (!soft) soft = result
            errs.push(`${a.name}: media'ni tasvirlab yozdi`)
            continue
          }
          return jsonResponse({ generated: result })
        } catch (e) {
          errs.push(`${a.name}: ${e instanceof Error ? e.message : "xatolik"}`)
        }
      }
      if (soft) return jsonResponse({ generated: soft })
      return errorResponse(errs.join(" | "), 500)
    }

    /* ---------------- VIDEO MUQOVASI (AI ko'rib chizadi) ---------------- */
    // AI videoning KADRINI ko'radi, nima haqida ekanini tushunadi va
    // shu mazmunga MOS muqova rasmini FLUX bilan chizadi. Xom kadr emas —
    // videoga mos, chiroyli, yozuvsiz muqova. Ustiga sarlavha frontendда
    // yoziladi.
    if (action === "cover") {
      const b64 = String(body.image_b64 || "").trim()
      const aspect = (String(body.aspect || "16:9")) as GenAspect
      const transcript = String(body.transcript || "").trim()

      let title = ""
      let imgPrompt = ""
      const visErrs: string[] = []

      // ENG YAXSHI YO'L: videoning ovozidan olingan matn (transcript).
      // Videoда NIMA GAPIRILGANI muqova mavzusini belgilaydi — bitta
      // kadrdagi tasvirdan ancha aniq. Matn modeli ishonchli (Groq).
      if (transcript) {
        const tPrompt = `Quyida videoning OVOZIDAN olingan matn bor. Shu video uchun
jozibali muqova (thumbnail) ma'lumotini ber.

VIDEO MATNI:
"""
${transcript.slice(0, 4000)}
"""

1) "sarlavha" — video NIMA HAQIDA ekanini ochadigan qisqa, jozibali
   o'zbekcha sarlavha (lotin, 3-6 so'z). Muqova ustiga yoziladi.
2) "prompt" — shu MAVZUGA mos, INGLIZCHA rasm so'rovi (image prompt).
   Videoда gap nima ustida ketsa — o'sha narsani ko'rsatsin (masalan
   gap tomchilatib sug'orish haqida bo'lsa "close-up of drip irrigation
   tubing between crop rows"). Realistik, O'zbekiston qishloq xo'jaligi
   muhitida, yozuv/logotip yo'q, 40 so'zdan oshmasin, faqat ingliz tilida.

FAQAT JSON: { "sarlavha": "…", "prompt": "…" }`
        try {
          const r = await askAi<{ sarlavha?: string; prompt?: string }>(
            tPrompt,
            (v) => {
              const p = String((v as { prompt?: string })?.prompt || "").trim()
              const latin = (p.match(/[a-z]/gi) || []).length
              return p.length >= 15 && latin / p.length > 0.6 && !leaksInstructions(p)
            },
            500, ["prompt", "sarlavha"],
          )
          imgPrompt = String(r.prompt || "").trim().slice(0, 400)
          title = String(r.sarlavha || "").trim().slice(0, 80)
        } catch (e) {
          visErrs.push(`matn: ${e instanceof Error ? e.message : "xato"}`)
        }
      }

      // Transcript bo'lmasa (yoki muvaffaqiyatsiz) — kadrni AI KO'RADI
      if (!imgPrompt) {
        if (!b64) {
          return jsonResponse({ vision_failed: true, error: visErrs.join(" | ") || "Ma'lumot yetarli emas" })
        }
        const image: InlineImage = { mimeType: String(body.mime || "image/jpeg"), data: b64 }
        const visionPrompt = `Bu videodan olingan KADR. Uni diqqat bilan ko'r.

Vazifa: shu videoga MOS, chiroyli muqova uchun ma'lumot ber.

1) "sarlavha" — qisqa, jozibali o'zbekcha sarlavha (lotin, 5 so'zgacha).
2) "prompt" — kadrда ko'ringan ASOSIY narsani ko'rsatadigan INGLIZCHA
   rasm so'rovi. Realistik, O'zbekiston qishloq xo'jaligi muhitida,
   yozuv/logotip yo'q, 40 so'zdan oshmasin.

Kadrni umuman ko'rmasang "prompt" ni bo'sh qoldir.
FAQAT JSON: { "sarlavha": "…", "prompt": "…" }`
        for (const a of [
          { name: "Gemini", run: () => geminiJson<{ sarlavha?: string; prompt?: string }>(visionPrompt, { retries: 0, maxTokens: 500, image, timeoutMs: TIMEOUT_FOR("Gemini") }) },
          { name: "NVIDIA", run: () => nimJson<{ sarlavha?: string; prompt?: string }>(visionPrompt, { retries: 0, maxTokens: 500, image, timeoutMs: TIMEOUT_FOR("NVIDIA") }) },
          { name: "NVIDIA(inline)", run: () => nimJson<{ sarlavha?: string; prompt?: string }>(visionPrompt, { retries: 0, maxTokens: 500, image, imageStyle: "inline" as const, timeoutMs: TIMEOUT_FOR("NVIDIA") }) },
        ]) {
          try {
            const r = unwrap(await a.run(), ["prompt", "sarlavha"]) as { sarlavha?: string; prompt?: string }
            const p = String(r?.prompt || "").trim()
            const latin = (p.match(/[a-z]/gi) || []).length
            if (p.length >= 15 && latin / p.length > 0.6) {
              imgPrompt = p.slice(0, 400)
              title = String(r?.sarlavha || "").trim().slice(0, 80)
              break
            }
            visErrs.push(`${a.name}: so'rov bo'sh/o'zbekcha`)
          } catch (e) {
            visErrs.push(`${a.name}: ${e instanceof Error ? e.message : "xato"}`)
          }
        }
      }

      if (!imgPrompt) {
        // AI ko'ra olmadi — frontend xom kadrga qaytadi
        return jsonResponse({ vision_failed: true, error: visErrs.join(" | ") })
      }

      // 2) Mos muqova rasmini chizamiz
      try {
        const img = await nimImage(imgPrompt, aspect)
        return jsonResponse({ image_b64: img.data, title, prompt: imgPrompt, model: img.model })
      } catch (e) {
        return jsonResponse({ vision_failed: true, error: e instanceof Error ? e.message : "Rasm chizilmadi" })
      }
    }

    /* ---------------- VIDEO OVOZINI MATNGA ---------------- */
    // Videoning ovozini Groq Whisper bilan matnga aylantiradi. Frontend
    // buni bir marta chaqiradi va natijani describe/cover uchun ishlatadi
    // — shunday qilib videoда GAPIRILGANI mazmun sifatida ishlatiladi.
    if (action === "transcribe") {
      const videoUrl = String(body.video_url || "").trim()
      if (!videoUrl) return errorResponse("Video manzili yo'q", 400)
      if (!transcribeAvailable()) return jsonResponse({ transcript: "", error: "Groq kaliti sozlanmagan" })
      try {
        const transcript = await transcribeVideo(videoUrl)
        return jsonResponse({ transcript })
      } catch (e) {
        // Xato bo'lsa ham frontend xom kadrga tushib muqova yasay oladi
        return jsonResponse({ transcript: "", error: e instanceof Error ? e.message : "Ovozni o'qib bo'lmadi" })
      }
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
        imgPrompt = await buildImagePrompt(text)
      } catch (e) {
        return errorResponse(`Rasm so'rovi tayyorlanmadi — ${e instanceof Error ? e.message : "xatolik"}`, 500)
      }
      if (!imgPrompt) return errorResponse("Rasm so'rovi bo'sh chiqdi", 500)

      let img: { data: string; model: string }
      try {
        img = await nimImage(imgPrompt, aspect)
      } catch (e) {
        return errorResponse(e instanceof Error ? e.message : "Rasm yaratilmadi", 500)
      }
      return jsonResponse({ image_b64: img.data, prompt: imgPrompt, model: img.model })
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
        imgPrompt = await askText(`Quyidagi o'zbekcha post uchun rasm so'rovi (image prompt) yoz.

POST:
${text.slice(0, 800)}

VAZIFA: postda gap ketayotgan ANIQ NARSANI rasmga sol.

Qoidalar:
- Avval postdagi asosiy MODDIY narsani top: qaysi o'simlik, qaysi
  texnika, qaysi jarayon, qaysi joy haqida gap ketyapti
- Rasm so'rovi aynan shu narsani ko'rsatsin
- Mavhum tushunchani rasmga solma. "Qulaylik", "hamkorlik",
  "samaradorlik" — bularni chizib bo'lmaydi. Ular haqida bo'lsa,
  ularni KO'RSATADIGAN aniq sahnani tanla
- INGLIZ tilida yoz
- Faqat so'rovning o'zini yoz, boshqa hech narsa yozma
- Fotosurat uslubida: real, tabiiy yorug'lik, aniq detallar
- O'zbekiston qishloq xo'jaligi muhiti
- Matn, yozuv, logotip BO'LMASIN
- 40 so'zdan oshmasin

Misol:
Post tomchilatib sug'orish haqida -> "close-up of drip irrigation
lines watering tomato seedlings in a greenhouse, morning light,
Central Asia, photorealistic"`)
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

      // Ikki manba parallel: o'z hisoblarimiz va internet yangiliklari.
      // Raqobatchilarni qidirish olib tashlandi — u sekin edi va
      // Instagram business_discovery ko'p hisoblarni ko'ra olmasdi.
      const [nets, hits] = await Promise.all([
        gatherNetworks(),
        webTrends("O'zbekiston qishloq xo'jaligi fermerlar 2026 tendensiya narx"),
      ])

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

      const webLine = hits.length
        ? hits.map((h) => `- ${h.title}: ${h.snippet.slice(0, 160)}`).join("\n")
        : "(veb qidiruv sozlanmagan)"

      const prompt = `Sen O'zbekiston agro bozorida ishlaydigan marketolog va SMM strategisisan.

BIZNING IJTIMOIY TARMOQ HISOBLARIMIZ:
${ownLine}

INTERNETDAGI SO'NGGI YANGILIKLAR:
${webLine}

Vazifa: yangiliklarni o'qib, ${days} kunlik kontent reja tuz.

QAT'IY QOIDALAR:
- Har bir maydonga TO'LIQ JUMLA yoz. Raqam, ro'yxat yoki bo'sh
  qiymat qaytarma — bu maydonlar odam o'qishi uchun
- Yangiliklardagi mavzulardan foydalan: nima dolzarb, nima haqida
  gapirilyapti
- Bizning raqamlarimiz kichik bo'lsa buni ochiq ayt, bo'rttirma
- Ma'lumot yetarli bo'lmagan joyda buni yozib qo'y, o'ylab topma
- Auditoriya: O'zbekistondagi fermerlar, dehqonlar, chorvadorlar va
  agro kompaniyalar
- Til: o'zbek tili (lotin alifbosi), sodda

FAQAT JSON qaytar, boshqa matn yozma:
{
  "sotuv": ["sotuvni oshirish uchun aniq qadam — to'liq jumla bilan"],
  "reja": [
    { "kun": 1, "mavzu": "aniq mavzu", "format": "post|video|karusel|storis", "platforma": "telegram|instagram|facebook", "vaqt": "18:00", "maqsad": "bu post nimaga xizmat qiladi" }
  ]
}
"reja" ichida ${days} ta element bo'lsin, kun 1 dan ${days} gacha.`

      const rawPlan = await askAi<unknown>(prompt, (v) => {
        const o = v as { reja?: unknown }
        if (!o || typeof o !== "object") return false
        if (!Array.isArray(o.reja) || !o.reja.length) return false
        // Tavsiyalar jumla bo'lishi shart. Ilgari AI matn maydonlariga
        // raqam qaytarardi va ekranda "0. 3. 0. 2. 0" chiqardi.
        const sotuv = asTextList((o as { sotuv?: unknown }).sotuv)
        return sotuv.length > 0 && sotuv.some(looksLikeSentence)
      }, 3500, ["reja", "sotuv"])
      const result = normalizePlan(rawPlan)
      if (!result.reja.length) return errorResponse("AI reja tuza olmadi — qaytadan urining", 500)

      // Rejani saqlaymiz — panel qayta so'ramasdan ko'rsata olsin
      await supabaseAdmin.from("smm_plans").insert({
        data: { ...result, networks: nets, web: hits },
        days,
        created_by: auth.user.id,
      })

      return jsonResponse({ plan: result, networks: nets, web: hits })
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
