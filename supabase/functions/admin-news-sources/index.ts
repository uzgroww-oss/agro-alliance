import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, successResponse, errorResponse } from "../_shared/response.ts"
import { requireRole } from "../_shared/auth.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * Manba URL'ini tekshiradi.
 *
 * NEGA KERAK: bu yerga qo'shilgan manzilni keyinchalik SERVER o'zi
 * yuklaydi (worker-web-crawler, worker-rss-ingest). Tekshiruvsiz bu
 * SSRF bo'ladi — ichki tarmoq, bulut metadata xizmati (169.254.169.254)
 * yoki localhost'dagi xizmatlarga so'rov yuborish mumkin edi.
 */
function badSourceUrl(raw: string): string | null {
  let u: URL
  try { u = new URL(raw) } catch { return "URL noto'g'ri" }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "Faqat http/https manzil qabul qilinadi"
  const h = u.hostname.toLowerCase()
  if (
    h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) || /^0\./.test(h) ||
    h === "[::1]" || h === "::1"
  ) return "Ichki tarmoq manzillari qabul qilinmaydi"
  return null
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  // ILGARI faqat verifyAuth bor edi — ya'ni ISTALGAN faol foydalanuvchi
  // (oddiy user, blogger) manba qo'sha va o'chira olardi.
  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  const url = new URL(req.url)
  const sourceId = url.searchParams.get("id")

  try {
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("news_sources")
        .select("id, name, type, url, is_active, last_fetched_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ sources: data || [] })
    }

    if (req.method === "POST") {
      const { name, type, url } = await req.json()
      if (!name || !type || !url) return errorResponse("name, type va url majburiy", 400)
      const urlErr = badSourceUrl(String(url))
      if (urlErr) return errorResponse(urlErr, 400)

      const { data, error } = await supabaseAdmin
        .from("news_sources")
        .insert({ name, type, url, created_by: auth.user.id })
        .select("id, name, type, url, is_active, last_fetched_at")
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ source: data }, 201)
    }

    if (req.method === "DELETE") {
      if (!sourceId) return errorResponse("source id kerak", 400)

      const { error } = await supabaseAdmin
        .from("news_sources")
        .update({ deleted_at: new Date().toISOString(), deleted_by: auth.user.id })
        .eq("id", sourceId)

      if (error) return errorResponse(error.message, 500)
      return successResponse({})
    }

    return errorResponse("Method not allowed", 405)
  } catch (e) {
    return errorResponse((e as Error).message, 500)
  }
})