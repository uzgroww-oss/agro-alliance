import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { signState } from "../_shared/oauthState.ts"

/**
 * instagram-oauth-start — Facebook/Instagram OAuth flow ni boshlash
 * Admin bir marta login qiladi, keyin barcha bloggerlar uchun ishlatiladi
 */

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID") || ""
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET") || ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    if (!FACEBOOK_APP_ID) {
      return errorResponse("Facebook App ID sozlanmagan. Admin panel'da sozlang.", 500)
    }

    // OAuth state — HMAC bilan imzolangan (soxta userId yasab bo'lmaydi)
    const state = await signState(FACEBOOK_APP_SECRET, auth.user.id)

    // OAuth URL yaratish
    const redirectUri = `${SUPABASE_URL}/functions/v1/instagram-oauth-callback`
    const scopes = "instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement"

    const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?` +
      `client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scopes}` +
      `&state=${state}`

    return jsonResponse({ authUrl })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
