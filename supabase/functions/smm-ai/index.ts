import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { geminiJson, geminiChat, type InlineImage } from "../_shared/gemini.ts"
import { groqJson, groqChat } from "../_shared/groq.ts"
import { nimJson, nimChat } from "../_shared/nim.ts"
import { nimImage, type GenAspect } from "../_shared/nimImage.ts"
import { cfImage, cfAvailable } from "../_shared/cfImage.ts"
import { cfChat, cfJson, cfChatAvailable } from "../_shared/cfChat.ts"
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
  if (name === "Cloudflare") return cfChatAvailable()
  return true
}

/**
 * Rasmda BO'LMASLIGI kerak narsalar — negative_prompt uchun.
 * Odam TAQIQLANMAYDI: post odamlar haqida bo'lsa ular chiqishi kerak.
 * Faqat sifat nuqsonlari va yozuv/logotip to'siladi.
 */
const NEGATIVE = "text, watermark, logo, letters, caption, signature, blurry, low quality, distorted, deformed hands, extra fingers"

/**
 * Rasm chizish — yagona kirish nuqtasi.
 *
 * NVIDIA (FLUX) BIRINCHI: sifati sezilarli yuqori. Cloudflare'ни
 * birinchi qo'yganda rasm sifati tushib ketgan edi — uning SDXL-base
 * modeli eskiroq va detallari past.
 *
 * Cloudflare — zaxira: NVIDIA limitga urilsa (503/429) rasm baribir
 * chiqadi. Cloudflare'да ham FLUX bor va u birinchi sinaladi.
 *
 * Sifat qo'shimchasi har ikkalasiga qo'shiladi.
 */
const QUALITY = "highly detailed, sharp focus, professional photography, 8k, natural lighting"

async function genImage(
  prompt: string,
  aspect: GenAspect,
  seed = 0,
): Promise<{ data: string; model: string }> {
  const errs: string[] = []
  // Sifat qo'shimchasi — takrorlanmasin
  const full = /highly detailed|8k/i.test(prompt) ? prompt : `${prompt}, ${QUALITY}`.slice(0, 480)
  try {
    return await nimImage(full, aspect, seed)
  } catch (e) {
    errs.push(`NVIDIA: ${e instanceof Error ? e.message : "xatolik"}`)
  }
  if (cfAvailable()) {
    try {
      return await cfImage(full, aspect, seed, NEGATIVE)
    } catch (e) {
      errs.push(`Cloudflare: ${e instanceof Error ? e.message : "xatolik"}`)
    }
  }
  throw new Error(errs.join(" | ") || "Rasm chizilmadi")
}

/**
 * Har provayderga alohida chegara. Bir xil emas:
 * Groq tez javob beradi, NVIDIA'ning 70B modeli sekinroq va 22
 * soniyada "Signal timed out" bilan uzilib qolardi.
 */
const PROVIDER_TIMEOUT: Record<string, number> = {
  Groq: 20_000,
  Gemini: 15_000,
  Cloudflare: 30_000,
  NVIDIA: 45_000,
}
const TIMEOUT_FOR = (name: string) => PROVIDER_TIMEOUT[name] ?? 25_000

/**
 * MATN provayderlari tartibi — env (AI_TEXT_ORDER) orqali sozlanadi.
 *
 * Vazifa taqsimoti: matn yozish va rasm ko'rish — CLOUDFLARE, rasm
 * uchun promt — GEMINI (buildImagePrompt o'zi Gemini'ni birinchi
 * chaqiradi), rasm chizish — NVIDIA. Shunday qilib Gemini kvotasi
 * faqat promt uchun sarflanadi va tez tugamaydi.
 */
const DEFAULT_ORDER = ["Cloudflare", "Gemini", "NVIDIA", "Groq"]
function providerOrder(): string[] {
  const raw = Deno.env.get("AI_TEXT_ORDER")
  if (!raw) return DEFAULT_ORDER
  const norm: Record<string, string> = { groq: "Groq", gemini: "Gemini", nvidia: "NVIDIA", cloudflare: "Cloudflare", cf: "Cloudflare" }
  const want = raw.split(",").map((s) => norm[s.trim().toLowerCase()]).filter(Boolean)
  // Ro'yxatga kirmay qolgan provayderlarni oxiriga qo'shamiz (zaxira)
  return [...new Set([...want, ...DEFAULT_ORDER])]
}
// deno-lint-ignore no-explicit-any
const JSON_FN: Record<string, any> = { Groq: groqJson, Gemini: geminiJson, NVIDIA: nimJson, Cloudflare: cfJson }
// deno-lint-ignore no-explicit-any
const CHAT_FN: Record<string, any> = { Groq: groqChat, Gemini: geminiChat, NVIDIA: nimChat, Cloudflare: cfChat }

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
  /**
   * Provayder tartibini MAJBURAN belgilash. Masalan rasm promti uchun
   * Gemini birinchi bo'lishi kerak (u matnni yaxshi tushunadi), matn
   * yozish uchun esa Cloudflare.
   */
  order?: string[],
): Promise<T> {
  const errs: string[] = []
  let softHit: unknown = null

  // Uchta provayder: biri kvotasi tugasa keyingisi ishlaydi.
  // Groq birinchi — uning bepul chegarasi eng keng.
  for (const name of (order && order.length ? order : providerOrder())) {
    const fn = JSON_FN[name]
    if (!fn) continue
    if (!hasKey(name)) { errs.push(`${name}: kalit yo'q`); continue }
    try {
      // retries: 0 — bir provayderni qayta sinash o'rniga darhol
      // keyingisiga o'tamiz. Zanjirning o'zi zaxira vazifasini bajaradi
      // va uch provayder x ikki urinish 90 soniyadan oshib ketardi.
      const raw = unwrap(await fn(prompt, { retries: 0, maxTokens, timeoutMs: TIMEOUT_FOR(name) }), keys)
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
  for (const name of providerOrder()) {
    const fn = CHAT_FN[name]
    if (!fn) continue
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
/**
 * AI'siz zaxira rasm so'rovi.
 *
 * NEGA KERAK: uchala matn provayderi bir vaqtda tugab qolishi mumkin
 * (Gemini kunlik kvota, Groq rate limit, NVIDIA 503). O'shanda rasm
 * UMUMAN chizilmasdi — foydalanuvchi qip-qizil xato ko'rardi.
 * Endi matndagi kalit so'zlarga qarab oddiy inglizcha so'rov yasaymiz:
 * mukammal emas, lekin mavzuga yaqin va rasm HAR DOIM chiqadi.
 */
function fallbackImagePrompt(text: string): string {
  const t = (text || "").toLowerCase()
  // Kalit so'z -> inglizcha sahna. Birinchi mos kelgani olinadi.
  const map: [RegExp, string][] = [
    [/issiqxona|teplitsa/, "modern agricultural greenhouse with long rows of green plants, glass roof, sunlight"],
    [/tomchilat|sug'or|sugor|suv/, "drip irrigation lines watering young crops in a field, water droplets, close-up"],
    [/traktor|texnika|kombayn/, "modern tractor working in a large agricultural field at golden hour"],
    [/chorva|mol|sigir|qoramol|sut/, "healthy dairy cows in a clean modern barn, straw bedding"],
    [/parranda|tovuq|broyler/, "modern poultry farm interior with healthy chickens"],
    [/asalari|asal/, "beehives in a blooming field, beekeeping, sunny day"],
    [/bug'doy|bugdoy|don|hosil/, "golden wheat field ready for harvest, wide landscape"],
    [/paxta/, "cotton field with open white bolls, sunny day"],
    [/meva|olma|uzum|bog'|bog/, "orchard with ripe fruit on trees, green leaves, sunlight"],
    [/sabzavot|pomidor|bodring|kartoshka/, "fresh vegetables growing in rows on a farm, tomatoes and cucumbers"],
    [/urug'|urug|ko'chat|kochat/, "young seedlings in nursery trays, fresh green sprouts, close-up"],
    [/o'g'it|ogit|mineral/, "farmer hands holding fertile dark soil with granular fertilizer, close-up"],
    [/eksport|bozor|savdo|sotuv/, "crates of fresh farm produce prepared for export at a warehouse"],
  ]
  const hit = map.find(([re]) => re.test(t))
  const scene = hit ? hit[1] : "Uzbek farmland landscape with green crops and clear sky"
  return `${scene}, Central Asia agriculture, photorealistic, natural light, sharp focus, high detail`
}

async function buildImagePrompt(text: string): Promise<string> {
  // JSON so'raymiz, erkin matn emas. Ilgari askText ishlatilardi va
  // model javob oldiga "Here is the image prompt:" kabi kirish so'zi
  // qo'shsa, birinchi qator o'sha kirish bo'lib qolardi — natijada
  // rasm mavzuga umuman aloqasiz chiqardi.
  const res = await askAi<{ prompt?: string; subject?: string }>(
    `Sen professional art-direktorsan. Quyidagi o'zbekcha postni O'QIB,
MA'NOSINI TUSHUN va shu postga eng mos keladigan rasm uchun
professional so'rov (image prompt) yoz.

POST:
${text.slice(0, 800)}

Ikki bosqich:
1) "subject" — post NIMA HAQIDA ekanini tushunib, rasmda ko'rsatilishi
   kerak bo'lgan asosiy sahnani ingliz tilida 2-5 so'z bilan yoz.
   Mavhum tushunchani ("convenience", "efficiency") KO'RSATADIGAN aniq
   sahnaga aylantir.
2) "prompt" — shu sahnaning to'liq, jonli tasviri.

"prompt" QOIDALARI:
- Asosiy sahna so'rov BOSHIDA tursin.
- Odam kerak bo'lsa QO'SHAVER — fermer, ishchi, mutaxassis. Post odamlar
  haqida bo'lsa, ular tabiiy va ishonarli ko'rinsin.
- Muhitni tasvirla: joy, vaqt, yorug'lik, kayfiyat.
- INGLIZ tilida.
- photorealistic, natural light, sharp focus, high detail
- O'zbekiston/Markaziy Osiyo qishloq xo'jaligi muhiti
- Rasmda YOZUV, matn, logotip bo'lmasin
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
    undefined,
    // GEMINI birinchi: rasm promti — uning ishi. U matnni eng yaxshi
    // tushunadi va sahnani to'g'ri tasavvur qiladi. Yiqilsa Cloudflare,
    // keyin NVIDIA zaxira.
    ["Gemini", "Cloudflare", "NVIDIA"],
  )

  // Odam taqiqi OLIB TASHLANDI: sahnaga odam kerakmi-yo'qmi, buni
  // matnni tushungan model o'zi hal qiladi. Biz aralashmaymiz.
  return String(res.prompt || "").trim().slice(0, 400)
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
 * Matnni O'QISHGA QULAY formatlaydi.
 *
 * AI raqamli ro'yxatni bitta uzun paragrafga tiqib yozadi
 * ("...usullar: 1-jamoa 2-yer 3-qarz..."). Odam o'qishga qiynaladi.
 * Bu funksiya raqamli ro'yxat bandlarini ALOHIDA QATORGA ajratadi va
 * biroz otступ qo'yadi — go'yo qo'lda chiroyli terilgandek.
 *
 * Faqat HAQIQIY ro'yxat (kamida "1" va "2" bandlari) formatlanadi —
 * "5 ta usul" yoki "40%" kabi oddiy raqamlar tegilmaydi.
 */
function prettyFormat(text: string): string {
  let t = (text || "").replace(/\r/g, "").trim()
  if (!t) return t
  const hasList = /(^|\s)1\s*[-.)]\s*\S/.test(t) && /(^|\s)2\s*[-.)]\s*\S/.test(t)
  if (hasList) {
    // "1-", "2.", "3)" oldiga yangi qator + otступ (tiredan keyin
    // bo'shliq bo'lmasligi ham mumkin: "1-jamoa")
    t = t.replace(/\s*(\d{1,2})([-.)])\s*/g, (_m, n, sep) => `\n   ${n}${sep} `)
    t = t.replace(/\n{2,}/g, "\n").replace(/^\n+/, "").trim()
  }
  return t
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
- Ro'yxat ishlatsang, HAR BANDNI YANGI QATORDAN boshla (\n bilan),
  hammasini bitta qatorga tiqma. Har band kamida bitta to'liq jumla bo'lsin
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
      return jsonResponse({ generated: { ...result, matn: prettyFormat(result.matn) } })
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
        // YUMSHOQ shart: matn bor va tasvirlab yozilmagan bo'lsa yetadi.
        // Sabab: Gemini kvotasi 0, NVIDIA rate-limit bo'lganда faqat Groq
        // qoladi. Uning javobi mavzuga to'liq mos bo'lmasa ham, XATO
        // (500) berishdan ko'ra shu matnni qaytargan yaxshi.
        const softT = (v: unknown) => {
          const m = String((v as Generated)?.matn || "")
          return m.trim().length >= 20 && !describesMedia(m)
        }
        // Strict tekshiruv — usableT (matnli, tasvirsiz). matchesTopic'ni
        // strictdan OLIB TASHLADIK: u Groq'ning yagona javobini rad etib,
        // o'lik Gemini/rate-limitli NVIDIAga o'tkazar va kaskad xato
        // (500) berardi. Endi Groq yaroqli javob bersa darhol qaytadi —
        // ortiqcha provayder chaqirilmaydi, NVIDIA charchamaydi.
        try {
          const res = await askAi<Generated>(tPrompt, usableT, 2048, ["matn", "sarlavha"], softT)
          return jsonResponse({ generated: { ...res, matn: prettyFormat(res.matn), tasvir: "", mazmun: (res as Generated).mazmun || "" } })
        } catch {
          // JSON yo'li ishlamasa (bo'sh matn, rate-limit) — ODDIY MATN
          // so'raymiz. Bu JSON muammosini chetlab o'tadi va Groq odatda
          // javob beradi. 500 o'rniga matn qaytadi.
          try {
            const plain = await askText(
              `Quyidagi video ovozidan olingan matn asosida 2-3 jumlalik tayyor
o'zbekcha post yoz. Videoni tasvirlamasdan, mavzu haqida jonli yoz.
Faqat post matnini qaytar.

MATN: ${transcript.slice(0, 2000)}`)
            const m = plain.trim().slice(0, 600)
            if (m.length >= 20 && !describesMedia(m)) {
              return jsonResponse({ generated: { matn: prettyFormat(m), sarlavha: "", hashtaglar: [], tasvir: "", mazmun: "" } })
            }
          } catch { /* pastda umumiy xato */ }
          return errorResponse("Matn yozib bo'lmadi — biroz kuting va qayta urining", 500)
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
        // CLOUDFLARE birinchi: rasm/kadrni ko'rish uning ishi (Gemini
        // kvotasi rasm promti uchun tejaladi).
        { name: "Cloudflare", run: () => cfJson<Generated>(prompt, { maxTokens: 2048, image, timeoutMs: TIMEOUT_FOR("Cloudflare") }) },
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
          return jsonResponse({ generated: { ...result, matn: prettyFormat(result.matn) } })
        } catch (e) {
          errs.push(`${a.name}: ${e instanceof Error ? e.message : "xatolik"}`)
        }
      }
      if (soft) return jsonResponse({ generated: { ...soft, matn: prettyFormat(soft.matn) } })
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
        const tPrompt = `Quyida videoning OVOZIDAN olingan matn bor (ovoz noaniq
eshitilgan yoki qoraqalpoqcha bo'lishi mumkin). Shu video uchun muqova
ma'lumotini ber.

VIDEO MATNI:
"""
${transcript.slice(0, 4000)}
"""

1) "sarlavha" — videoning ASOSIY TAKLIFI/XIZMATINI aks ettiruvchi
   qisqa, jozibali sarlavha. QAT'IY:
   - TO'G'RI, ADABIY O'ZBEK TILIDA (lotin), imlosi mukammal.
   - Videodagi TAKLIF nima ekanini yoz (masalan xizmat issiqxona
     qurish bo'lsa "Zamonaviy issiqxona qurish", "Issiqxona quramiz").
   - JOY NOMI, tuman, ism, kishilik ma'lumot ISHLATMA — faqat mavzu/taklif.
   - Noaniq/buzuq so'zlarni ko'chirma, mavzuni tushunib yoz.
   - 2-5 so'z, jozibali.
2) "prompt" — INGLIZCHA rasm so'rovi. QAT'IY:
   - ANIQ va KONKRET tasvir yoz, mavzuni aniq ko'rsat. Issiqxona bo'lsa
     ALBATTA shu elementlar bo'lsin: "agricultural greenhouse, long rows
     of green plants growing in soil, transparent glass/polycarbonate
     roof and walls, sunlight coming through, farming". Bu XONA/oshxona
     EMAS — QISHLOQ XO'JALIGI issiqxonasi.
   - "modern interior", "room", "kitchen" kabi UMUMIY ichki makon
     so'zlarini YOZMA — aks holda oddiy xona chiqadi.
   - Odam kerak bo'lsa qo'shaver (fermer, mutaxassis) — video mazmuniga
     qarab o'zing hal qil.
   - Realistik foto, tabiiy yorug'lik, yozuvsiz. Faqat ingliz tilida,
     40 so'zdan oshmasin.

FAQAT JSON: { "sarlavha": "…", "prompt": "…" }`
        try {
          const r = await askAi<{ sarlavha?: string; prompt?: string }>(
            tPrompt,
            (v) => {
              const o = v as { prompt?: string; sarlavha?: string }
              const p = String(o?.prompt || "").trim()
              const latin = (p.match(/[a-z]/gi) || []).length
              if (p.length < 15 || latin / p.length <= 0.6 || leaksInstructions(p)) return false
              // Sarlavha bo'sh bo'lmasin
              return String(o?.sarlavha || "").trim().length >= 3
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
          { name: "Cloudflare", run: () => cfJson<{ sarlavha?: string; prompt?: string }>(visionPrompt, { maxTokens: 500, image, timeoutMs: TIMEOUT_FOR("Cloudflare") }) },
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

      // Odam taqiqi OLIB TASHLANDI — sahnaga kim/nima kerakligini
      // matnni tushungan model o'zi hal qiladi. Faqat sifat qo'shимчаси.
      if (!/photorealistic/i.test(imgPrompt)) {
        imgPrompt = `${imgPrompt}, photorealistic, natural light`.slice(0, 400)
      }

      // TOZA sarlavha: buzuq transcript so'zlari (masalan "isteihanalar")
      // yoki inglizcha so'z ("Greenhouse") qolmasin. Inglizcha rasm
      // so'rovini TO'LIQ o'zbekchaga tarjima qilamiz.
      const isEnglishy = (s: string) =>
        /\b(greenhouse|green\s?house|modern|farm|farmer|harvest|drip|irrigation|plant|crop|field|soil|the|and|with|of|for)\b/i.test(s)
      // Sarlavha + 3 ta AFZALLIK so'zi — muqova shablonidagi chiplar uchun
      // (masalan "Zamonaviy texnologiya", "Tomchilatib sug'orish",
      // "Yuqori daromad"). Hammasi toza o'zbekcha.
      let benefits: string[] = []
      try {
        const tr = await askAi<{ sarlavha?: string; afzalliklar?: string[] }>(
          `Quyidagi ingliz tilidagi rasm mavzusi asosida muqova uchun matn ber.

MAVZU: ${imgPrompt}

QAT'IY QOIDALAR:
- FAQAT o'zbek tili (lotin alifbosi). BIRORTA inglizcha so'z QOLMASIN.
  Inglizchani tarjima qil: greenhouse=issiqxona, drip irrigation=
  tomchilatib sug'orish, harvest=hosil, farm=ferma, crop=ekin.
- "sarlavha" — mavzuning ASOSIY TAKLIFI, jozibali, 2-4 so'z, imlosi
  to'g'ri. TO'LIQ, TABIIY ibora bo'lsin (yarim gap yoki qaratqich
  ("...ning") bilan tugamasin). JOY NOMI, tuman, ism ISHLATMA.
- "afzalliklar" — mavzuga oid 3 ta qisqa afzallik (har biri 1-2 so'z,
  masalan "Yuqori daromad", "Zamonaviy texnologiya", "Kam xarajat").

FAQAT JSON: { "sarlavha": "…", "afzalliklar": ["…","…","…"] }`,
          (v) => {
            const s = String((v as { sarlavha?: string })?.sarlavha || "").trim()
            return s.length >= 3 && s.length <= 60 && !isEnglishy(s)
          },
          300, ["sarlavha"],
        )
        const t = String(tr.sarlavha || "").trim().replace(/^["']+|["']+$/g, "").slice(0, 60)
        if (t.length >= 3 && !isEnglishy(t)) title = t
        benefits = (Array.isArray(tr.afzalliklar) ? tr.afzalliklar : [])
          .map((b) => String(b).trim().replace(/^["']+|["']+$/g, "").slice(0, 24))
          .filter((b) => b.length >= 2 && !isEnglishy(b))
          .slice(0, 3)
      } catch { /* sarlavha/afzallik chiqmasa avvalgisi qoladi */ }
      // Sarlavha inglizcha/buzuq bo'lsa — bo'sh qoldiramiz (yozuvsiz
      // muqova yarimta inglizcha yozuvdan yaxshiroq)
      if (isEnglishy(title)) title = ""

      // 2) TO'RTTA mos muqova rasmi — har biri boshqa seed bilan, tanlov
      // bo'lsin. Ketma-ket: NVIDIA bepul tarifi bir vaqtda ko'p so'rovni
      // rad etishi mumkin, ketma-ket ishonchliroq.
      // 2 ta AI rasm — 4 ta emas. NVIDIA bepul tarifi "16 so'rov"
      // chegarasiga ega; 4 ta rasm butun kvotani tugatib, describe va
      // boshqa amallar 503 (ResourceExhausted) berardi. Qolgan 2 ta
      // variant videoning haqiqiy kadridan to'ldiriladi.
      const seeds = [11, 27]
      const images: string[] = []
      let firstErr = ""
      for (const s of seeds) {
        try {
          const img = await genImage(imgPrompt, aspect, s)
          images.push(img.data)
        } catch (e) {
          if (!firstErr) firstErr = e instanceof Error ? e.message : "Rasm chizilmadi"
        }
      }
      if (!images.length) {
        return jsonResponse({ vision_failed: true, error: firstErr || "Rasm chizilmadi" })
      }
      return jsonResponse({ images, title, benefits, prompt: imgPrompt })
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
      // seed — "boshqa rasm" tugmasi har safar boshqa raqam yuboradi,
      // shunda FLUX bir xil so'rovga ham har xil rasm chizadi.
      const seed = Number.isFinite(Number(body.seed)) ? Math.floor(Number(body.seed)) : 0

      // Matn provayderlari tugagan bo'lsa ham rasm chiqishi kerak —
      // zaxira so'rov kalit so'zlardan yasaladi (AI chaqirilmaydi).
      let imgPrompt = ""
      let usedFallback = false
      try {
        imgPrompt = await buildImagePrompt(text)
      } catch {
        imgPrompt = fallbackImagePrompt(text)
        usedFallback = true
      }
      if (!imgPrompt) { imgPrompt = fallbackImagePrompt(text); usedFallback = true }

      let img: { data: string; model: string }
      try {
        img = await genImage(imgPrompt, aspect, seed)
      } catch (e) {
        return errorResponse(e instanceof Error ? e.message : "Rasm yaratilmadi", 500)
      }
      return jsonResponse({ image_b64: img.data, prompt: imgPrompt, model: img.model, fallback: usedFallback })
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
