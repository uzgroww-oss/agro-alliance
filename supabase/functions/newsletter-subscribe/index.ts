import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required, isEmail } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { rateLimited } from "../_shared/publicRateLimit.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  // Rate limit: bir IP daqiqada 5 ta, soatda 30 ta
  if (await rateLimited(req, "newsletter", 5, 60) || await rateLimited(req, "newsletter-h", 30, 3600)) {
    return errorResponse("Juda ko'p urinish. Birozdan keyin qayta urining.", 429)
  }

  const body = await req.json().catch(() => ({}))
  const errors = validate(body, {
    email: [required, (v) => isEmail(v as string) ? null : "Email format notog'ri"],
  })

  if (errors.length > 0) {
    return errorResponse(errors[0], 400)
  }

  const email = (body.email as string).trim().toLowerCase()
  if (email.length > 200) return errorResponse("Email juda uzun", 400)

  // XAVFSIZLIK: email enumeratsiya oldini olish uchun har doim bir xil javob qaytariladi
  const OK = jsonResponse({ success: true, message: "Obuna bo'ldingiz!" })

  const { data: existing } = await supabaseAdmin
    .from("newsletter_subscribers")
    .select("id, is_active")
    .eq("email", email)
    .maybeSingle()

  if (existing) {
    if (!existing.is_active) {
      await supabaseAdmin
        .from("newsletter_subscribers")
        .update({ is_active: true, unsubscribed_at: null })
        .eq("id", existing.id)
    }
    return OK
  }

  const { error: insertErr } = await supabaseAdmin
    .from("newsletter_subscribers")
    .insert({ email, is_active: true })

  if (insertErr) {
    console.error("newsletter-subscribe:", insertErr)
    return errorResponse("Obunada xatolik", 500)
  }

  return OK
})
