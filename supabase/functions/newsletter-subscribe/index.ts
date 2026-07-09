import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required, isEmail } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  const body = await req.json().catch(() => ({}))
  const errors = validate(body, {
    email: [required, (v) => isEmail(v as string) ? null : "Email format notog'ri"],
  })

  if (errors.length > 0) {
    return errorResponse(errors[0], 400)
  }

  const email = (body.email as string).trim().toLowerCase()

  const { data: existing } = await supabaseAdmin
    .from("newsletter_subscribers")
    .select("id, is_active")
    .eq("email", email)
    .maybeSingle()

  if (existing) {
    if (existing.is_active) {
      return jsonResponse({ success: true, message: "Siz allaqachon obuna bo'lgansiz!" })
    }
    await supabaseAdmin
      .from("newsletter_subscribers")
      .update({ is_active: true, unsubscribed_at: null })
      .eq("id", existing.id)
    return jsonResponse({ success: true, message: "Obuna qayta faollashtirildi!" })
  }

  const { error: insertErr } = await supabaseAdmin
    .from("newsletter_subscribers")
    .insert({ email, is_active: true })

  if (insertErr) {
    return errorResponse("Obunada xatolik: " + insertErr.message, 500)
  }

  return jsonResponse({ success: true, message: "Obuna bo'ldingiz!" })
})
