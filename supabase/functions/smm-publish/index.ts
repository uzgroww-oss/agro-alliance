import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { getFacebookPage, exchangeForLongLived } from "../_shared/facebook.ts"

/**
 * smm-publish — SMM postlarini saqlash, tasdiqlash va tarmoqlarga joylash.
 *
 * Edge funksiya limiti (98/100) sababli hamma amal bitta funksiyada:
 *   GET                  — postlar ro'yxati
 *   POST                 — yangi post saqlash (status: pending_approval)
 *   PATCH ?id=..         — tahrirlash
 *   POST  ?action=publish&id=..  — TASDIQLASH va joylash
 *   DELETE ?id=..        — o'chirish
 *
 * MUHIM: post faqat ODAM "publish" chaqirganda joylanadi. AI o'zi joylamaydi.
 */

/**
 * LinkedIn RO'YXATDAN OLIB TASHLANDI: hech qachon ulanmagan, faqat
 * "hali qo'llab-quvvatlanmaydi" xatosini qaytarardi va panelda
 * ishlaydigan tarmoqlar orasida bekorga joy egallardi.
 *
 * YouTube QOLADI, lekin u TAHLIL uchun: kanal statistikasi va
 * videolar raqamlari o'qiladi. Post joylash yo'q — YouTube'ga matn
 * chiqarib bo'lmaydi, u yerga video FAYL yuklanadi va bu butunlay
 * boshqa oqim (OAuth + resumable upload).
 */
const PLATFORMS = ["telegram", "facebook", "instagram", "youtube"] as const
type Platform = typeof PLATFORMS[number]

type PublishResult = { platform: string; success: boolean; external_id?: string; error?: string }

/**
 * Fayl video ekanini manzil oxiridan aniqlaymiz.
 *
 * NEGA KERAK: media_url rasm ham, video ham bo'lishi mumkin. Ilgari
 * hammasi RASM deb yuborilardi — video yuklangan post Telegram'da
 * sendPhoto bilan ketib, "wrong file identifier" xatosi bilan
 * yiqilardi.
 */
function isVideoUrl(url: string | null): boolean {
  return Boolean(url && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url))
}

/**
 * Sozlamani olish: avval bazadagi ulanish (admin panel orqali), topilmasa
 * env secret (eski usul). Shunda ikkalasi ham ishlaydi.
 */
async function getConf(platform: string, key: string, envName: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("smm_connections")
    .select("config")
    .eq("platform", platform)
    .maybeSingle()
  const fromDb = data?.config?.[key]
  if (fromDb && String(fromDb).trim()) return String(fromDb).trim()
  return Deno.env.get(envName) || null
}

/* ---------------- Telegram ---------------- */
/** worker-telegram-publish mantiqidan olingan; rasm bo'lsa sendPhoto, bo'lmasa sendMessage */
async function publishTelegram(text: string, imageUrl: string | null): Promise<PublishResult> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")
  const chatId = await getConf("telegram", "chat_id", "TELEGRAM_CHAT_ID")
  if (!token) return { platform: "telegram", success: false, error: "Telegram bot tokeni yo'q" }
  if (!chatId) return { platform: "telegram", success: false, error: "Telegram ulanmagan" }

  try {
    let resp: Response
    if (imageUrl && isVideoUrl(imageUrl)) {
      resp = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, video: imageUrl, caption: text.slice(0, 1024) }),
      })
    } else if (imageUrl) {
      resp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: text.slice(0, 1024) }),
      })
    } else {
      resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4096) }),
      })
    }
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok || data.ok === false) {
      return { platform: "telegram", success: false, error: data.description || `HTTP ${resp.status}` }
    }
    return { platform: "telegram", success: true, external_id: String(data.result?.message_id ?? "") }
  } catch (e) {
    return { platform: "telegram", success: false, error: e instanceof Error ? e.message : "Tarmoq xatosi" }
  }
}

/* ---------------- Facebook ---------------- */
async function publishFacebook(text: string, imageUrl: string | null): Promise<PublishResult> {
  // Token muddati tugagan bo'lsa Instagram tokenidan qayta chiqariladi
  const page = await getFacebookPage()
  if (!page) {
    return { platform: "facebook", success: false, error: "Facebook ulanmagan" }
  }
  const pageId = page.id
  const token = page.token
  try {
    const video = isVideoUrl(imageUrl)
    const endpoint = !imageUrl
      ? `https://graph.facebook.com/v22.0/${pageId}/feed`
      : video
        ? `https://graph.facebook.com/v22.0/${pageId}/videos`
        : `https://graph.facebook.com/v22.0/${pageId}/photos`
    const payload: Record<string, string> = !imageUrl
      ? { message: text, access_token: token }
      : video
        ? { file_url: imageUrl, description: text, access_token: token }
        : { url: imageUrl, caption: text, access_token: token }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok || data.error) {
      return { platform: "facebook", success: false, error: data.error?.message || `HTTP ${resp.status}` }
    }
    return { platform: "facebook", success: true, external_id: String(data.id ?? data.post_id ?? "") }
  } catch (e) {
    return { platform: "facebook", success: false, error: e instanceof Error ? e.message : "Tarmoq xatosi" }
  }
}

/** Instagram xatolarini qisqa o'zbekcha sababga aylantiradi */
function igError(err: { message?: string; code?: number } | undefined, status: number): string {
  const msg = String(err?.message || "").toLowerCase()
  const code = err?.code
  if (msg.includes("instagram_content_publish")) return "Instagram'ga post qo'yish ruxsati yo'q — qayta ulang"
  if (code === 190 || msg.includes("access token")) return "Instagram ulanishi eskirgan — qayta ulang"
  if (code === 4 || code === 17 || code === 32) return "So'rovlar chegarasi — keyinroq urining"
  if (msg.includes("aspect ratio")) return "Rasm o'lchami mos emas — kvadrat (1:1) yoki tik (4:5) bo'lsin"
  if (msg.includes("media type") || msg.includes("image")) return "Rasm formati mos emas (JPEG kerak)"
  if (code === 100) return "Rasm manzili Instagram uchun ochiq emas"
  return err?.message || `Xatolik ${status}`
}

/* ---------------- Instagram (2 bosqich) ---------------- */
async function publishInstagram(text: string, imageUrl: string | null, coverUrl: string | null = null): Promise<PublishResult> {
  if (!imageUrl) {
    return { platform: "instagram", success: false, error: "Instagram uchun rasm yoki video majburiy" }
  }
  // Instagram Sozlamalar bo'limidagi OAuth orqali ulanadi — o'sha token
  // instagram_tokens jadvalida turadi. Avval shu yerdan olamiz.
  const { data: igTok } = await supabaseAdmin
    .from("instagram_tokens")
    .select("access_token, instagram_account_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const igUserId = igTok?.instagram_account_id || (await getConf("instagram", "user_id", "INSTAGRAM_USER_ID"))
  const token = igTok?.access_token || (await getConf("instagram", "access_token", "INSTAGRAM_ACCESS_TOKEN"))
  if (!igUserId || !token) {
    return { platform: "instagram", success: false, error: "Instagram ulanmagan" }
  }
  try {
    // 1) media konteyner. Video Instagram'da REELS sifatida ketadi —
    // oddiy feed videosi uchun API yo'q.
    const video = isVideoUrl(imageUrl)
    const container: Record<string, string> = video
      ? { media_type: "REELS", video_url: imageUrl, caption: text.slice(0, 2200), access_token: token }
      : { image_url: imageUrl, caption: text.slice(0, 2200), access_token: token }
    // Video muqovasi — REELS'ning boshqa rasmi. Berilgan bo'lsa
    // qo'shamiz; bo'lmasa Instagram videoning kadridan oladi.
    if (video && coverUrl) container.cover_url = coverUrl

    const createResp = await fetch(`https://graph.facebook.com/v22.0/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(container),
    })
    const created = await createResp.json().catch(() => ({}))
    if (!createResp.ok || created.error) {
      return { platform: "instagram", success: false, error: igError(created.error, createResp.status) }
    }

    // Video konteyneri darhol tayyor bo'lmaydi — Instagram uni qayta
    // ishlaydi. Tayyor bo'lguncha kutamiz, aks holda media_publish
    // "not ready" xatosi bilan yiqiladi.
    if (video) {
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const st = await fetch(`https://graph.facebook.com/v22.0/${created.id}?fields=status_code&access_token=${token}`)
        const sd = await st.json().catch(() => ({}))
        if (sd.status_code === "FINISHED") break
        if (sd.status_code === "ERROR") {
          return { platform: "instagram", success: false, error: "Instagram videoni qabul qilmadi" }
        }
        if (i === 19) {
          return { platform: "instagram", success: false, error: "Video tayyorlanmadi — keyinroq urining" }
        }
      }
    }
    // 2) publish
    const pubResp = await fetch(`https://graph.facebook.com/v22.0/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: created.id, access_token: token }),
    })
    const published = await pubResp.json().catch(() => ({}))
    if (!pubResp.ok || published.error) {
      return { platform: "instagram", success: false, error: igError(published.error, pubResp.status) }
    }
    return { platform: "instagram", success: true, external_id: String(published.id ?? "") }
  } catch (e) {
    return { platform: "instagram", success: false, error: e instanceof Error ? e.message : "Tarmoq xatosi" }
  }
}

/**
 * Kiritilgan matndan YouTube kanalini topadi.
 *
 * Odam kanalni turlicha yozadi va hammasi to'g'ri:
 *   https://youtube.com/@AgroAlliance   @AgroAlliance   AgroAlliance
 *   https://youtube.com/channel/UCxxxx  UCxxxx
 * Shuning uchun avval ID deb, keyin @nom deb, oxirida qidiruv orqali
 * urinib ko'riladi — bittasi ishlasa bas.
 */
async function youtubeKanalTop(
  xom: string,
  kalit: string,
): Promise<{ id: string; title: string } | null> {
  const API = "https://www.googleapis.com/youtube/v3"
  const ol = async (url: string): Promise<{ id: string; title: string } | null> => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8_000) })
      const d = await r.json()
      const it = d.items?.[0]
      if (!it) return null
      return { id: it.id?.channelId || it.id, title: it.snippet?.title || "" }
    } catch {
      return null
    }
  }

  let s = xom.replace(/^https?:\/\/(www\.)?youtube\.com\//i, "").replace(/\/$/, "")
  const kanalYoli = s.match(/^channel\/([A-Za-z0-9_-]+)/)
  if (kanalYoli) s = kanalYoli[1]
  s = s.replace(/^(c|user)\//i, "")

  // 1) To'g'ridan-to'g'ri kanal ID
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(s)) {
    const r = await ol(`${API}/channels?part=snippet&id=${s}&key=${kalit}`)
    if (r) return r
  }
  // 2) @nom
  const nom = s.replace(/^@/, "")
  if (nom) {
    const r = await ol(`${API}/channels?part=snippet&forHandle=${encodeURIComponent(nom)}&key=${kalit}`)
    if (r) return r
    const r2 = await ol(`${API}/channels?part=snippet&forUsername=${encodeURIComponent(nom)}&key=${kalit}`)
    if (r2) return r2
    // 3) Oxirgi chora — qidiruv
    const r3 = await ol(`${API}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(nom)}&key=${kalit}`)
    if (r3) return r3
  }
  return null
}

/** Hali qurilmagan tarmoqlar — aniq xabar beradi, jim yiqilmaydi */
function notReady(platform: string): PublishResult {
  const why: Record<string, string> = {
    // YouTube post joylash uchun emas — kanal tahlili uchun ulanadi
    youtube: "YouTube'ga matn post joylab bo'lmaydi — u faqat tahlil uchun ulanadi",
  }
  return { platform, success: false, error: why[platform] || "Bu tarmoq hali ulanmagan" }
}

/* ---------------- Tarmoqda hali turibdimi? ---------------- */
/**
 * Joylangan post tarmoqdan qo'lda o'chirilgan bo'lishi mumkin.
 * Panel buni bilmasa "Joylandi" deb ko'rsatib turaveradi.
 *
 * Telegram tekshirilmaydi: Bot API da xabar mavjudligini so'raydigan
 * usul yo'q. Shuning uchun uni "noma'lum" deb qoldiramiz — yolg'on
 * "o'chirilgan" ko'rsatgandan ko'ra ma'lumot bermagan yaxshiroq.
 */
async function stillExists(platform: string, externalId: string): Promise<boolean | null> {
  if (!externalId) return null
  try {
    if (platform === "instagram") {
      const { data: igTok } = await supabaseAdmin
        .from("instagram_tokens")
        .select("access_token")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      const token = igTok?.access_token || (await getConf("instagram", "access_token", "INSTAGRAM_ACCESS_TOKEN"))
      if (!token) return null
      const r = await fetch(`https://graph.facebook.com/v22.0/${externalId}?fields=id&access_token=${token}`)
      const d = await r.json().catch(() => ({}))
      if (d.id) return true
      // Kod 100 / "does not exist" — o'chirilgan. Boshqa xatolar (token,
      // limit) o'chirilganini bildirmaydi.
      const msg = String(d.error?.message || "").toLowerCase()
      if (d.error?.code === 100 || msg.includes("does not exist") || msg.includes("unsupported get")) return false
      return null
    }
    if (platform === "facebook") {
      const token = (await getFacebookPage())?.token
      if (!token) return null
      const r = await fetch(`https://graph.facebook.com/v22.0/${externalId}?fields=id&access_token=${token}`)
      const d = await r.json().catch(() => ({}))
      if (d.id) return true
      const msg = String(d.error?.message || "").toLowerCase()
      if (d.error?.code === 100 || msg.includes("does not exist")) return false
      return null
    }
  } catch {
    return null // tarmoq xatosi — hukm chiqarmaymiz
  }
  return null
}

/* ---------------- Tarmoqdan o'chirish ---------------- */
/**
 * Instagram Graph API media o'chirishni QO'LLAB-QUVVATLAMAYDI — DELETE
 * uchun endpoint yo'q. Buni jimgina yutib yubormay, ochiq aytamiz.
 */
async function removeRemote(platform: string, externalId: string): Promise<PublishResult> {
  if (!externalId) return { platform, success: false, error: "Tarmoqdagi id saqlanmagan" }
  try {
    if (platform === "telegram") {
      const token = Deno.env.get("TELEGRAM_BOT_TOKEN")
      const chatId = await getConf("telegram", "chat_id", "TELEGRAM_CHAT_ID")
      if (!token || !chatId) return { platform, success: false, error: "Telegram ulanmagan" }
      const r = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: Number(externalId) }),
      })
      const d = await r.json().catch(() => ({}))
      if (d.ok) return { platform, success: true }
      return { platform, success: false, error: d.description || "O'chirilmadi" }
    }
    if (platform === "facebook") {
      const token = (await getFacebookPage())?.token
      if (!token) return { platform, success: false, error: "Facebook ulanmagan" }
      const r = await fetch(`https://graph.facebook.com/v22.0/${externalId}?access_token=${token}`, { method: "DELETE" })
      const d = await r.json().catch(() => ({}))
      if (d.success || r.ok) return { platform, success: true }
      return { platform, success: false, error: d.error?.message || "O'chirilmadi" }
    }
    // Instagram DELETE handler'da o'tkazib yuboriladi — bu yerga
    // yetib kelmaydi. Ehtiyot uchun qoldirilgan.
  } catch (e) {
    return { platform, success: false, error: e instanceof Error ? e.message : "Tarmoq xatosi" }
  }
  return { platform, success: false, error: "Bu tarmoqdan o'chirib bo'lmaydi" }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    const action = url.searchParams.get("action")

    /* ---------- ULANISHLAR ---------- */
    // XAVFSIZLIK: token qiymatlari HECH QACHON frontend'ga qaytarilmaydi.
    // Faqat "ulangan/ulanmagan" va ko'rsatish uchun xavfsiz nom.
    const loadConnections = async () => {
      const { data: conns } = await supabaseAdmin
        .from("smm_connections")
        .select("platform, config, display_name, updated_at")

      // Instagram alohida: Sozlamalar bo'limidagi OAuth orqali ulanadi
      const { data: igTok } = await supabaseAdmin
        .from("instagram_tokens")
        .select("instagram_account_id, instagram_username")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const byPlatform: Record<string, { connected: boolean; display_name: string | null; via: string }> = {}
      for (const p of PLATFORMS) byPlatform[p] = { connected: false, display_name: null, via: "panel" }

      for (const c of (conns || []) as Array<{ platform: string; config: Record<string, unknown>; display_name: string | null }>) {
        const cfg = c.config || {}
        const ok =
          c.platform === "telegram" ? Boolean(cfg.chat_id) :
          c.platform === "facebook" ? Boolean(cfg.page_id && cfg.page_token) :
          c.platform === "youtube" ? Boolean(cfg.channel_id) :
          Object.keys(cfg).length > 0
        if (byPlatform[c.platform]) {
          byPlatform[c.platform] = { connected: ok, display_name: c.display_name, via: "panel" }
        }
      }

      // env secret orqali ulangan bo'lsa ham "ulangan" deb ko'rsatamiz
      if (!byPlatform.telegram.connected && Deno.env.get("TELEGRAM_CHAT_ID")) {
        byPlatform.telegram = { connected: true, display_name: null, via: "secret" }
      }
      // Facebook Instagram tokenidan ham chiqarilishi mumkin —
      // shuning uchun sozlama yo'q bo'lsa ham tekshiramiz
      if (!byPlatform.facebook.connected) {
        const fb = await getFacebookPage()
        if (fb) byPlatform.facebook = { connected: true, display_name: fb.name, via: "oauth" }
      }
      if (igTok?.instagram_account_id) {
        byPlatform.instagram = { connected: true, display_name: igTok.instagram_username || null, via: "oauth" }
      }

      return byPlatform
    }

    if (action === "connections" && req.method === "GET") {
      return jsonResponse({ connections: await loadConnections() })
    }

    if (action === "connect" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const platform = String(body.platform || "")
      if (!(PLATFORMS as readonly string[]).includes(platform)) return errorResponse("Noma'lum tarmoq", 400)

      let config: Record<string, string> = {}
      let display = ""

      if (platform === "telegram") {
        // Foydalanuvchi ko'pincha to'liq havola kiritadi
        // (https://t.me/agroalliance1). Telegram esa @nom yoki raqamli
        // ID kutadi. Havolani tozalab, @ qo'shamiz.
        let chatId = String(body.chat_id || "").trim()
        chatId = chatId.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "").replace(/^@/, "").replace(/\/$/, "")
        // Raqamli ID (-100...) bo'lmasa — bu username, @ bilan yuboriladi
        if (chatId && !/^-?\d+$/.test(chatId)) chatId = "@" + chatId
        if (!chatId) return errorResponse("Kanal @nomi yoki havolasini kiriting", 400)
        // Tekshiramiz: bot shu kanalga yoza oladimi?
        const token = Deno.env.get("TELEGRAM_BOT_TOKEN")
        if (!token) return errorResponse("Telegram bot tokeni yo'q", 400)
        const r = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`)
        const d = await r.json().catch(() => ({}))
        if (!r.ok || d.ok === false) {
          const why = String(d.description || "").toLowerCase().includes("not found")
            ? `${chatId} topilmadi — botni kanalga admin qilib qo'shing va kanal ochiq (public) ekanini tekshiring`
            : (d.description || "Kanal topilmadi")
          return errorResponse(why, 400)
        }
        config = { chat_id: chatId }
        display = d.result?.title || d.result?.username || chatId
      } else if (platform === "facebook") {
        const pageId = String(body.page_id || "").trim()
        const pageToken = String(body.page_token || "").trim()
        if (!pageId || !pageToken) return errorResponse("Page ID va token kiriting", 400)
        // Tekshiramiz
        const r = await fetch(`https://graph.facebook.com/v22.0/${pageId}?fields=name&access_token=${encodeURIComponent(pageToken)}`)
        const d = await r.json().catch(() => ({}))
        if (!r.ok || d.error) return errorResponse(d.error?.message || "Sahifa tekshiruvi o'tmadi", 400)
        // Qo'lda kiritilgan token odatda qisqa muddatli (1-2 soat).
        // Uzoq muddatliga almashtiramiz, aks holda ertaga yiqiladi.
        const longLived = await exchangeForLongLived(pageToken)
        config = { page_id: pageId, page_token: longLived || pageToken }
        display = d.name || pageId
      } else if (platform === "youtube") {
        /**
         * YOUTUBE KANALINI ULASH.
         *
         * OAuth KERAK EMAS: kanal statistikasi va videolar raqamlari
         * ochiq ma'lumot, API kaliti yetarli. Foydalanuvchi kanalning
         * havolasini, @nomini yoki ID sini kiritadi — uchalasi ham
         * qabul qilinadi, chunki odam odatda brauzerdagi havolani
         * nusxalab qo'yadi.
         */
        const kalit = Deno.env.get("YOUTUBE_API_KEY")
        if (!kalit) return errorResponse("YouTube API kaliti sozlanmagan", 400)

        const xom = String(body.channel || "").trim()
        if (!xom) return errorResponse("Kanal havolasini yoki @nomini kiriting", 400)

        const kanal = await youtubeKanalTop(xom, kalit)
        if (!kanal) {
          return errorResponse(
            `${xom} bo'yicha kanal topilmadi — havolani (youtube.com/@nom) yoki kanal ID sini tekshiring`,
            400,
          )
        }
        config = { channel_id: kanal.id }
        display = kanal.title
      } else {
        return errorResponse("Bu tarmoq hali qo'llab-quvvatlanmaydi", 400)
      }

      const { error } = await supabaseAdmin.from("smm_connections").upsert({
        platform, config, display_name: display,
        connected_by: auth.user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "platform" })
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true, display_name: display })
    }

    if (action === "disconnect" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const platform = String(body.platform || "")
      if (!(PLATFORMS as readonly string[]).includes(platform)) return errorResponse("Noma'lum tarmoq", 400)
      const { error } = await supabaseAdmin.from("smm_connections").delete().eq("platform", platform)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    /* ---------- Ro'yxat ---------- */
    const loadPosts = async () => {
      const { data, error } = await supabaseAdmin
        .from("smm_posts")
        .select("id, seq, title, content, hashtags, image_url, cover_url, platforms, status, ai_generated, scheduled_at, published_at, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50)
      if (error) throw new Error(error.message)

      const ids = (data || []).map((p: { id: string }) => p.id)
      const resultsByPost: Record<string, PublishResult[]> = {}
      if (ids.length) {
        const { data: res } = await supabaseAdmin
          .from("smm_post_results")
          .select("post_id, platform, success, error")
          .in("post_id", ids)
        for (const r of (res || []) as Array<{ post_id: string; platform: string; success: boolean; error: string | null }>) {
          if (!resultsByPost[r.post_id]) resultsByPost[r.post_id] = []
          resultsByPost[r.post_id].push({ platform: r.platform, success: r.success, error: r.error || undefined })
        }
      }

      // O'Z-O'ZINI TUZATISH: post tarmoqqa joylangan (muvaffaqiyatli
      // natijasi bor), lekin holati hali "saqlangan" bo'lib turgan
      // bo'lsa — to'g'irlaymiz.
      //
      // NEGA BUNDAY BO'LADI: joylash paytida foydalanuvchi sahifani
      // yangilasa so'rov uziladi. Postlar tarmoqlarga chiqib bo'lgan
      // va natijalar yozilgan bo'ladi, lekin holatni yangilash
      // bosqichiga yetmaydi — panelда "Saqlangan" bo'lib qolardi.
      const stale = (data || []).filter((p: Record<string, unknown>) => {
        const st = String(p.status)
        if (st === "published" || st === "removed") return false
        return (resultsByPost[p.id as string] || []).some((r) => r.success)
      })
      if (stale.length) {
        const now = new Date().toISOString()
        await supabaseAdmin
          .from("smm_posts")
          .update({ status: "published", published_at: now, updated_at: now })
          .in("id", stale.map((p: Record<string, unknown>) => p.id as string))
        // Ro'yxatda ham darhol to'g'ri ko'rinsin
        for (const p of stale) { p.status = "published"; p.published_at = now }
      }

      return (data || []).map((p: Record<string, unknown>) => ({
        ...p, results: resultsByPost[p.id as string] || [],
      }))
    }

    // Panel ochilganda ikkala ma'lumot ham kerak. Ilgari ikki alohida
    // so'rov ketardi — har biri o'z sovuq ishga tushishini kutardi.
    // Bitta so'rov: ikki barobar tez.
    if (action === "init" && req.method === "GET") {
      const [posts, connections] = await Promise.all([loadPosts(), loadConnections()])
      return jsonResponse({ posts, connections })
    }

    if (req.method === "GET") {
      return jsonResponse({ posts: await loadPosts() })
    }

    /* ---------- TASDIQLASH VA JOYLASH ---------- */
    /* ---------- HOLATNI TEKSHIRISH ---------- */
    // Joylangan postlar tarmoqda hali turibdimi? Qo'lda o'chirilgan
    // bo'lsa panel buni bilmasdi va "Joylandi" deb ko'rsatib turardi.
    if (req.method === "POST" && action === "sync") {
      const { data: pubs } = await supabaseAdmin
        .from("smm_posts")
        .select("id, status")
        .eq("status", "published")
        .is("deleted_at", null)
        .limit(50)

      let removed = 0
      let checked = 0
      for (const post of (pubs || []) as { id: string }[]) {
        const { data: res } = await supabaseAdmin
          .from("smm_post_results")
          .select("platform, external_id")
          .eq("post_id", post.id)
          .eq("success", true)

        const verdicts: (boolean | null)[] = []
        for (const r of (res || []) as { platform: string; external_id: string | null }[]) {
          verdicts.push(await stillExists(r.platform, r.external_id || ""))
        }
        const known = verdicts.filter((v) => v !== null)
        if (!known.length) continue // tekshirib bo'lmadi — tegmaymiz
        checked++
        // Tekshirilganlarning HAMMASI yo'q bo'lsa — o'chirilgan deb belgilaymiz
        if (known.every((v) => v === false)) {
          await supabaseAdmin.from("smm_posts")
            .update({ status: "removed", updated_at: new Date().toISOString() })
            .eq("id", post.id)
          removed++
        }
      }
      return jsonResponse({ success: true, checked, removed })
    }

    if (req.method === "POST" && action === "publish") {
      if (!id) return errorResponse("id kerak", 400)

      const { data: post, error: findErr } = await supabaseAdmin
        .from("smm_posts")
        .select("id, title, content, hashtags, image_url, cover_url, platforms, status")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle()
      if (findErr) return errorResponse(findErr.message, 500)
      if (!post) return errorResponse("Post topilmadi", 404)

      // Tanlov so'rovda kelsa o'shani ishlatamiz. Sabab: foydalanuvchi
      // postni saqlagandan KEYIN tarmoq tanlovini o'zgartirishi mumkin
      // va tugma "Tanlanganlarga joylash" deb turadi — ya'ni hozirgi
      // tanlov kutiladi, saqlangani emas.
      const body = await req.json().catch(() => ({}))
      const asked = Array.isArray(body.platforms)
        ? (body.platforms as string[]).filter((x) => (PLATFORMS as readonly string[]).includes(x))
        : []
      let platforms = (asked.length ? asked : (post.platforms || [])) as Platform[]
      if (!platforms.length) return errorResponse("Tarmoq tanlanmagan", 400)

      // Allaqachon muvaffaqiyatli joylangan tarmoqlarni takrorlamaymiz —
      // aks holda bir post ikki marta chiqib ketadi.
      const { data: done } = await supabaseAdmin
        .from("smm_post_results")
        .select("platform")
        .eq("post_id", id)
        .eq("success", true)
      const already = new Set(((done || []) as { platform: string }[]).map((d) => d.platform))
      const pending = platforms.filter((p) => !already.has(p))

      if (!pending.length) {
        return errorResponse("Bu post tanlangan tarmoqlarga allaqachon joylangan", 409)
      }
      platforms = pending

      const text = [post.content, post.hashtags].filter(Boolean).join("\n\n")
      const img = (post.image_url as string) || null
      // Video muqovasi (cover). Faqat video postda ma'noga ega —
      // Instagram REELS uchun cover_url sifatida ishlatiladi.
      const cover = (post.cover_url as string) || null

      const results: PublishResult[] = []
      for (const p of platforms) {
        if (p === "telegram") results.push(await publishTelegram(text, img))
        else if (p === "facebook") results.push(await publishFacebook(text, img))
        else if (p === "instagram") results.push(await publishInstagram(text, img, cover))
        else results.push(notReady(p))
      }

      await supabaseAdmin.from("smm_post_results").insert(
        results.map((r) => ({
          post_id: id, platform: r.platform, success: r.success,
          external_id: r.external_id || null, error: r.error || null,
        })),
      )

      // Kamida bittasi ishlasa — published. Hech biri bo'lmasa — failed.
      const anyOk = results.some((r) => r.success)
      // Yangi tarmoqlar qo'shilgan bo'lsa postda ham qayd etamiz
      const merged = Array.from(new Set([...(post.platforms || []), ...platforms]))
      await supabaseAdmin.from("smm_posts").update({
        platforms: merged,
        status: anyOk ? "published" : "failed",
        published_at: anyOk ? new Date().toISOString() : null,
        approved_by: auth.user.id,
        updated_at: new Date().toISOString(),
      }).eq("id", id)

      return jsonResponse({ success: anyOk, results })
    }

    /* ---------- Yangi post ---------- */
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const content = String(body.content || "").trim()
      if (!content) return errorResponse("Post matni bo'sh", 400)
      if (content.length > 5000) return errorResponse("Matn juda uzun", 400)

      const platforms = Array.isArray(body.platforms)
        ? (body.platforms as string[]).filter((p) => (PLATFORMS as readonly string[]).includes(p))
        : []

      const { data, error } = await supabaseAdmin.from("smm_posts").insert({
        title: body.title ? String(body.title).slice(0, 255) : null,
        content,
        hashtags: body.hashtags ? String(body.hashtags).slice(0, 500) : null,
        image_url: body.image_url ? String(body.image_url).slice(0, 1000) : null,
        cover_url: body.cover_url ? String(body.cover_url).slice(0, 1000) : null,
        platforms,
        status: "pending_approval",
        ai_generated: Boolean(body.ai_generated),
        scheduled_at: body.scheduled_at || null,
        created_by: auth.user.id,
      }).select("id").single()
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true, id: data.id })
    }

    /* ---------- Tahrirlash ---------- */
    if (req.method === "PATCH") {
      if (!id) return errorResponse("id kerak", 400)
      const body = await req.json().catch(() => ({}))
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (typeof body.title === "string") patch.title = body.title.slice(0, 255) || null
      if (typeof body.content === "string") {
        if (!body.content.trim()) return errorResponse("Post matni bo'sh", 400)
        patch.content = body.content.slice(0, 5000)
      }
      if (typeof body.hashtags === "string") patch.hashtags = body.hashtags.slice(0, 500) || null
      if (typeof body.image_url === "string") patch.image_url = body.image_url.slice(0, 1000) || null
      // cover_url null bo'lishi ham mumkin (muqova olib tashlansa)
      if ("cover_url" in body) patch.cover_url = body.cover_url ? String(body.cover_url).slice(0, 1000) : null
      if (Array.isArray(body.platforms)) {
        patch.platforms = (body.platforms as string[]).filter((p) => (PLATFORMS as readonly string[]).includes(p))
      }
      const { error } = await supabaseAdmin.from("smm_posts").update(patch).eq("id", id)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    /* ---------- O'chirish ---------- */
    // ?scope=all — tarmoqlardan ham o'chiradi. Standart holatda faqat
    // paneldan yo'qoladi, tarmoqdagi post joyida qoladi.
    if (req.method === "DELETE") {
      if (!id) return errorResponse("id kerak", 400)

      let remote: PublishResult[] = []
      if (url.searchParams.get("scope") === "all") {
        const { data: res } = await supabaseAdmin
          .from("smm_post_results")
          .select("platform, external_id")
          .eq("post_id", id)
          .eq("success", true)
        for (const r of (res || []) as { platform: string; external_id: string | null }[]) {
          // Instagram: Graph API media o'chirishni QO'LLAMAYDI (Meta
          // cheklovi, bizning nuqson emas). Ilgari jimgina o'tkazib
          // yuborilardi va panel "tarmoqlardan o'chirildi" deb YOLG'ON
          // aytardi — post esa Instagram'да qolib ketardi. Endi buni
          // ochiq aytamiz, foydalanuvchi qo'lda o'chiradi.
          if (r.platform === "instagram") {
            remote.push({
              platform: "instagram",
              success: false,
              error: "Instagram API postni o'chirishga ruxsat bermaydi — ilovadan qo'lda o'chiring",
            })
            continue
          }
          remote.push(await removeRemote(r.platform, r.external_id || ""))
        }
      }

      const { error } = await supabaseAdmin
        .from("smm_posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true, remote })
    }

    return errorResponse("Method not allowed", 405)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik", 500)
  }
})
