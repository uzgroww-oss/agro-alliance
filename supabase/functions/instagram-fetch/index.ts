import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { verifyAuth } from "../_shared/auth.ts"

/**
 * instagram-fetch — Instagram akkaunt ma'lumotlarini olish
 * Blogger Instagram link qo'shaganda avtomatik chaqiriladi
 */

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID") || ""
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET") || ""

/** Token yangilash */
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${refreshToken}`
    )
    const data = await resp.json()
    return data.access_token || null
  } catch {
    return null
  }
}

/** Instagram Graph API'dan business discovery orqali ma'lumot olish */
async function fetchInstagramData(accessToken: string, instagramAccountId: string, targetUsername: string): Promise<{
  profile: { username: string; name: string; biography: string; profile_picture_url: string } | null
  stats: { followers_count: number; follows_count: number; media_count: number } | null
  media: Array<{ id: string; media_type: string; media_url: string; permalink: string; caption: string; timestamp: string; like_count: number; comments_count: number }>
  error?: string
}> {
  try {
    // Business discovery endpoint — boshqa akkaunt ma'lumotlarini olish
    const fields = "username,name,biography,profile_picture_url,followers_count,follows_count,media_count"
    const mediaFields = "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count"
    const PAGE_SIZE = 50
    const MAX_PAGES = 12 // xavfsizlik chegarasi: 12 * 50 = 600 postgacha

    let bd: any = null
    const allMedia: any[] = []
    let after = ""

    // Barcha postlarni sahifalab olish (paginatsiya)
    for (let page = 0; page < MAX_PAGES; page++) {
      const mediaEdge = after
        ? `media.limit(${PAGE_SIZE}).after(${after}){${mediaFields}}`
        : `media.limit(${PAGE_SIZE}){${mediaFields}}`
      const url = `https://graph.facebook.com/v22.0/${instagramAccountId}?fields=business_discovery.username(${targetUsername}){${fields},${mediaEdge}}&access_token=${accessToken}`

      const resp = await fetch(url)
      const data = await resp.json()

      if (data.error) {
        // Birinchi sahifada xato bo'lsa — umuman qaytaramiz; keyingi sahifalarda — bor postlar bilan to'xtaymiz
        if (page === 0) {
          return { profile: null, stats: null, media: [], error: data.error.message || "Instagram API xatosi" }
        }
        break
      }

      const pageBd = data.business_discovery
      if (!pageBd) {
        if (page === 0) return { profile: null, stats: null, media: [], error: "Instagram akkaunt topilmadi" }
        break
      }
      if (!bd) bd = pageBd // profil/statistikani birinchi sahifadan olamiz

      const items = pageBd.media?.data || []
      allMedia.push(...items)

      const next = pageBd.media?.paging?.cursors?.after
      if (!next || items.length === 0) break
      after = next
    }

    return {
      profile: {
        username: bd.username || "",
        name: bd.name || "",
        biography: bd.biography || "",
        profile_picture_url: bd.profile_picture_url || "",
      },
      stats: {
        followers_count: bd.followers_count || 0,
        follows_count: bd.follows_count || 0,
        media_count: bd.media_count || 0,
      },
      media: allMedia.map((m: any) => ({
        id: m.id,
        media_type: m.media_type || "",
        media_url: (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) || m.media_url || "",
        permalink: m.permalink || "",
        caption: m.caption || "",
        timestamp: m.timestamp || "",
        like_count: m.like_count || 0,
        comments_count: m.comments_count || 0,
      })),
    }
  } catch (err) {
    return { profile: null, stats: null, media: [], error: err instanceof Error ? err.message : "Xatolik" }
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  // Xavfsizlik: faqat login qilган foydalanuvchilar (bloger/admin) chaqira oladi
  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const username = body.username?.trim()
    const bloggerId = body.blogger_id

    if (!username) {
      return errorResponse("Instagram username kerak", 400)
    }

    // Eng so'nggi Instagram token'ni topish (admin tomonidan ulangan)
    const { data: tokenData } = await supabaseAdmin
      .from("instagram_tokens")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log("Instagram token found:", !!tokenData)

    if (!tokenData) {
      return errorResponse("Instagram akkaunt ulanmagan. Admin panel'da Facebook bilan kiring.", 404)
    }

    if (!tokenData.instagram_account_id) {
      return errorResponse("Instagram Business akkaunt topilmadi. Facebook Page'ga Instagram ulang va qaytadan OAuth'dan o'ting.", 400)
    }

    let accessToken = tokenData.access_token

    // Token muddati tugaganini tekshirish
    if (new Date(tokenData.expires_at) < new Date()) {
      const newToken = await refreshAccessToken(tokenData.access_token)
      if (!newToken) {
        return errorResponse("Instagram token muddati tugagan. Qaytadan ulang.", 401)
      }
      accessToken = newToken
      await supabaseAdmin.from("instagram_tokens").update({
        access_token: newToken,
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq("id", tokenData.id)
    }

    // Instagram ma'lumotlarini olish
    const { profile, stats, media, error: igError } = await fetchInstagramData(
      accessToken,
      tokenData.instagram_account_id,
      username
    )

    if (igError) {
      return errorResponse(igError, 400)
    }

    return jsonResponse({
      success: true,
      profile,
      stats,
      media: media || [],
    })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
