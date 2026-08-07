import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { signState, verifyState } from "../_shared/oauthState.ts"
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  ulanishSaqla,
} from "../_shared/youtubeAuth.ts"

/**
 * YOUTUBE KANALINI EGASI NOMIDAN ULASH.
 *
 *   POST ?action=start  — rozilik oynasi manzilini qaytaradi
 *   GET  (callback)     — Google shu manzilga qaytaradi, tokenlar saqlanadi
 *
 * Kanal statistikasini o'qish uchun OAuth kerak emas edi, lekin video
 * yuklash / o'zgartirish / o'chirish va muqova qo'yish kanal egasi
 * nomidan bajariladi — bularsiz Google rad etadi.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const REDIRECT = `${SUPABASE_URL}/functions/v1/youtube-oauth`

/**
 * `youtube.upload` — video yuklash
 * `youtube`        — o'zgartirish, o'chirish, muqova, pleylistlar
 * `youtube.readonly` — o'z kanalining ro'yxatini o'qish
 * `youtube.force-ssl` — IZOHLAR: o'qish va javob yozish
 *
 * `force-ssl` ilgari ataylab yo'q edi — u Google tekshiruvida
 * qo'shimcha talab qo'yadi. Izohlarga avtomatik javob berish
 * qo'shilgach u SHART bo'lib qoldi: `comments.insert` boshqa hech
 * qanday ruxsat bilan ishlamaydi.
 *
 * ⚠️ RUXSAT KENGAYDI — ESKI ULANISH YETMAYDI. Google tokenga
 * ruxsatlarni ULANGAN PAYTDA biriktiradi, keyin kengaytirmaydi.
 * Ya'ni kanal shu o'zgarishdan oldin ulangan bo'lsa, izohlar 403
 * qaytaradi va uni faqat QAYTA ulash tuzatadi. Panel bu xatoni
 * aynan shunday tushuntiradi (qarang: ytIzoh.ts).
 */
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
].join(" ")

/**
 * Natijani ILOVAGA qaytaramiz, HTML ko'rsatmaymiz.
 *
 * Supabase *.supabase.co domenida qaytarilgan HTML'ni majburan
 * text/plain ga aylantiradi (fishingga qarshi himoya) — script
 * ishlamas, oyna yopilmas edi.
 */
function ilovagaQaytar(origin: string, params: Record<string, string>): Response {
  if (!origin) {
    return new Response(
      params.xato ? `Xatolik: ${params.xato}` : "YouTube ulandi. Oynani yopishingiz mumkin.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    )
  }
  /**
   * `/admin` EMAS, `/oauth-yakun`.
   *
   * Rozilik kichik qalqib chiqqan oynada ochiladi. `/admin` ga
   * qaytarilganda o'sha 400px lik oynada BUTUN admin paneli yuklanib,
   * ichida "Topshiriqlar" bo'limi chiqib turardi — ulanish tugaganini
   * tushunib bo'lmasdi. Yangi sahifa natijani bir qatorda aytadi va
   * oynani o'zi yopadi.
   */
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/oauth-yakun?${new URLSearchParams(params).toString()}` },
  })
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const url = new URL(req.url)

  /* ---------------- Rozilik oynasini boshlash ---------------- */
  if (req.method === "POST" && url.searchParams.get("action") === "start") {
    const auth = await requireRole(req, "super_admin", "admin", "editor")
    if (auth.response) return auth.response

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return errorResponse(
        "Google OAuth sozlanmagan: GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET kerak",
        400,
      )
    }

    const origin = req.headers.get("origin") || ""
    const state = await signState(GOOGLE_CLIENT_SECRET, auth.user.id, origin)

    /**
     * `access_type=offline` va `prompt=consent` — MAJBURIY.
     *
     * Ularsiz Google `refresh_token` bermaydi (ikkinchi va keyingi
     * roziliklarda umuman qaytarmaydi). Natijada bir soatdan keyin
     * hamma amal "401" bilan yiqilardi va sababi ko'rinmasdi.
     */
    const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    }).toString()

    return jsonResponse({ authUrl })
  }

  /* ---------------- Google qaytishi ---------------- */
  if (req.method === "GET") {
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const xato = url.searchParams.get("error")

    if (xato) {
      const st0 = state ? await verifyState(GOOGLE_CLIENT_SECRET, state) : null
      return ilovagaQaytar(st0?.origin || "", { youtube: "error", xato })
    }
    if (!code || !state) return new Response("Code va state kerak", { status: 400 })

    // State HMAC bilan imzolangan — soxta/o'zgartirilgani rad etiladi
    const st = await verifyState(GOOGLE_CLIENT_SECRET, state)
    if (!st) return new Response("State yaroqsiz yoki muddati o'tgan", { status: 400 })

    try {
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT,
          grant_type: "authorization_code",
        }),
        signal: AbortSignal.timeout(15_000),
      })
      const d = await r.json()
      if (!r.ok || !d.access_token) {
        return ilovagaQaytar(st.origin, {
          youtube: "error",
          xato: String(d.error_description || d.error || "Token olinmadi"),
        })
      }

      // Qaysi kanal ulandi — nomi panelda ko'rsatiladi
      let channelId = ""
      let channelTitle = ""
      try {
        const c = await fetch(
          "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
          { headers: { Authorization: `Bearer ${d.access_token}` }, signal: AbortSignal.timeout(10_000) },
        )
        const cd = await c.json()
        channelId = cd.items?.[0]?.id || ""
        channelTitle = cd.items?.[0]?.snippet?.title || ""
      } catch { /* kanal nomi ikkinchi darajali */ }

      await ulanishSaqla({
        access_token: d.access_token,
        // Ikkinchi rozilikda refresh_token kelmasligi mumkin —
        // o'shanda eskisi saqlanib qoladi (ulanishSaqla birlashtiradi)
        ...(d.refresh_token ? { refresh_token: d.refresh_token } : {}),
        expires_at: Date.now() + Number(d.expires_in || 3600) * 1000,
        ...(channelId ? { channel_id: channelId } : {}),
      }, st.userId)

      if (channelTitle) {
        const { supabaseAdmin } = await import("../_shared/supabase.ts")
        await supabaseAdmin.from("smm_connections")
          .update({ display_name: channelTitle })
          .eq("platform", "youtube")
      }

      return ilovagaQaytar(st.origin, { youtube: "ok", kanal: channelTitle })
    } catch (e) {
      return ilovagaQaytar(st.origin, {
        youtube: "error",
        xato: e instanceof Error ? e.message : "Xatolik",
      })
    }
  }

  return errorResponse("Method not allowed", 405)
})
