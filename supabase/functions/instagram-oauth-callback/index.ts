import { handleCors } from "../_shared/cors.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { verifyState } from "../_shared/oauthState.ts"

/**
 * instagram-oauth-callback — Facebook'dan OAuth token olish va Instagram access token olish
 */

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID") || ""
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET") || ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""

/**
 * Natijani ILOVAGA qaytaramiz, HTML sahifa ko'rsatmaymiz.
 *
 * NEGA: Supabase *.supabase.co domenida qaytarilgan HTML'ni majburan
 * text/plain ga aylantiradi (fishingga qarshi himoya). Shu sababli
 * <script> ishlamas, oyna yopilmas va foydalanuvchi kod matnini
 * ko'rardi. Endi brauzer ilovaning o'ziga qaytariladi.
 */
function backToApp(origin: string, params: Record<string, string>): Response {
  const qs = new URLSearchParams(params).toString()
  // Origin noma'lum bo'lsa (eski state) — hech bo'lmasa oddiy matn.
  if (!origin) {
    return new Response(params.error ? `Xatolik: ${params.error}` : "Instagram ulandi. Oynani yopishingiz mumkin.", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/admin?${qs}` },
  })
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const error = url.searchParams.get("error")

    // Xato tekshirish
    if (error) {
      // Bu bosqichda state hali tekshirilmagan, shuning uchun qaytish
      // manzili ham yo'q — oddiy matn qaytaramiz.
      const st0 = state ? await verifyState(FACEBOOK_APP_SECRET, state) : null
      return backToApp(st0?.origin || "", { instagram: "error", xato: error })
    }

    if (!code || !state) {
      return new Response("Code va state parametrlari kerak", { status: 400 })
    }

    // State ni HMAC bilan tekshirish — soxta/o'zgartirilgan state rad etiladi
    const st = await verifyState(FACEBOOK_APP_SECRET, state)
    if (!st) {
      return new Response("Noto'g'ri yoki muddati o'tgan state parametri", { status: 400 })
    }
    const { userId, origin } = st

    // Facebook'dan short-lived token olish
    const redirectUri = `${SUPABASE_URL}/functions/v1/instagram-oauth-callback`
    const tokenResponse = await fetch("https://graph.facebook.com/v22.0/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
    })

    const tokenData = await tokenResponse.json()
    if (!tokenData.access_token) {
      return new Response("Facebook token olishda xatolik", { status: 500 })
    }

    // Short-lived token'ni long-lived token'ga aylantirish (60 kun amal qiladi)
    const longTokenResponse = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    )
    const longTokenData = await longTokenResponse.json()
    const longLivedToken = longTokenData.access_token || tokenData.access_token

    // Facebook pages (Instagram business accounts) ni olish
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${longLivedToken}`
    )
    const pagesData = await pagesResponse.json()

    let instagramAccountId = ""
    let instagramUsername = ""
    let debugInfo: string[] = []

    debugInfo.push(`/me/accounts status: ${pagesResponse.status}`)
    if (pagesData.error) {
      debugInfo.push(`/me/accounts error: ${pagesData.error.message || JSON.stringify(pagesData.error)}`)
    } else {
      const pageCount = pagesData.data?.length || 0
      debugInfo.push(`Pages found: ${pageCount}`)
      if (pageCount > 0) {
        // 1-usul: to'g'ridan-to'g'ri instagram_business_account ni tekshirish
        for (const page of pagesData.data) {
          const pageId = page.id
          const pageName = page.name
          const hasIg = !!page.instagram_business_account
          const igId = page.instagram_business_account?.id || "-"
          debugInfo.push(`  Page: ${pageName} (${pageId}), has_ig_business: ${hasIg}, ig_id: ${igId}`)

          if (page.instagram_business_account?.id) {
            instagramAccountId = page.instagram_business_account.id
            // MUHIM: nom ham shu yerda olinadi. Ilgari faqat id olinib
            // break qilinardi va akkaunt nomi bo'sh qolardi.
            instagramUsername = page.instagram_business_account.username || ""
            break
          }
        }

        // 2-usul: har bir page'ni alohida tekshirish
        if (!instagramAccountId) {
          for (const page of pagesData.data) {
            const pageToken = page.access_token || longLivedToken
            const igResponse = await fetch(
              `https://graph.facebook.com/v22.0/${page.id}?fields=instagram_business_account&access_token=${pageToken}`
            )
            const igData = await igResponse.json()
            if (igData.instagram_business_account?.id) {
              instagramAccountId = igData.instagram_business_account.id
              instagramUsername = igData.instagram_business_account.username || ""
              debugInfo.push(`  -> Found IG via Page token: ${instagramAccountId}`)
              break
            }
            if (igData.error) {
              debugInfo.push(`  -> Page ${page.id} query error: ${igData.error.message || JSON.stringify(igData.error)}`)
            } else {
              debugInfo.push(`  -> Page ${page.id} has NO instagram_business_account field`)
            }
          }
        }
      } else {
        debugInfo.push("No Facebook Pages found. You need at least one Facebook Page.")
      }
    }

    // 3-usul: debug info uchun /me dan instagram_business_account ni tekshirish
    if (!instagramAccountId) {
      const meResponse = await fetch(
        `https://graph.facebook.com/v22.0/me?fields=instagram_business_account&access_token=${longLivedToken}`
      )
      const meData = await meResponse.json()
      if (meData.instagram_business_account?.id) {
        instagramAccountId = meData.instagram_business_account.id
        instagramUsername = meData.instagram_business_account.username || ""
        debugInfo.push("Found IG via /me endpoint")
      }
      if (meData.error) {
        debugInfo.push(`/me error (expected): ${meData.error.message || JSON.stringify(meData.error)}`)
      }
    }

    // Nom hali ham bo'sh bo'lsa, akkauntning o'zidan so'raymiz.
    // Nomsiz panelda "qaysi akkauntga chiqadi" degan savol javobsiz qoladi.
    if (instagramAccountId && !instagramUsername) {
      const uResp = await fetch(
        `https://graph.facebook.com/v22.0/${instagramAccountId}?fields=username&access_token=${longLivedToken}`
      )
      const uData = await uResp.json().catch(() => ({}))
      if (uData.username) instagramUsername = uData.username
      else if (uData.error) debugInfo.push(`username query error: ${uData.error.message || ""}`)
    }

    // Tokenlarni bazaga saqlash
    const { error: upsertError } = await supabaseAdmin.from("instagram_tokens").upsert({
      user_id: userId,
      access_token: longLivedToken,
      instagram_account_id: instagramAccountId,
      instagram_username: instagramUsername,
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "user_id" })

    if (upsertError) {
      debugInfo.push(`Token save error: ${upsertError.message}`)
    }

    const isConnected = !!instagramAccountId

    if (isConnected) {
      return backToApp(origin, {
        instagram: "ok",
        username: instagramUsername,
      })
    }

    // Ulanmadi — sababni ILOVAGA uzatamiz. Ilgari bu yerda uzun HTML
    // tashxis sahifasi bo'lardi, lekin u matn sifatida chiqib, foyda
    // bermasdi. Endi eng muhim satr qaytariladi.
    const why = debugInfo.some((d) => d.includes("Pages found: 0"))
      ? "Facebook sahifangiz yo'q — avval Page yarating"
      : debugInfo.some((d) => d.includes("has_ig_business: false"))
      ? "Instagram Business akkaunt Facebook sahifaga ulanmagan"
      : "Instagram Business akkaunt topilmadi"

    console.log("instagram-oauth-callback tashxis:", debugInfo.join(" | "))
    return backToApp(origin, { instagram: "error", xato: why })

  } catch (err) {
    return new Response(`Xatolik: ${err instanceof Error ? err.message : "Unknown error"}`, { status: 500 })
  }
})
