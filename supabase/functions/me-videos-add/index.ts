import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

function detectPlatform(url: string): string {
  const u = url.toLowerCase()
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube"
  if (u.includes("instagram.com")) return "Instagram"
  if (u.includes("tiktok.com")) return "TikTok"
  if (u.includes("t.me") || u.includes("telegram.org")) return "Telegram"
  if (u.includes("facebook.com") || u.includes("fb.com")) return "Facebook"
  if (u.includes("x.com") || u.includes("twitter.com")) return "X"
  if (u.includes("linkedin.com")) return "LinkedIn"
  return "Other"
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

    const userId = auth.user.id
    const platform = detectPlatform(body.link)

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", userId)
      .is("deleted_at", null)
      .single()

    if (!profile) {
      return errorResponse("Profil topilmadi", 404)
    }

    const meta = (profile.metadata as Record<string, unknown>) || {}
    const videos = (meta.videos as unknown[]) || []

    const videoEntry = {
      id: crypto.randomUUID(),
      name: "New Video",
      link: body.link,
      views: "0",
      plats: [platform],
      date: new Date().toISOString().split("T")[0],
      status: "published",
      thumbnail: null,
      author: auth.user.name,
    }

    videos.push(videoEntry)

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        metadata: { ...meta, videos },
      })
      .eq("id", userId)
      .is("deleted_at", null)

    if (updateError) {
      return errorResponse(updateError.message, 500)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
