/**
 * cron-instagram-token-refresh — Instagram (Facebook) uzoq muddatli tokenini
 * MUDDATI TUGAMASIDAN OLDIN yangilab turadi. Har yangilash tokenni yana 60 kunga uzaytiradi.
 * Haftalik pg_cron orqali chaqiriladi — shu sabab token hech qachon tugamaydi.
 */
import { supabaseAdmin } from "../_shared/supabase.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"

const FB_APP_ID = Deno.env.get("FACEBOOK_APP_ID") || ""
const FB_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET") || ""

Deno.serve(async (req) => {
  // XAVFSIZLIK: faqat maxfiy kalit bilan chaqirilishi mumkin (pg_cron header yuboradi)
  const CRON_SECRET = Deno.env.get("CRON_SECRET") || ""
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return errorResponse("Forbidden", 403)
  }
  if (!FB_APP_ID || !FB_APP_SECRET) return errorResponse("FACEBOOK_APP_ID/SECRET sozlanmagan", 500)

  // Barcha saqlangan Instagram tokenlar
  const { data: tokens } = await supabaseAdmin
    .from("instagram_tokens")
    .select("id, instagram_username, access_token, expires_at")

  if (!tokens || tokens.length === 0) return jsonResponse({ ok: true, refreshed: 0, note: "Token yo'q" })

  const results: Array<Record<string, unknown>> = []
  for (const t of tokens) {
    try {
      const r = await fetch(
        `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${t.access_token}`,
      )
      const d = await r.json()
      if (d.access_token) {
        const expiresIn = Number(d.expires_in || 60 * 24 * 60 * 60) // sekund (odatda ~60 kun)
        await supabaseAdmin.from("instagram_tokens").update({
          access_token: d.access_token,
          expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        }).eq("id", t.id)
        results.push({ user: t.instagram_username, ok: true, new_expires_days: Math.round(expiresIn / 86400) })
      } else {
        results.push({ user: t.instagram_username, ok: false, error: d.error?.message || "yangilanmadi" })
      }
    } catch (e) {
      results.push({ user: t.instagram_username, ok: false, error: e instanceof Error ? e.message : "xato" })
    }
  }

  return jsonResponse({ ok: true, refreshed: results.filter((x) => x.ok).length, total: tokens.length, results })
})
