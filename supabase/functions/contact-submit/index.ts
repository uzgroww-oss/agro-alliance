import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required, isEmail, minLength } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
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

  const { error: insertErr } = await supabaseAdmin
    .from("contact_messages")
    .insert({
      name: name.trim(),
      email: email.trim(),
      subject,
      message: message.trim(),
    })

  if (insertErr) {
    return errorResponse("Xabar yuborishda xatolik: " + insertErr.message, 500)
  }

  return jsonResponse({ success: true, message: "Xabaringiz yuborildi!" })
})
