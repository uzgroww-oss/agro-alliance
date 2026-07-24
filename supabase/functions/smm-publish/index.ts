import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

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

const PLATFORMS = ["telegram", "facebook", "instagram", "linkedin", "youtube"] as const
type Platform = typeof PLATFORMS[number]

type PublishResult = { platform: string; success: boolean; external_id?: string; error?: string }

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
    if (imageUrl) {
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
  const pageId = await getConf("facebook", "page_id", "FACEBOOK_PAGE_ID")
  const token = await getConf("facebook", "page_token", "FACEBOOK_PAGE_TOKEN")
  if (!pageId || !token) {
    return { platform: "facebook", success: false, error: "Facebook ulanmagan" }
  }
  try {
    const endpoint = imageUrl
      ? `https://graph.facebook.com/v22.0/${pageId}/photos`
      : `https://graph.facebook.com/v22.0/${pageId}/feed`
    const payload: Record<string, string> = imageUrl
      ? { url: imageUrl, caption: text, access_token: token }
      : { message: text, access_token: token }

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
async function publishInstagram(text: string, imageUrl: string | null): Promise<PublishResult> {
  if (!imageUrl) {
    return { platform: "instagram", success: false, error: "Instagram uchun rasm majburiy" }
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
    // 1) media konteyner
    const createResp = await fetch(`https://graph.facebook.com/v22.0/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption: text.slice(0, 2200), access_token: token }),
    })
    const created = await createResp.json().catch(() => ({}))
    if (!createResp.ok || created.error) {
      return { platform: "instagram", success: false, error: igError(created.error, createResp.status) }
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

/** Hali qurilmagan tarmoqlar — aniq xabar beradi, jim yiqilmaydi */
function notReady(platform: string): PublishResult {
  const why: Record<string, string> = {
    linkedin: "LinkedIn hali ulanmagan (alohida app va OAuth kerak)",
    youtube: "YouTube hali ulanmagan (OAuth va video yuklash kerak)",
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
      const token = await getConf("facebook", "page_token", "FACEBOOK_PAGE_TOKEN")
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
      const token = await getConf("facebook", "page_token", "FACEBOOK_PAGE_TOKEN")
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
    if (action === "connections" && req.method === "GET") {
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
          Object.keys(cfg).length > 0
        if (byPlatform[c.platform]) {
          byPlatform[c.platform] = { connected: ok, display_name: c.display_name, via: "panel" }
        }
      }

      // env secret orqali ulangan bo'lsa ham "ulangan" deb ko'rsatamiz
      if (!byPlatform.telegram.connected && Deno.env.get("TELEGRAM_CHAT_ID")) {
        byPlatform.telegram = { connected: true, display_name: null, via: "secret" }
      }
      if (!byPlatform.facebook.connected && Deno.env.get("FACEBOOK_PAGE_ID") && Deno.env.get("FACEBOOK_PAGE_TOKEN")) {
        byPlatform.facebook = { connected: true, display_name: null, via: "secret" }
      }
      if (igTok?.instagram_account_id) {
        byPlatform.instagram = { connected: true, display_name: igTok.instagram_username || null, via: "oauth" }
      }

      return jsonResponse({ connections: byPlatform })
    }

    if (action === "connect" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const platform = String(body.platform || "")
      if (!(PLATFORMS as readonly string[]).includes(platform)) return errorResponse("Noma'lum tarmoq", 400)

      let config: Record<string, string> = {}
      let display = ""

      if (platform === "telegram") {
        const chatId = String(body.chat_id || "").trim()
        if (!chatId) return errorResponse("Kanal ID yoki @nom kiriting", 400)
        // Tekshiramiz: bot shu kanalga yoza oladimi?
        const token = Deno.env.get("TELEGRAM_BOT_TOKEN")
        if (!token) return errorResponse("Telegram bot tokeni yo'q", 400)
        const r = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`)
        const d = await r.json().catch(() => ({}))
        if (!r.ok || d.ok === false) {
          return errorResponse(d.description || "Kanal topilmadi. Botni kanalga admin qilib qo'shing.", 400)
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
        config = { page_id: pageId, page_token: pageToken }
        display = d.name || pageId
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
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("smm_posts")
        .select("id, seq, title, content, hashtags, image_url, platforms, status, ai_generated, scheduled_at, published_at, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50)
      if (error) return errorResponse(error.message, 500)

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
      const posts = (data || []).map((p: Record<string, unknown>) => ({
        ...p, results: resultsByPost[p.id as string] || [],
      }))
      return jsonResponse({ posts })
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
        .select("id, title, content, hashtags, image_url, platforms, status")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle()
      if (findErr) return errorResponse(findErr.message, 500)
      if (!post) return errorResponse("Post topilmadi", 404)
      if (post.status === "published") return errorResponse("Bu post allaqachon joylangan", 409)

      const platforms = (post.platforms || []) as Platform[]
      if (!platforms.length) return errorResponse("Tarmoq tanlanmagan", 400)

      const text = [post.content, post.hashtags].filter(Boolean).join("\n\n")
      const img = (post.image_url as string) || null

      const results: PublishResult[] = []
      for (const p of platforms) {
        if (p === "telegram") results.push(await publishTelegram(text, img))
        else if (p === "facebook") results.push(await publishFacebook(text, img))
        else if (p === "instagram") results.push(await publishInstagram(text, img))
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
      await supabaseAdmin.from("smm_posts").update({
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
          // Instagram o'tkazib yuboriladi: Graph API media o'chirishni
          // qo'llamaydi. Urinib xato qaytargandan ko'ra umuman
          // tegmaymiz — Instagram'dan post joyida qoladi.
          if (r.platform === "instagram") continue
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
