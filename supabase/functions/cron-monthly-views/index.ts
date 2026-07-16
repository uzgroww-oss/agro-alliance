/**
 * cron-monthly-views — "O'tgan oy" ko'rishlari (YouTube + Instagram).
 * Har bir kanal/akkauntning O'TGAN KALENDAR OYIDA chiqargan kontentining
 * ko'rishlari yig'indisi = "Oylik ko'rishlar" ko'rsatkichi.
 *
 * YouTube: o'tgan oyda yuklangan videolarning viewCount yig'indisi.
 * Instagram: o'tgan oyda joylangan reels/postlarning view_count yig'indisi
 *            (admin OAuth tokeni orqali business_discovery).
 *
 * ?month=YYYY-MM bilan ma'lum oyni ham hisoblash mumkin (test uchun).
 */
import { supabaseAdmin } from "../_shared/supabase.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"

const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") || ""

/* ---------------- YouTube ---------------- */
function extractHandle(url: string): string | null {
  const m = url.match(/\/@([a-zA-Z0-9_.-]+)/)
  if (m) return m[1]
  const c = url.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)
  if (c) return c[1]
  return null
}

async function ytUploads(handle: string): Promise<string | null> {
  const isId = handle.startsWith("UC")
  const param = isId ? `id=${handle}` : `forHandle=${encodeURIComponent(handle)}`
  const u = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${param}&key=${YT_KEY}`
  const r = await fetch(u)
  if (!r.ok) return null
  const d = await r.json()
  return d.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null
}

async function ytMonthViews(handle: string, startIso: string, endIso: string): Promise<number> {
  const uploads = await ytUploads(handle)
  if (!uploads) return 0
  const ids: string[] = []
  let pageToken = ""
  for (let page = 0; page < 6; page++) {
    const u = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}&key=${YT_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`
    const r = await fetch(u); const d = await r.json()
    let anyInOrNewer = false
    for (const it of d.items || []) {
      const pub = it.contentDetails?.videoPublishedAt
      if (!pub) continue
      if (pub >= startIso && pub < endIso) ids.push(it.contentDetails.videoId)
      if (pub >= startIso) anyInOrNewer = true
    }
    const last = d.items?.[d.items.length - 1]?.contentDetails?.videoPublishedAt
    if (!d.nextPageToken || (last && last < startIso && !anyInOrNewer)) break
    pageToken = d.nextPageToken
  }
  let views = 0
  for (let i = 0; i < ids.length; i += 50) {
    const u = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.slice(i, i + 50).join(",")}&key=${YT_KEY}`
    const r = await fetch(u); const d = await r.json()
    for (const v of d.items || []) views += Number(v.statistics?.viewCount || 0)
  }
  return views
}

/* ---------------- Instagram ---------------- */
function extractIgUsername(url: string): string | null {
  const m = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/)
  return m ? m[1].replace(/\/$/, "") : null
}

async function igMonthViews(token: string, accountId: string, username: string, startIso: string, endIso: string): Promise<number> {
  const mediaFields = "id,media_type,timestamp,view_count"
  let after = ""
  let views = 0
  for (let page = 0; page < 15; page++) {
    const mediaEdge = after
      ? `media.limit(50).after(${after}){${mediaFields}}`
      : `media.limit(50){${mediaFields}}`
    const url = `https://graph.facebook.com/v22.0/${accountId}?fields=business_discovery.username(${username}){${mediaEdge}}&access_token=${token}`
    const r = await fetch(url); const d = await r.json()
    // API xatosi (masalan rate-limit) birinchi sahifada bo'lsa — null qaytaramiz,
    // shunda eski qiymat 0 bilan yozib yuborilmaydi (ma'lumot yo'qolmasin)
    if (d.error) return page === 0 ? null : views
    const bd = d.business_discovery
    if (!bd) return page === 0 ? null : views
    const items = bd.media?.data || []
    let reachedOlder = false
    for (const m of items) {
      const ts = m.timestamp
      if (!ts) continue
      if (ts >= startIso && ts < endIso) views += Number(m.view_count || 0)
      if (ts < startIso) reachedOlder = true
    }
    const next = bd.media?.paging?.cursors?.after
    if (!next || items.length === 0 || reachedOlder) break
    after = next
  }
  return views
}

/* ---------------- Main ---------------- */
Deno.serve(async (req) => {
  // XAVFSIZLIK: faqat maxfiy kalit bilan chaqirilishi mumkin (pg_cron header yuboradi)
  const CRON_SECRET = Deno.env.get("CRON_SECRET") || ""
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return errorResponse("Forbidden", 403)
  }

  const url = new URL(req.url)
  const monthParam = url.searchParams.get("month")
  let year: number, month: number
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number); year = y; month = m - 1
  } else {
    const now = new Date()
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    year = prev.getUTCFullYear(); month = prev.getUTCMonth()
  }
  const startIso = new Date(Date.UTC(year, month, 1)).toISOString()
  const endIso = new Date(Date.UTC(year, month + 1, 1)).toISOString()
  const label = `${year}-${String(month + 1).padStart(2, "0")}`

  // Platformalar
  const { data: platforms } = await supabaseAdmin.from("social_platforms").select("id, key").is("deleted_at", null)
  const ytId = platforms?.find((p: { key: string }) => p.key === "youtube")?.id
  const igId = platforms?.find((p: { key: string }) => p.key === "instagram")?.id

  // Instagram admin tokeni (muddati tugagan bo'lsa yangilash)
  const { data: tok } = await supabaseAdmin
    .from("instagram_tokens").select("id, access_token, instagram_account_id, expires_at")
    .order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (tok && new Date(tok.expires_at) < new Date()) {
    const appId = Deno.env.get("FACEBOOK_APP_ID") || ""
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET") || ""
    try {
      const rr = await fetch(`https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tok.access_token}`)
      const rd = await rr.json()
      if (rd.access_token) {
        tok.access_token = rd.access_token
        await supabaseAdmin.from("instagram_tokens").update({
          access_token: rd.access_token,
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        }).eq("id", tok.id)
      }
    } catch { /* token yangilanmasa IG o'tkazib yuboriladi */ }
  }

  const { data: accounts } = await supabaseAdmin
    .from("social_accounts")
    .select("id, platform_id, profile_url")
    .is("deleted_at", null)
    .in("platform_id", [ytId, igId].filter(Boolean))

  const today = new Date().toISOString().slice(0, 10)
  let ytTotal = 0, igTotal = 0, ytCount = 0, igCount = 0
  const details: Array<{ platform: string; name: string; views: number }> = []

  let skipped = 0
  for (const acc of accounts || []) {
    let views: number | null = 0
    let platform = ""
    if (acc.platform_id === ytId) {
      const handle = extractHandle(String(acc.profile_url || ""))
      if (!handle) continue
      views = await ytMonthViews(handle, startIso, endIso)
      platform = "yt"
    } else if (acc.platform_id === igId && tok?.instagram_account_id) {
      const uname = extractIgUsername(String(acc.profile_url || ""))
      if (!uname) continue
      views = await igMonthViews(tok.access_token, tok.instagram_account_id, uname, startIso, endIso)
      platform = "ig"
    } else continue

    // API xatosi (null) bo'lsa — eski qiymatni saqlab qolamiz, 0 bilan yozib yubormaymiz
    if (views === null) { skipped++; continue }

    if (platform === "yt") { ytTotal += views; ytCount++ } else { igTotal += views; igCount++ }
    details.push({ platform, name: String(acc.profile_url || ""), views })

    // social_statistics eng so'nggi yozuviga oylik ko'rishni saqlash
    const { data: stat } = await supabaseAdmin
      .from("social_statistics").select("id")
      .eq("account_id", acc.id).is("deleted_at", null)
      .order("snapshot_date", { ascending: false }).limit(1).maybeSingle()
    if (stat) {
      await supabaseAdmin.from("social_statistics").update({ views_count: views }).eq("id", stat.id)
    } else {
      await supabaseAdmin.from("social_statistics")
        .insert({ account_id: acc.id, views_count: views, snapshot_date: today })
    }
  }

  return jsonResponse({
    ok: true, month: label, skipped,
    youtube: { accounts: ytCount, views: ytTotal },
    instagram: { accounts: igCount, views: igTotal },
    total_monthly_views: ytTotal + igTotal,
    top: details.sort((a, b) => b.views - a.views).slice(0, 10),
  })
})
