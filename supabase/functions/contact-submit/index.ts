import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required, isEmail, minLength } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { rateLimited } from "../_shared/publicRateLimit.ts"
import { sendEmail, escapeHtml } from "../_shared/email.ts"

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

  const clean = {
    name: name.trim().slice(0, 120),
    email: email.trim().slice(0, 200),
    subject: subject.slice(0, 200),
    message: message.trim().slice(0, 5000),
  }

  // 1) Avval bazaga yozamiz — admin panelda ko'rinishi kafolatlanadi.
  const { error: insertErr } = await supabaseAdmin.from("contact_messages").insert(clean)

  if (insertErr) {
    console.error("contact-submit:", insertErr)
    return errorResponse("Xabar yuborishda xatolik", 500)
  }

  // 2) Keyin email jo'natamiz. MUHIM: email xato bersa ham foydalanuvchiga
  //    xatolik qaytarmaymiz — xabar allaqachon bazada, yo'qolmaydi.
  const emailSent = await sendEmail({
    subject: `Yangi murojaat: ${clean.subject}`,
    replyTo: clean.email, // "Javob berish" to'g'ridan-to'g'ri mijozga ketadi
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px">
        <h2 style="color:#5bb420;margin:0 0 16px">Yangi murojaat — Agro Alliance</h2>
        <table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="background:#f7faf4;font-weight:600;width:120px">Ism</td><td>${escapeHtml(clean.name)}</td></tr>
          <tr><td style="background:#f7faf4;font-weight:600">Email</td><td><a href="mailto:${escapeHtml(clean.email)}">${escapeHtml(clean.email)}</a></td></tr>
          <tr><td style="background:#f7faf4;font-weight:600">Mavzu</td><td>${escapeHtml(clean.subject)}</td></tr>
        </table>
        <h3 style="margin:20px 0 8px;font-size:14px">Xabar</h3>
        <div style="white-space:pre-wrap;background:#f7faf4;padding:14px;border-radius:8px;font-size:14px">${escapeHtml(clean.message)}</div>
        <p style="margin-top:20px;color:#888;font-size:12px">Bu xat agroalliance.uz saytidagi aloqa formasi orqali yuborildi.</p>
      </div>
    `,
  })

  if (!emailSent) {
    console.warn("contact-submit: xabar bazaga yozildi, lekin email jo'natilmadi")
  }

  return jsonResponse({ success: true, message: "Xabaringiz yuborildi!" })
})
