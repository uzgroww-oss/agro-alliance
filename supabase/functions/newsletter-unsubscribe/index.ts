import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    let email = ""

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      email = (body.email as string || "").trim().toLowerCase()
    } else {
      const url = new URL(req.url)
      email = (url.searchParams.get("email") || url.searchParams.get("token") || "").trim().toLowerCase()
    }

    if (!email || !email.includes("@")) {
      return errorResponse("Email kiritilmagan", 400)
    }

    const { data: subscriber } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id, is_active")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle()

    if (!subscriber) {
      return jsonResponse({ success: true, message: "Obuna topilmadi" })
    }

    if (!subscriber.is_active) {
      return jsonResponse({ success: true, message: "Siz allaqachon obunani bekor qilgansiz" })
    }

    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
      .eq("id", subscriber.id)

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ success: true, message: "Obuna bekor qilindi" })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
