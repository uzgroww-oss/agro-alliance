import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required, isEmail, minLength } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { rateLimited } from "../_shared/publicRateLimit.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  // Rate limit: bir IP daqiqada 5 ta, soatda 20 ta
  if (await rateLimited(req, "contact", 5, 60) || await rateLimited(req, "contact-h", 20, 3600)) {
    return errorResponse("Juda ko'p urinish. Birozdan keyin qayta urining.", 429)
  }

  const body = await req.json().catch(() => ({}))
  const errors = validate(body, {
    name: [required, (v) => minLength(v as string, 2) ? null : "Ism kamida 2 belgi"],
    email: [required, (v) => isEmail(v as string) ? null : "Email format notog'ri"],
    subject: [required],
    message: [required, (v) => minLength(v as string, 10) ? null : "Xabar kamida 10 belgi"],
  })

  if (errors.length > 0) {
    return errorResponse(errors[0], 400)
  }

  const { name, email, subject, message } = body as {
    name: string; email: string; subject: string; message: string
  }

  // XAVFSIZLIK: maksimal uzunlik chegaralari (katta payload / DB flooding oldini olish)
  if (name.length > 120 || email.length > 200 || subject.length > 200 || message.length > 5000) {
    return errorResponse("Matn juda uzun", 400)
  }

  const { error: insertErr } = await supabaseAdmin
    .from("contact_messages")
    .insert({
      name: name.trim().slice(0, 120),
      email: email.trim().slice(0, 200),
      subject: subject.slice(0, 200),
      message: message.trim().slice(0, 5000),
    })

  if (insertErr) {
    console.error("contact-submit:", insertErr)
    return errorResponse("Xabar yuborishda xatolik", 500)
  }

  return jsonResponse({ success: true, message: "Xabaringiz yuborildi!" })
})
