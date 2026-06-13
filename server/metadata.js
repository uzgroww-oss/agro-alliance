/**
 * Auto-fetch metadata for blogger channels & videos.
 * Works WITHOUT API keys via oEmbed + Open Graph scraping.
 * If process.env.YT_API_KEY is set, YouTube gets richer data (views, subs).
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36"

async function getText(url, ms = 7000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, signal: ctrl.signal, redirect: "follow" })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function getJson(url, ms = 7000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

const normUrl = (u) => (/^https?:\/\//i.test(u) ? u : "https://" + u)

export function detectPlatform(url) {
  const u = String(url).toLowerCase()
  if (/youtube\.com|youtu\.be/.test(u)) return "YouTube"
  if (/instagram\.com/.test(u)) return "Instagram"
  if (/tiktok\.com/.test(u)) return "TikTok"
  if (/(^|\/\/|\.)t\.me|telegram\.me|telegram\.org/.test(u)) return "Telegram"
  if (/facebook\.com|fb\.com|fb\.watch/.test(u)) return "Facebook"
  return "Boshqa"
}

function decode(s) {
  if (!s) return s
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'")
}

function ogMeta(html, prop) {
  if (!html) return null
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return decode(m[1])
  }
  return null
}

function formatNum(n) {
  n = Number(n)
  if (!isFinite(n)) return null
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B"
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K"
  return String(n)
}

function ytVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

function extractHandle(url) {
  try {
    const u = new URL(normUrl(url))
    const at = u.pathname.match(/@([A-Za-z0-9._-]+)/)
    if (at) return "@" + at[1]
    const seg = u.pathname.split("/").filter(Boolean)
    return seg[seg.length - 1] || u.hostname
  } catch {
    return url
  }
}

/* ---------- VIDEO ---------- */
export async function fetchVideoMeta(url) {
  const norm = normUrl(url)
  const platform = detectPlatform(norm)
  const out = { platform, title: null, author: null, thumbnail: null, views: null, date: null }

  // 1) oEmbed → title / author / thumbnail (no key)
  let oe = null
  if (platform === "YouTube") oe = await getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(norm)}&format=json`)
  else if (platform === "TikTok") oe = await getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(norm)}`)
  else oe = await getJson(`https://noembed.com/embed?url=${encodeURIComponent(norm)}`)
  if (oe && !oe.error) {
    out.title = oe.title || out.title
    out.author = oe.author_name || out.author
    out.thumbnail = oe.thumbnail_url || out.thumbnail
  }

  // 2) YouTube — views & date (Data API if key, else scrape watch page)
  if (platform === "YouTube") {
    const id = ytVideoId(norm)
    const key = process.env.YT_API_KEY
    if (key && id) {
      const d = await getJson(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${id}&key=${key}`)
      const it = d?.items?.[0]
      if (it) {
        out.title = it.snippet?.title || out.title
        out.author = it.snippet?.channelTitle || out.author
        out.thumbnail = it.snippet?.thumbnails?.medium?.url || out.thumbnail
        out.views = formatNum(it.statistics?.viewCount) || out.views
        out.date = it.snippet?.publishedAt?.slice(0, 10) || out.date
      }
    } else if (id) {
      const html = await getText(`https://www.youtube.com/watch?v=${id}&hl=en`)
      if (html) {
        const vm = html.match(/"viewCount":"(\d+)"/)
        if (vm) out.views = formatNum(vm[1])
        const dm = html.match(/"(?:publishDate|uploadDate)":"([\d-]+)"/)
        if (dm) out.date = dm[1]
        if (!out.thumbnail) { const im = html.match(/"thumbnailUrl":\["([^"]+)"/); if (im) out.thumbnail = im[1] }
      }
    }
  }

  return out
}

/* ---------- CHANNEL ---------- */
export async function fetchChannelMeta(url) {
  const norm = normUrl(url)
  const platform = detectPlatform(norm)
  const out = { platform, name: null, avatar: null, subscribers: null, handle: extractHandle(norm), description: null }

  const html = await getText(norm)
  if (html) {
    out.name = ogMeta(html, "og:title") || out.handle
    out.avatar = ogMeta(html, "og:image")
    out.description = ogMeta(html, "og:description")

    if (platform === "Telegram") {
      // t.me/<channel> public preview page exposes "123 456 subscribers/members"
      const sm = html.match(/<div class="tgme_page_extra">([^<]+)<\/div>/)
      if (sm) {
        const num = sm[1].match(/([\d\s.,]+)\s*(subscribers|members|подписчик)/i)
        if (num) out.subscribers = num[1].replace(/[\s,]/g, "")
      }
    } else if (platform === "YouTube") {
      let sm = html.match(/"subscriberCountText"[^}]*?"simpleText":"([^"]+)"/)
      if (!sm) sm = html.match(/"metadataParts":\[\{"text":\{"content":"([\d.,KMB]+ subscribers)"/)
      if (sm) out.subscribers = sm[1].replace(/ subscribers/i, "")
      if (out.description) { const d = out.description.match(/([\d.,]+[KMB]?)\s*subscribers/i); if (d && !out.subscribers) out.subscribers = d[1] }
    } else if (out.description) {
      const d = out.description.match(/([\d.,]+[KMB]?)\s*(followers|subscribers|Followers)/i)
      if (d) out.subscribers = d[1]
    }
  }

  // Normalize raw digit counts → 10.4M
  if (out.subscribers && /^\d+$/.test(out.subscribers)) out.subscribers = formatNum(out.subscribers)

  // YouTube Data API (optional) for accurate subscriber count
  if (platform === "YouTube" && process.env.YT_API_KEY) {
    try {
      const handle = out.handle?.replace(/^@/, "")
      const search = await getJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle || norm)}&maxResults=1&key=${process.env.YT_API_KEY}`)
      const chId = search?.items?.[0]?.snippet?.channelId
      if (chId) {
        const ch = await getJson(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${chId}&key=${process.env.YT_API_KEY}`)
        const it = ch?.items?.[0]
        if (it) {
          out.name = it.snippet?.title || out.name
          out.avatar = it.snippet?.thumbnails?.default?.url || out.avatar
          out.subscribers = formatNum(it.statistics?.subscriberCount) || out.subscribers
        }
      }
    } catch { /* ignore */ }
  }

  return out
}
