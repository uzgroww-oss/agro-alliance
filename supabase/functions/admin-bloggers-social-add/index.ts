import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { now } from "../_shared/time.ts"

/**
 * Havoladan platformani aniqlaydi.
 *
 * MUHIM: ilgari `url.includes("instagram.com")` — BUTUN satr bo'yicha
 * qidirilardi. Ya'ni `http://169.254.169.254/meta-data/?instagram.com`
 * ham tekshiruvdan o'tardi, keyin server o'sha manzilni yuklardi (SSRF).
 * Endi faqat HOST nomi solishtiriladi va u aniq ro'yxatga mos kelishi shart.
 */
const PLATFORM_HOSTS: [string[], { key: string; name: string }][] = [
  [["youtube.com", "youtu.be"], { key: "youtube", name: "YouTube" }],
  [["instagram.com"], { key: "instagram", name: "Instagram" }],
  [["tiktok.com"], { key: "tiktok", name: "TikTok" }],
  [["t.me", "telegram.org", "telegram.me"], { key: "telegram", name: "Telegram" }],
  [["facebook.com", "fb.com"], { key: "facebook", name: "Facebook" }],
  [["x.com", "twitter.com"], { key: "x", name: "X" }],
  [["linkedin.com"], { key: "linkedin", name: "LinkedIn" }],
]

function detectPlatform(url: string): { key: string; name: string } | null {
  let host: string
  try {
    const u = new URL(url)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    host = u.hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
  for (const [domains, plat] of PLATFORM_HOSTS) {
    if (domains.some((d) => host === d || host.endsWith("." + d))) return plat
  }
  return null
}

function extractName(url: string): string {
  try {
    const u = new URL(url)
    const segments = u.pathname.replace(/\/$/, "").split("/")
    const last = segments[segments.length - 1] || ""
    return last.replace(/^@/, "")
  } catch {
    return url
  }
}

async function fetchYoutubeStats(handle: string): Promise<{ subscribers: number; views: number; videos: number } | null> {
  try {
    const apiKey = Deno.env.get("YOUTUBE_API_KEY")
    if (!apiKey) return null
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forHandle=${handle}&key=${apiKey}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.items?.[0]?.statistics) return null
    const s = data.items[0].statistics
    return {
      subscribers: parseInt(s.subscriberCount) || 0,
      views: parseInt(s.viewCount) || 0,
      videos: parseInt(s.videoCount) || 0,
    }
  } catch {
    return null
  }
}

async function fetchTelegramStats(handle: string): Promise<{ members: number } | null> {
  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN")
    if (!token) return null
    const url = `https://api.telegram.org/bot${token}/getChat?chat_id=@${handle}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ok || !data.result) return null
    return {
      members: data.result.member_count || (data.result.subscriber_count ?? 0),
    }
  } catch {
    return null
  }
}

async function fetchGenericStats(url: string): Promise<{ subscribers: number } | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    if (!res.ok) return null
    const html = await res.text()
    const matches = html.match(/"subscriberCount":(\d+)/) || html.match(/"followerCount":(\d+)/) || html.match(/subscriber_count[^"]*"[^"]*"(\d+)/)
    if (matches) return { subscribers: parseInt(matches[1]) || 0 }
    return null
  } catch {
    return null
  }
}

async function fetchInstagramStats(username: string): Promise<{ followers: number; following: number; posts: number } | null> {
  try {
    // Instagram oEmbed API — faqat post ma'lumotlarini beradi, followers EMAS
    // Shuning uchun biz scraping yoki third-party service ishlatamiz
    // Hozircha faqat username ni qaytaramiz
    return null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await requireRole(req, "super_admin", "admin")
    if (auth.response) return auth.response

    const bloggerId = new URL(req.url).searchParams.get("blogger_id")
    if (!bloggerId) return errorResponse("blogger_id kerak", 400)

    const body = await req.json().catch(() => ({}))
    const errors = validate(body, { links: [required] })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const links: string[] = body.links
    const results: Array<{ url: string; platform: string; name: string; subscribers: number; views: number; engagement: number; error?: string }> = []

    for (const link of links) {
      const platform = detectPlatform(link)
      if (!platform) {
        results.push({ url: link, platform: "unknown", name: "", subscribers: 0, views: 0, engagement: 0, error: "Platformani aniqlab bo'lmadi" })
        continue
      }

      const { data: platformRow } = await supabaseAdmin
        .from("social_platforms")
        .select("id")
        .eq("key", platform.key)
        .single()

      if (!platformRow) {
        results.push({ url: link, platform: platform.name, name: "", subscribers: 0, views: 0, engagement: 0, error: "Platforma topilmadi" })
        continue
      }

      const { data: existing } = await supabaseAdmin
        .from("social_accounts")
        .select("id")
        .eq("blogger_id", bloggerId)
        .eq("platform_id", platformRow.id)
        .is("deleted_at", null)
        .maybeSingle()

      if (existing) {
        results.push({ url: link, platform: platform.name, name: "", subscribers: 0, views: 0, engagement: 0, error: "Bu platforma allaqachon qo'shilgan" })
        continue
      }

      const accountName = extractName(link) || platform.name
      let subscribers = 0
      let views = 0
      let engagement = 0

      if (platform.key === "youtube") {
        const stats = await fetchYoutubeStats(accountName)
        if (stats) {
          subscribers = stats.subscribers
          views = stats.views
          engagement = stats.subscribers > 0 ? Math.round(((stats.views / stats.subscribers) / 52) * 100 * 10) / 10 : 0
        }
      } else if (platform.key === "telegram") {
        const stats = await fetchTelegramStats(accountName)
        if (stats) {
          subscribers = stats.members
        }
      } else {
        const stats = await fetchGenericStats(link)
        if (stats) {
          subscribers = stats.subscribers
        }
      }

      const { data: newAccount, error: insertError } = await supabaseAdmin
        .from("social_accounts")
        .insert({
          blogger_id: bloggerId,
          platform_id: platformRow.id,
          account_name: accountName,
          profile_url: link,
          is_active: true,
          connected_at: now(),
        })
        .select("id")
        .single()

      if (insertError || !newAccount) {
        results.push({ url: link, platform: platform.name, name: accountName, subscribers: 0, views: 0, engagement: 0, error: insertError?.message || "Xatolik" })
        continue
      }

      if (subscribers > 0 || views > 0) {
        await supabaseAdmin
          .from("social_statistics")
          .insert({
            account_id: newAccount.id,
            subscribers_count: subscribers,
            views_count: views,
            engagement_rate: engagement,
            snapshot_date: new Date().toISOString().split("T")[0],
          })
      }

      results.push({ url: link, platform: platform.name, name: accountName, subscribers, views, engagement })
    }

    return jsonResponse({ success: true, results })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
