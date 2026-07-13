import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * me-youtube-videos — YouTube kanal videolarini olish va saqlash
 * Blogger dashboard'dan chaqiriladi
 */

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")

/** YouTube kanal videolarini olish */
async function fetchYouTubeVideos(channelIdOrHandle: string): Promise<Array<{ id: string; title: string; thumbnail: string; publishedAt: string; viewCount: string }>> {
  if (!YOUTUBE_API_KEY) return []

  try {
    // 1. Avval kanal ID'sini topish (channels endpoint orqali)
    let realChannelId = ""

    // forHandle orqali sinash
    let url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${channelIdOrHandle}&key=${YOUTUBE_API_KEY}`
    let resp = await fetch(url)
    let data = await resp.json()
    console.log("YouTube channels API response:", JSON.stringify(data).substring(0, 200))

    if (data.items && data.items.length > 0) {
      realChannelId = data.items[0].id
    }

    // Agar topilmasa, forUsername orqali sinash
    if (!realChannelId) {
      url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forUsername=${channelIdOrHandle}&key=${YOUTUBE_API_KEY}`
      resp = await fetch(url)
      data = await resp.json()
      if (data.items && data.items.length > 0) {
        realChannelId = data.items[0].id
      }
    }

    // Agar hali topilmasa, to'g'ridan-to'g'ri ID sifatida sinash
    if (!realChannelId && channelIdOrHandle.startsWith("UC")) {
      realChannelId = channelIdOrHandle
    }

    // Agar kanal topilmasa
    if (!realChannelId) {
      console.error("YouTube kanal topilmadi:", channelIdOrHandle)
      return []
    }

    console.log("YouTube real channel ID:", realChannelId)

    // 2. Endi kanal ID'si bilan videolarni olish
    url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${realChannelId}&maxResults=50&type=video&order=date&key=${YOUTUBE_API_KEY}`
    resp = await fetch(url)
    data = await resp.json()
    console.log("YouTube search response:", JSON.stringify(data).substring(0, 300))

    if (!data.items || data.items.length === 0) {
      console.error("YouTube videolar topilmadi")
      return []
    }

    // Har bir video uchun ko'rishlar sonini olish
    const videoIds = data.items.map((item: any) => item.id.videoId).join(",")
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    const statsResp = await fetch(statsUrl)
    const statsData = await statsResp.json()

    return data.items.map((item: any, index: number) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
      publishedAt: item.snippet.publishedAt?.split("T")[0] || "",
      viewCount: statsData.items?.[index]?.statistics?.viewCount || "0",
    }))
  } catch (e) {
    console.error("YouTube videos olishda xatolik:", e)
    return []
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    // Foydalanuvchi metadata'sidan YouTube kanal ID'sini olish
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", auth.user.id)
      .is("deleted_at", null)
      .single()

    const meta = (profile?.metadata as Record<string, unknown>) || {}
    const channelId = meta.youtube_channel_id as string
    const youtubeChannel = meta.youtube_channel as string

    console.log("YouTube metadata:", JSON.stringify({ channelId, youtubeChannel }))

    if (!channelId && !youtubeChannel) {
      return errorResponse("YouTube kanal ulanmagan. Avval YouTube kanalni sinxronlang.", 404)
    }

    // Agar channelId yo'q bo'lsa, youtube_channel URL'dan olishga urinib ko'ramiz
    const channelToFetch = channelId || youtubeChannel
    if (!channelToFetch) {
      return errorResponse("YouTube kanal ma'lumotlari topilmadi", 404)
    }

    // YouTube kanal videolarini olish
    const videos = await fetchYouTubeVideos(channelToFetch)
    console.log("YouTube videos found:", videos.length)

    return jsonResponse({ videos })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
