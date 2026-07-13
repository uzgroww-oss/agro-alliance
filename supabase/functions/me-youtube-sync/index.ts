import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * me-youtube-sync — YouTube kanal URL'dan banner va profil rasmini avtomatik oladi.
 * Blogger o'z profiliga YouTube kanal linkini qo'shadi, sistema avtomatik rasmlarni sinxronlaydi.
 */

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")

interface YouTubeChannel {
  id: string
  snippet: {
    title: string
    description: string
    thumbnails: {
      default?: { url: string }
      medium?: { url: string }
      high?: { url: string }
      standard?: { url: string }
      maxres?: { url: string }
    }
  }
  brandingSettings?: {
    image?: {
      bannerExternalUrl?: string
      bannerImageUrl?: string
    }
  }
}

/** YouTube URL'dan channel ID ni ajratib olish */
function extractChannelId(url: string): string | null {
  // /channel/UCxxxxx format
  const channelMatch = url.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)
  if (channelMatch) return channelMatch[1]

  // /@handle format — keyin API orqali resolve qilinadi
  const handleMatch = url.match(/\/@([a-zA-Z0-9_.-]+)/)
  if (handleMatch) return handleMatch[1] // handle qaytariladi, keyin resolve qilinadi

  // /user/username format
  const userMatch = url.match(/\/user\/([a-zA-Z0-9_-]+)/)
  if (userMatch) return userMatch[1]

  return null
}

/** YouTube API'dan kanal ma'lumotlarini olish */
async function fetchChannelData(channelIdOrHandle: string): Promise<YouTubeChannel | null> {
  if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY sozlanmagan")

  // Avval to'g'ridan-to'g'ri channel ID sifatida urinib ko'ramiz
  let url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings&id=${channelIdOrHandle}&key=${YOUTUBE_API_KEY}`

  let resp = await fetch(url)
  let data = await resp.json()

  // Agar natija bo'sh bo'lsa, handle sifatida qidiramiz
  if (!data.items || data.items.length === 0) {
    url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings&forHandle=${channelIdOrHandle}&key=${YOUTUBE_API_KEY}`
    resp = await fetch(url)
    data = await resp.json()
  }

  if (!data.items || data.items.length === 0) return null
  return data.items[0] as YouTubeChannel
}

/** Eng yuqori sifatli thumbnail URL ni olish */
function getBestThumbnail(thumbnails: YouTubeChannel["snippet"]["thumbnails"]): string {
  if (thumbnails.maxres?.url) return thumbnails.maxres.url
  if (thumbnails.standard?.url) return thumbnails.standard.url
  if (thumbnails.high?.url) return thumbnails.high.url
  if (thumbnails.medium?.url) return thumbnails.medium.url
  return thumbnails.default?.url || ""
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    const body = await req.json().catch(() => ({}))
    const youtubeUrl = body.youtube_url?.trim()

    if (!youtubeUrl) {
      return errorResponse("YouTube kanal linkini kiriting", 400)
    }

    // URL format tekshirish
    if (!youtubeUrl.match(/(youtube\.com|youtu\.be)/i)) {
      return errorResponse("Yaroqli YouTube URL kiriting", 400)
    }

    // Channel ID ni ajratish
    const channelIdOrHandle = extractChannelId(youtubeUrl)
    if (!channelIdOrHandle) {
      return errorResponse("YouTube kanal ID aniqlanmadi", 400)
    }

    // YouTube API'dan kanal ma'lumotlarini olish
    const channel = await fetchChannelData(channelIdOrHandle)
    if (!channel) {
      return errorResponse("YouTube kanali topilmadi", 404)
    }

    // Profil rasmni olish (eng yuqori sifatli)
    const avatarUrl = getBestThumbnail(channel.snippet.thumbnails)

    // Banner rasmni olish
    let bannerUrl = channel.brandingSettings?.image?.bannerExternalUrl || ""
    if (!bannerUrl) {
      bannerUrl = channel.brandingSettings?.image?.bannerImageUrl || ""
    }
    // Agar banner URL https://yt3 bo'lsa, to'g'ridan-to'g'ri ishlatish mumkin
    // Lekin ba'zan CORS muammosi bo'lishi mumkin, shuning uchun proxy kerak

    const userId = auth.user.id

    // Profilni yangilash
    const profileUpdates: Record<string, unknown> = {}
    if (avatarUrl) {
      profileUpdates.avatar = avatarUrl
    }

    // Metadata ga YouTube kanal linkini saqlash
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", userId)
      .is("deleted_at", null)
      .single()

    const existingMeta = (currentProfile?.metadata as Record<string, unknown>) || {}
    profileUpdates.metadata = {
      ...existingMeta,
      youtube_channel: youtubeUrl,
      youtube_channel_id: channel.id,
      youtube_channel_name: channel.snippet.title,
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdates)
      .eq("id", userId)
      .is("deleted_at", null)

    if (profileError) {
      return errorResponse(profileError.message, 500)
    }

    // Banner ni bloggers jadvalida saqlash
    if (bannerUrl) {
      const { error: bannerError } = await supabaseAdmin
        .from("bloggers")
        .update({ cover: bannerUrl })
        .eq("id", userId)
        .is("deleted_at", null)

      if (bannerError) {
        console.error("Banner save error:", bannerError.message)
      }
    }

    return jsonResponse({
      success: true,
      avatar: avatarUrl,
      banner: bannerUrl,
      channel_name: channel.snippet.title,
      channel_id: channel.id,
    })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
