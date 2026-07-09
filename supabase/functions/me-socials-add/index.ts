import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { now } from "../_shared/time.ts"

function detectPlatform(url: string): { key: string; name: string } | null {
  const u = url.toLowerCase()
  if (u.includes("youtube.com") || u.includes("youtu.be")) return { key: "youtube", name: "YouTube" }
  if (u.includes("instagram.com")) return { key: "instagram", name: "Instagram" }
  if (u.includes("tiktok.com")) return { key: "tiktok", name: "TikTok" }
  if (u.includes("t.me") || u.includes("telegram.org")) return { key: "telegram", name: "Telegram" }
  if (u.includes("facebook.com") || u.includes("fb.com")) return { key: "facebook", name: "Facebook" }
  if (u.includes("x.com") || u.includes("twitter.com")) return { key: "x", name: "X" }
  if (u.includes("linkedin.com")) return { key: "linkedin", name: "LinkedIn" }
  return null
}

function extractName(url: string): string {
  try {
    const u = new URL(url)
    const segments = u.pathname.replace(/\/$/, "").split("/")
    const last = segments[segments.length - 1] || ""
    return last.replace(/^@/, "")
  } catch {
    return url
  }
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
    const errors = validate(body, { link: [required] })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const platform = detectPlatform(body.link)
    if (!platform) {
      return errorResponse("Platformani aniqlab bo'lmadi", 400)
    }

    const { data: platformRow } = await supabaseAdmin
      .from("social_platforms")
      .select("id")
      .eq("key", platform.key)
      .single()

    if (!platformRow) {
      return errorResponse("Platforma topilmadi", 404)
    }

    const { data: existing } = await supabaseAdmin
      .from("social_accounts")
      .select("id")
      .eq("blogger_id", auth.user.id)
      .eq("platform_id", platformRow.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (existing) {
      return errorResponse("Bu platforma allaqachon qo'shilgan", 409)
    }

    const accountName = extractName(body.link) || platform.name

    const { error: insertError } = await supabaseAdmin
      .from("social_accounts")
      .insert({
        blogger_id: auth.user.id,
        platform_id: platformRow.id,
        account_name: accountName,
        profile_url: body.link,
        is_active: true,
        connected_at: now(),
      })

    if (insertError) {
      return errorResponse(insertError.message, 500)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
