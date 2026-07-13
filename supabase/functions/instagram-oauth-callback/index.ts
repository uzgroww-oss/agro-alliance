import { handleCors } from "../_shared/cors.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * instagram-oauth-callback — Facebook'dan OAuth token olish va Instagram access token olish
 */

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID") || ""
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET") || ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""

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
      return new Response(`<!DOCTYPE html><html><head><title>Xato</title></head><body><h1>Instagram autentifikatsiya xatosi</h1><p>${error}</p><script>setTimeout(()=>window.close(),3000)</script></body></html>`, {
        headers: { "Content-Type": "text/html" },
      })
    }

    if (!code || !state) {
      return new Response("Code va state parametrlari kerak", { status: 400 })
    }

    // State ni tekshirish
    let userId: string
    try {
      const decoded = JSON.parse(atob(state))
      userId = decoded.userId
    } catch {
      return new Response("Noto'g'ri state parametri", { status: 400 })
    }

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
      `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${longLivedToken}`
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
    const debugHtml = debugInfo.map(d => `<p style="font-size:11px;color:#666;margin:2px 0;font-family:monospace;text-align:left;padding:0 20px">${d.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join("")

    return new Response(`<!DOCTYPE html>
<html>
<head><title>${isConnected ? "Muvaffaqiyatli" : "Xato"}</title></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
  <div style="text-align:center;max-width:600px">
    ${isConnected ? `
    <h1 style="color:#E1306C">Instagram muvaffaqiyatli ulandi!</h1>
    <p>Akkaunt: <strong>${instagramUsername}</strong></p>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'instagram-connected', username: '${instagramUsername}' }, '*');
      }
      setTimeout(() => window.close(), 2000);
    </script>` : `
    <h1 style="color:#e74c3c">Instagram ulanishda xatolik</h1>
    <p>Facebook Page'ingizga Instagram Business akkaunt bog'lanmagan.</p>
    <p style="margin-top:12px">Quyidagi ma'lumotlar muammoni topishga yordam beradi:</p>
    ${debugHtml}
    <p style="margin-top:16px;font-size:13px;color:#333">Agar "Pages found: 0" bo'lsa → sizda Facebook Page yo'q. Avval Page yarating.</p>
    <p style="font-size:13px;color:#333">Agar Page bor, lekin "has_ig_business: false" bo'lsa → Instagram Business akkauntingizni Facebook Page'ga ulang.</p>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'instagram-error', error: 'Instagram Business akkaunt topilmadi' }, '*');
      }
      setTimeout(() => window.close(), 5000);
    </script>`}
  </div>
</body>
</html>`, {
      headers: { "Content-Type": "text/html" },
    })
  } catch (err) {
    return new Response(`Xatolik: ${err instanceof Error ? err.message : "Unknown error"}`, { status: 500 })
  }
})
