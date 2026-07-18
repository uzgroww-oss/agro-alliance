/**
 * Email jo'natish (Resend orqali).
 *
 * SOZLASH (Supabase → Edge Functions → Secrets):
 *   RESEND_API_KEY     — resend.com dan olinadi (bepul: oyiga 3000 ta xat)
 *   CONTACT_TO_EMAIL   — xabarlar keladigan manzil (default: uzgrrow@gmail.com)
 *   CONTACT_FROM_EMAIL — jo'natuvchi. Domen tasdiqlanmagan bo'lsa
 *                        "onboarding@resend.dev" ishlatiladi (faqat Resend
 *                        hisobi egasining manziliga yetib boradi).
 *
 * MUHIM: kalit yo'q bo'lsa funksiya XATO BERMAYDI — shunchaki `false`
 * qaytaradi. Chaqiruvchi kod xabarni baribir bazaga yozadi, ya'ni sozlanmagan
 * email tufayli mijoz xabari YO'QOLMAYDI.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails"

/** HTML injeksiyaning oldini olish — foydalanuvchi matni xat ichiga qo'yiladi */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export type SendEmailArgs = {
  subject: string
  html: string
  /** Javob beriladigan manzil (mijozning emaili) */
  replyTo?: string
  /** Standart: CONTACT_TO_EMAIL */
  to?: string
}

export async function sendEmail({ subject, html, replyTo, to }: SendEmailArgs): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY")
  if (!apiKey) {
    console.warn("sendEmail: RESEND_API_KEY sozlanmagan — xat jo'natilmadi")
    return false
  }

  const toEmail = to || Deno.env.get("CONTACT_TO_EMAIL") || "uzgrrow@gmail.com"
  const fromEmail = Deno.env.get("CONTACT_FROM_EMAIL") || "Agro Alliance <onboarding@resend.dev>"

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error("sendEmail: Resend xatosi", res.status, detail)
      return false
    }
    return true
  } catch (err) {
    console.error("sendEmail: tarmoq xatosi", err)
    return false
  }
}
