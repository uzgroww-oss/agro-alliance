import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

interface PlatformMatch {
  name: string
  key: string
  pattern: RegExp
}

const PLATFORMS: PlatformMatch[] = [
  {
    name: "YouTube",
    key: "youtube",
    pattern: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i,
  },
  {
    name: "Instagram",
    key: "instagram",
    pattern: /^(https?:\/\/)?(www\.)?instagram\.com\/.+/i,
  },
  {
    name: "TikTok",
    key: "tiktok",
    pattern: /^(https?:\/\/)?(www\.)?tiktok\.com\/.+/i,
  },
  {
    name: "Telegram",
    key: "telegram",
    pattern: /^(https?:\/\/)?(t\.me|telegram\.org)\/.+/i,
  },
  {
    name: "Facebook",
    key: "facebook",
    pattern: /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.com)\/.+/i,
  },
  {
    name: "X",
    key: "x",
    pattern: /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/.+/i,
  },
  {
    name: "LinkedIn",
    key: "linkedin",
    pattern: /^(https?:\/\/)?(www\.)?linkedin\.com\/.+/i,
  },
]

function isValidHttpUrl(str: string): boolean {
  try {
    const url = new URL(str.startsWith("http") ? str : `https://${str}`)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function detectPlatform(url: string): string | null {
  const cleanUrl = url.startsWith("http") ? url : `https://${url}`
  for (const p of PLATFORMS) {
    if (p.pattern.test(cleanUrl)) return p.name
  }
  return null
}

/** YouTube video nomi va rasmini oEmbed orqali olish (API kalitsiz) */
async function fetchYouTubeOEmbed(url: string): Promise<{ title: string; thumbnail: string } | null> {
  try {
    const resp = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
    if (!resp.ok) return null
    const data = await resp.json()
    return {
      title: data.title || "",
      thumbnail: data.thumbnail_url || "",
    }
  } catch {
    return null
  }
}

/** YouTube video ID ni linkdan ajratib olish */
function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST" && req.method !== "DELETE") {
    return errorResponse("Method not allowed", 405)
  }

  const authTop = await verifyAuth(req)
  if (authTop.response) return authTop.response

  // --- O'chirish (me-videos-delete birlashtirilgan) ---
  if (req.method === "DELETE") {
    try {
      const id = new URL(req.url).searchParams.get("id")
      if (!id) return errorResponse("ID kerak", 400)
      const { data: profile } = await supabaseAdmin.from("profiles").select("metadata").eq("id", authTop.user.id).is("deleted_at", null).single()
      if (!profile) return errorResponse("Profil topilmadi", 404)
      const meta = (profile.metadata as Record<string, unknown>) || {}
      const videos = (meta.videos as unknown[]) || []
      const filtered = videos.filter((v: unknown) => (v as Record<string, unknown>).id !== id)
      if (filtered.length === videos.length) return errorResponse("Video topilmadi", 404)
      const { error } = await supabaseAdmin.from("profiles").update({ metadata: { ...meta, videos: filtered } }).eq("id", authTop.user.id).is("deleted_at", null)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
    }
  }

  try {
    const auth = authTop

    const body = await req.json().catch(() => ({}))
    const errors = validate(body, { link: [required] })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    // 1. URL format validatsiyasi
    if (!isValidHttpUrl(body.link)) {
      return errorResponse("Yaroqli URL formatida emas", 400)
    }

    // 2. Platformani aniqlash
    const platform = detectPlatform(body.link)
    if (!platform) {
      return errorResponse(
        "Platformani aniqlab bo'lmadi. Qo'llab-quvvatlanadigan platformalar: YouTube, Instagram, TikTok, Telegram, Facebook, X, LinkedIn",
        400,
      )
    }

    const userId = auth.user.id

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", userId)
      .is("deleted_at", null)
      .single()

    if (!profile) {
      return errorResponse("Profil topilmadi", 404)
    }

    const meta = (profile.metadata as Record<string, unknown>) || {}
    const videos = (meta.videos as unknown[]) || []

    // 3. Duplicate link tekshirish
    const isDuplicate = videos.some(
      (v: unknown) => (v as { link: string }).link === body.link,
    )
    if (isDuplicate) {
      return errorResponse("Bu video allaqachon qo'shilgan", 409)
    }

    // 4. Nom yoki rasm berilmagan bo'lsa — YouTube uchun avtomatik oEmbed orqali olish
    let resolvedName = body.name
    let resolvedThumbnail = body.thumbnail
    if (platform === "YouTube" && (!resolvedName || !resolvedThumbnail)) {
      const oembed = await fetchYouTubeOEmbed(body.link)
      if (oembed) {
        if (!resolvedName && oembed.title) resolvedName = oembed.title
        if (!resolvedThumbnail && oembed.thumbnail) resolvedThumbnail = oembed.thumbnail
      }
    }

    const videoEntry = {
      id: body.youtube_id || extractYouTubeId(body.link) || crypto.randomUUID(),
      name: resolvedName || "Video",
      link: body.link,
      views: body.views || "0",
      plats: [platform],
      date: body.date || new Date().toISOString().split("T")[0],
      status: "published",
      thumbnail: resolvedThumbnail || null,
      author: auth.user.name,
    }

    videos.push(videoEntry)

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        metadata: { ...meta, videos },
      })
      .eq("id", userId)
      .is("deleted_at", null)

    if (updateError) {
      return errorResponse(updateError.message, 500)
    }

    return jsonResponse({ success: true, video: videoEntry })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
