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

/* ---------------- Telegram ---------------- */
/** worker-telegram-publish mantiqidan olingan; rasm bo'lsa sendPhoto, bo'lmasa sendMessage */
async function publishTelegram(text: string, imageUrl: string | null): Promise<PublishResult> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID")
  if (!token) return { platform: "telegram", success: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan" }
  if (!chatId) return { platform: "telegram", success: false, error: "TELEGRAM_CHAT_ID sozlanmagan" }

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
  const pageId = Deno.env.get("FACEBOOK_PAGE_ID")
  const token = Deno.env.get("FACEBOOK_PAGE_TOKEN")
  if (!pageId || !token) {
    return { platform: "facebook", success: false, error: "Facebook Page sozlanmagan" }
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

/* ---------------- Instagram (2 bosqich) ---------------- */
async function publishInstagram(text: string, imageUrl: string | null): Promise<PublishResult> {
  if (!imageUrl) {
    return { platform: "instagram", success: false, error: "Instagram uchun rasm majburiy" }
  }
  const igUserId = Deno.env.get("INSTAGRAM_USER_ID")
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") || Deno.env.get("FACEBOOK_PAGE_TOKEN")
  if (!igUserId || !token) {
    return { platform: "instagram", success: false, error: "Instagram sozlanmagan" }
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
      return { platform: "instagram", success: false, error: created.error?.message || `HTTP ${createResp.status}` }
    }
    // 2) publish
    const pubResp = await fetch(`https://graph.facebook.com/v22.0/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: created.id, access_token: token }),
    })
    const published = await pubResp.json().catch(() => ({}))
    if (!pubResp.ok || published.error) {
      return { platform: "instagram", success: false, error: published.error?.message || `HTTP ${pubResp.status}` }
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

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    const action = url.searchParams.get("action")

    /* ---------- Ro'yxat ---------- */
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("smm_posts")
        .select("id, title, content, hashtags, image_url, platforms, status, ai_generated, scheduled_at, published_at, created_at")
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
    if (req.method === "DELETE") {
      if (!id) return errorResponse("id kerak", 400)
      const { error } = await supabaseAdmin
        .from("smm_posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    return errorResponse("Method not allowed", 405)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik", 500)
  }
})
