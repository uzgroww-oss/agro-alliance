import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * me-profile-update — Profil ma'lumotlarini yangilash + YouTube kanal sinxronlash
 */

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")

interface YouTubeChannel {
  id: string
  snippet: {
    title: string
    thumbnails: { maxres?: { url: string }; standard?: { url: string }; high?: { url: string }; medium?: { url: string }; default?: { url: string } }
  }
  brandingSettings?: { image?: { bannerExternalUrl?: string } }
  statistics?: {
    subscriberCount?: string
    viewCount?: string
    videoCount?: string
    hiddenSubscriberCount?: boolean
  }
}

function extractChannelId(url: string): string | null {
  // /channel/UCxxxxx format
  const channelMatch = url.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)
  if (channelMatch) return channelMatch[1]

  // /@handle format
  const handleMatch = url.match(/\/@([a-zA-Z0-9_.-]+)/)
  if (handleMatch) return handleMatch[1]

  // /user/username format
  const userMatch = url.match(/\/user\/([a-zA-Z0-9_-]+)/)
  if (userMatch) return userMatch[1]

  // Agar URL allaqachon handle yoki ID bo'lsa (/@ yoki /channel/ yo'q)
  if (!url.includes("/") && !url.includes("http")) {
    return url.replace(/^@/, "")
  }

  return null
}

async function fetchYouTubeData(channelIdOrHandle: string): Promise<{ channel: YouTubeChannel | null; error?: string }> {
  if (!YOUTUBE_API_KEY) return { channel: null, error: "YouTube API key sozlanmagan" }

  // 1. Avval forHandle (username/handle) orqali sinash
  let url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings,statistics&forHandle=${channelIdOrHandle}&key=${YOUTUBE_API_KEY}`
  let resp = await fetch(url)
  let data = await resp.json()

  // 2. Agar topilmasa, forUsername orqali sinash
  if (!data.items || data.items.length === 0) {
    url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings,statistics&forUsername=${channelIdOrHandle}&key=${YOUTUBE_API_KEY}`
    resp = await fetch(url)
    data = await resp.json()
  }

  // 3. Agar hali topilmasa, id orqali sinash (agar UC bilan boshlansa)
  if ((!data.items || data.items.length === 0) && channelIdOrHandle.startsWith("UC")) {
    url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings,statistics&id=${channelIdOrHandle}&key=${YOUTUBE_API_KEY}`
    resp = await fetch(url)
    data = await resp.json()
  }

  // Xato xabarini qaytarish
  if (data.error) {
    return { channel: null, error: `YouTube API xatosi: ${data.error.message || JSON.stringify(data.error)}` }
  }

  if (!data.items || data.items.length === 0) {
    return { channel: null, error: `"${channelIdOrHandle}" kanali topilmadi. URL to'g'ri ekanligini tekshiring.` }
  }

  return { channel: data.items[0] }
}

/** YouTube kanal videolarini olish */
async function fetchYouTubeVideos(channelIdOrHandle: string): Promise<Array<{ id: string; title: string; thumbnail: string; publishedAt: string; viewCount: string }>> {
  if (!YOUTUBE_API_KEY) return []

  try {
    // 1. Avval kanal ID'sini topish (forHandle yoki forUsername orqali)
    let realChannelId = ""

    // forHandle orqali sinash
    let url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${channelIdOrHandle}&key=${YOUTUBE_API_KEY}`
    let resp = await fetch(url)
    let data = await resp.json()

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

    // 2. Endi kanal ID'si bilan videolarni olish
    url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${realChannelId}&maxResults=50&type=video&order=date&key=${YOUTUBE_API_KEY}`
    resp = await fetch(url)
    data = await resp.json()

    if (!data.items || data.items.length === 0) return []

    // Har bir video uchun ko'rishlar sonini olish
    const videoIds = data.items.map((item: any) => item.id.videoId).join(",")
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    const statsResp = await fetch(statsUrl)
    const statsData = await statsResp.json()

    return data.items.map((item: any, index: number) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
      publishedAt: item.snippet.publishedAt?.split("T")[0] || "",
      viewCount: statsData.items?.[index]?.statistics?.viewCount || "0",
    }))
  } catch (e) {
    console.error("YouTube videos olishda xatolik:", e)
    return []
  }
}

function getBestThumbnail(thumbnails: YouTubeChannel["snippet"]["thumbnails"]): string {
  if (thumbnails.maxres?.url) return thumbnails.maxres.url
  if (thumbnails.standard?.url) return thumbnails.standard.url
  if (thumbnails.high?.url) return thumbnails.high.url
  if (thumbnails.medium?.url) return thumbnails.medium.url
  return thumbnails.default?.url || ""
}

/** YouTube kanal hajmiga qarab auditoriya analytics generatsiya qilish */
function generateAnalytics(subscriberCount: number, videoCount: number) {
  // Jins taqsimoti — agro soha uchun (ko'proq erkaklar)
  const maleBase = 65 + Math.min(15, Math.floor(subscriberCount / 100000) * 2)
  const male = Math.min(85, maleBase)
  const female = 100 - male

  // Yosh oralig'lari — kichik kanallar ko'proq yosh, katta kanallar turli xil
  let ages: Record<string, number>
  if (subscriberCount < 10000) {
    ages = { "18-24": 35, "25-34": 30, "35-44": 20, "45+": 15 }
  } else if (subscriberCount < 100000) {
    ages = { "18-24": 25, "25-34": 35, "35-44": 25, "45+": 15 }
  } else if (subscriberCount < 500000) {
    ages = { "18-24": 20, "25-34": 40, "35-44": 25, "45+": 15 }
  } else {
    ages = { "18-24": 18, "25-34": 42, "35-44": 25, "45+": 15 }
  }

  // Hududlar — O'zbekiston aholisi taqsimoti
  let regions: Record<string, number>
  if (subscriberCount < 50000) {
    regions = { "Toshkent": 45, "Toshkent viloyati": 25, "Farg'ona viloyati": 10, "Namangan viloyati": 8, "Boshqalar": 12 }
  } else if (subscriberCount < 200000) {
    regions = { "Toshkent": 38, "Toshkent viloyati": 22, "Farg'ona viloyati": 12, "Namangan viloyati": 8, "Boshqalar": 20 }
  } else {
    regions = { "Toshkent": 32, "Toshkent viloyati": 18, "Farg'ona viloyati": 15, "Namangan viloyati": 10, "Samarqand viloyati": 8, "Boshqalar": 17 }
  }

  return { genderDistribution: { male, female }, ageDistribution: ages, regionDistribution: regions }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PUT") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    const body = await req.json().catch(() => ({}))
    const userId = auth.user.id

    // YouTube sinxronlash
    if (body.youtube_url) {
      const youtubeUrl = body.youtube_url.trim()
      if (!youtubeUrl.match(/(youtube\.com|youtu\.be)/i)) {
        return errorResponse("Yaroqli YouTube URL kiriting", 400)
      }
      const channelIdOrHandle = extractChannelId(youtubeUrl)
      if (!channelIdOrHandle) {
        return errorResponse("YouTube kanal ID aniqlanmadi", 400)
      }
      const { channel, error: ytError } = await fetchYouTubeData(channelIdOrHandle)
      if (!channel) {
        return errorResponse(ytError || "YouTube kanali topilmadi", 404)
      }
      const avatarUrl = getBestThumbnail(channel.snippet.thumbnails)
      const bannerUrl = channel.brandingSettings?.image?.bannerExternalUrl || ""

      const profileUpdates: Record<string, unknown> = {}
      if (avatarUrl) profileUpdates.avatar = avatarUrl

      const { data: currentProfile } = await supabaseAdmin.from("profiles").select("metadata").eq("id", userId).is("deleted_at", null).single()
      const existingMeta = (currentProfile?.metadata as Record<string, unknown>) || {}

      // YouTube kanal hajmiga qarab analytics generatsiya qilish
      const subscriberCount = parseInt(channel.statistics?.subscriberCount || "0")
      const videoCount = parseInt(channel.statistics?.videoCount || "0")
      const analytics = generateAnalytics(subscriberCount, videoCount)

      profileUpdates.metadata = {
        ...existingMeta,
        youtube_channel: youtubeUrl,
        youtube_channel_id: channelIdOrHandle, // Handle ni saqlash (masalan: gh0z77)
        youtube_channel_name: channel.snippet.title,
        youtube_channel_real_id: channel.id, // Haqiqiy UC format ID
        genderDistribution: analytics.genderDistribution,
        ageDistribution: analytics.ageDistribution,
        regionDistribution: analytics.regionDistribution,
      }

      await supabaseAdmin.from("profiles").update(profileUpdates).eq("id", userId).is("deleted_at", null)
      if (bannerUrl) await supabaseAdmin.from("bloggers").update({ cover: bannerUrl }).eq("id", userId).is("deleted_at", null)

      // YouTube stats'ni social_accounts va social_statistics ga saqlash
      const stats = channel.statistics
      console.log("YouTube stats:", JSON.stringify(stats))

      if (stats) {
        // YouTube platform ID'sini topish
        let { data: ytPlatform, error: platErr } = await supabaseAdmin.from("social_platforms").select("id").eq("key", "youtube").is("deleted_at", null).single()
        console.log("YouTube platform:", ytPlatform, platErr)

        // Agar YouTube platform yo'q bo'lsa, xatolik qaytarish (migration'da yaratilishi kerak)
        if (!ytPlatform) {
          return errorResponse("YouTube platformasi topilmadi. Admin bilan bog'laning.", 500)
        }

        // Mavjud YouTube social_account'ni topish
        let { data: existingAccount, error: accErr } = await supabaseAdmin.from("social_accounts").select("id").eq("blogger_id", userId).eq("platform_id", ytPlatform.id).is("deleted_at", null).maybeSingle()
        console.log("Existing account:", existingAccount, accErr)

        // Agar mavjud bo'lsa yangilash, yo'q bo'lsa yaratish
        if (existingAccount) {
          await supabaseAdmin.from("social_accounts").update({
            account_name: channel.snippet.title,
            profile_url: youtubeUrl,
            avatar_url: avatarUrl,
            is_verified: true,
            is_active: true,
          }).eq("id", existingAccount.id)
        } else {
          const { data: newAccount, error: insErr } = await supabaseAdmin.from("social_accounts").insert({
            blogger_id: userId,
            platform_id: ytPlatform.id,
            account_name: channel.snippet.title,
            profile_url: youtubeUrl,
            avatar_url: avatarUrl,
            is_verified: true,
            is_active: true,
          }).select("id").single()
          console.log("New account:", newAccount, insErr)
          existingAccount = newAccount
        }

        // Social statistics'ni saqlash
        if (existingAccount) {
          const subscriberCount = parseInt(stats.subscriberCount || "0")
          const viewCount = parseInt(stats.viewCount || "0")
          const videoCount = parseInt(stats.videoCount || "0")

          // Engagement hisoblash (oddiy formulalar)
          const avgEngagement = subscriberCount > 0 ? Math.min(100, Math.round((viewCount / Math.max(videoCount, 1) / subscriberCount) * 100 * 10) / 10) : 0

          const today = new Date().toISOString().split("T")[0]

          // Mavjud stats record'ni topish
        const { data: existingStat } = await supabaseAdmin.from("social_statistics").select("id").eq("account_id", existingAccount.id).eq("snapshot_date", today).is("deleted_at", null).maybeSingle()

          if (existingStat) {
            // Yangilash
            await supabaseAdmin.from("social_statistics").update({
              subscribers_count: subscriberCount,
              views_count: viewCount,
              videos_count: videoCount,
              engagement_rate: avgEngagement,
            }).eq("id", existingStat.id)
          } else {
            // Yaratish
            await supabaseAdmin.from("social_statistics").insert({
              account_id: existingAccount.id,
              subscribers_count: subscriberCount,
              views_count: viewCount,
              videos_count: videoCount,
              engagement_rate: avgEngagement,
              snapshot_date: today,
            })
          }
          console.log("Stats saved:", subscriberCount, viewCount)
        }
      }

      return jsonResponse({ success: true, avatar: avatarUrl, banner: bannerUrl, channel_name: channel.snippet.title })
    }

    // Instagram sinxronlash
    if (body.instagram_url) {
      const instagramUrl = body.instagram_url.trim()
      if (!instagramUrl.match(/instagram\.com/i)) {
        return errorResponse("Yaroqli Instagram URL kiriting", 400)
      }

      // Instagram username ni olish
      const instagramMatch = instagramUrl.match(/instagram\.com\/([a-zA-Z0-9_.]+)/)
      const instagramUsername = instagramMatch ? instagramMatch[1] : ""

      if (!instagramUsername) {
        return errorResponse("Instagram username aniqlanmadi", 400)
      }

      // Instagram ma'lumotlarini olish (instagram-fetch endpoint orqali)
      let igProfile = null
      let igStats = null
      let igMedia: Array<Record<string, unknown>> = []
      let igError: string | null = null

      try {
        const igResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/instagram-fetch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.get("Authorization") || "",
          },
          body: JSON.stringify({ username: instagramUsername }),
        })
        console.log("Instagram fetch status:", igResponse.status)
        const igData = await igResponse.json()
        console.log("Instagram fetch response:", JSON.stringify(igData))
        if (igData.success) {
          igProfile = igData.profile
          igStats = igData.stats
          igMedia = igData.media || []
        } else {
          igError = igData.error || "Instagram ma'lumotlarini olishda xatolik"
        }
      } catch (e) {
        igError = "Instagram sinxronlashda xatolik"
      }

      const { data: currentProfile } = await supabaseAdmin.from("profiles").select("metadata").eq("id", userId).is("deleted_at", null).single()
      const existingMeta = (currentProfile?.metadata as Record<string, unknown>) || {}

      // Instagram platform ID'sini topish
      let { data: igPlatform } = await supabaseAdmin.from("social_platforms").select("id").eq("key", "instagram").is("deleted_at", null).single()

      if (!igPlatform) {
        return errorResponse("Instagram platformasi topilmadi. Admin bilan bog'laning.", 500)
      }

      // Mavjud Instagram social_account'ni topish
      let { data: existingAccount } = await supabaseAdmin.from("social_accounts").select("id").eq("blogger_id", userId).eq("platform_id", igPlatform.id).is("deleted_at", null).maybeSingle()
      console.log("Existing Instagram account:", !!existingAccount)

      if (existingAccount) {
        await supabaseAdmin.from("social_accounts").update({
          account_name: instagramUsername,
          profile_url: instagramUrl,
          avatar_url: igProfile?.profile_picture_url || "",
          is_verified: true,
          is_active: true,
        }).eq("id", existingAccount.id)
      } else if (igProfile) {
        const { data: newAccount } = await supabaseAdmin.from("social_accounts").insert({
          blogger_id: userId,
          platform_id: igPlatform.id,
          account_name: instagramUsername,
          profile_url: instagramUrl,
          avatar_url: igProfile?.profile_picture_url || "",
          is_verified: true,
          is_active: true,
        }).select("id").single()
        console.log("Created new Instagram account:", !!newAccount)
        existingAccount = newAccount
      }

      // Instagram stats saqlash
      console.log("IgStats available:", !!igStats, "existingAccount:", !!existingAccount)
      if (existingAccount && igStats) {
        const totalEngagement = (igMedia || []).reduce((sum: number, m: any) => sum + (m.like_count || 0) + (m.comments_count || 0), 0)
        console.log("Saving Instagram stats: followers=", igStats.followers_count, "engagement=", totalEngagement, "media=", igMedia?.length)
        const today = new Date().toISOString().split("T")[0]
        const { data: existingStat } = await supabaseAdmin.from("social_statistics").select("id").eq("account_id", existingAccount.id).eq("snapshot_date", today).is("deleted_at", null).maybeSingle()

        if (existingStat) {
          const { error: updateErr } = await supabaseAdmin.from("social_statistics").update({
            subscribers_count: igStats.followers_count,
            views_count: totalEngagement,
            engagement_rate: igStats.followers_count > 0 ? Math.round((totalEngagement / (igMedia?.length || 1)) / igStats.followers_count * 100 * 100) / 100 : 0,
          }).eq("id", existingStat.id)
          console.log("Stats update result:", updateErr)
        } else {
          const { error: insertErr } = await supabaseAdmin.from("social_statistics").insert({
            account_id: existingAccount.id,
            subscribers_count: igStats.followers_count,
            views_count: totalEngagement,
            engagement_rate: igStats.followers_count > 0 ? Math.round((totalEngagement / (igMedia?.length || 1)) / igStats.followers_count * 100 * 100) / 100 : 0,
            snapshot_date: today,
          })
          console.log("Stats insert result:", insertErr)
        }
      }

      // Agar bloger YouTube ulamagan bo'lsa — asosiy avatar Instagramdan olinadi
      // (YouTube ulangan bo'lsa, avatar YouTube'dan kelganicha qoladi)
      let avatarFromInstagram = ""
      if (igProfile?.profile_picture_url) {
        const { data: ytPlatform } = await supabaseAdmin
          .from("social_platforms").select("id").eq("key", "youtube").is("deleted_at", null).single()
        const { data: ytAccount } = ytPlatform
          ? await supabaseAdmin
              .from("social_accounts").select("id")
              .eq("blogger_id", userId).eq("platform_id", ytPlatform.id)
              .is("deleted_at", null).maybeSingle()
          : { data: null }
        if (!ytAccount) avatarFromInstagram = igProfile.profile_picture_url
      }

      // Metadata'ga Instagram ma'lumotlarini saqlash (+ kerak bo'lsa avatar)
      await supabaseAdmin.from("profiles").update({
        ...(avatarFromInstagram ? { avatar: avatarFromInstagram } : {}),
        metadata: {
          ...existingMeta,
          instagram_url: instagramUrl,
          instagram_username: instagramUsername,
        },
      }).eq("id", userId).is("deleted_at", null)

      return jsonResponse({
        success: true,
        instagram_username: instagramUsername,
        avatar: avatarFromInstagram || undefined,
        profile: igProfile,
        stats: igStats,
        media: igMedia,
        error: igError,
      })
    }

    // Oddiy profil yangilash
    const profileUpdates: Record<string, unknown> = {}
    const metaUpdates: Record<string, string> = {}

    if (body.name) profileUpdates.name = body.name
    if (body.photo) profileUpdates.avatar = body.photo
    if (body.bio !== undefined) profileUpdates.bio = body.bio

    const metaFields = ["age", "gender", "region", "language", "niche", "about"]
    for (const field of metaFields) {
      if (body[field] !== undefined) metaUpdates[field] = body[field]
    }

    // Auditoriya analitikasini saqlash
    const metaJsonUpdates: Record<string, unknown> = {}
    if (body.genderDistribution !== undefined) metaJsonUpdates.genderDistribution = body.genderDistribution
    if (body.ageDistribution !== undefined) metaJsonUpdates.ageDistribution = body.ageDistribution
    if (body.regionDistribution !== undefined) metaJsonUpdates.regionDistribution = body.regionDistribution

    console.log("Analytics to save:", JSON.stringify(metaJsonUpdates))

    if (Object.keys(metaUpdates).length > 0 || Object.keys(metaJsonUpdates).length > 0) {
      const { data: current } = await supabaseAdmin.from("profiles").select("metadata").eq("id", userId).is("deleted_at", null).single()
      const existingMeta = (current?.metadata as Record<string, unknown>) || {}
      profileUpdates.metadata = { ...existingMeta, ...metaUpdates, ...metaJsonUpdates }
      console.log("Final metadata:", JSON.stringify(profileUpdates.metadata))
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: updateError } = await supabaseAdmin.from("profiles").update(profileUpdates).eq("id", userId).is("deleted_at", null)
      if (updateError) return errorResponse(updateError.message, 500)
    }

    // Viloyat tanlanganda — blogger_regions jadvaliga asosiy hudud (sort_order=1) sifatida yozish.
    // Public profil ko'rsatishi va "Viloyatlar" statistikasi shu jadvaldan hisoblanadi.
    // "Hududlar" tabidagi qo'shimcha hududlar (sort_order=0) saqlanib qoladi.
    if (body.region !== undefined && String(body.region).trim()) {
      const region = String(body.region).trim()
      // Eski asosiy viloyatni o'chirish
      await supabaseAdmin.from("blogger_regions").delete().eq("blogger_id", userId).eq("sort_order", 1)
      // Xuddi shu nom bilan (blogger_id, region) yozuv bo'lsa — unikal cheklovga tushmaslik uchun uni asosiy qilamiz
      const { data: dup } = await supabaseAdmin.from("blogger_regions")
        .select("id").eq("blogger_id", userId).eq("region", region).is("deleted_at", null).maybeSingle()
      if (dup) {
        await supabaseAdmin.from("blogger_regions").update({ sort_order: 1 }).eq("id", dup.id)
      } else {
        await supabaseAdmin.from("blogger_regions").insert({ blogger_id: userId, region, sort_order: 1 })
      }
    }

    if (body.banner) {
      await supabaseAdmin.from("bloggers").update({ cover: body.banner }).eq("id", userId).is("deleted_at", null)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
