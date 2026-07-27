/**
 * Public endpointlar uchun IP-asosli rate limit (DB-atomik, edge'da ishonchli).
 * Ishlatish:
 *   const limited = await rateLimited(req, "contact", 5, 60)  // 60 sekundda 5 ta
 *   if (limited) return errorResponse("Juda ko'p urinish. Birozdan keyin qayta urining.", 429)
 */
import { supabaseAdmin } from "./supabase.ts"

/**
 * Mijoz IP'si.
 *
 * MUHIM: X-Forwarded-For ning ENG CHAPDAGI qiymati — mijoz o'zi yozgan
 * qiymat, uni istalgancha soxtalashtirish mumkin edi. Har so'rovda yangi
 * soxta IP yuborib chegarani cheksiz aylanib o'tish mumkin edi.
 * ENG O'NGDAGI qiymatni platformaning o'zi qo'shadi — faqat shunga
 * ishonish mumkin.
 */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || ""
  const parts = xff.split(",").map((s) => s.trim()).filter(Boolean)
  return parts[parts.length - 1] || req.headers.get("x-real-ip") || "unknown"
}

/**
 * true qaytarsa — chegara oshgan (bloklash kerak).
 *
 * XATO BO'LSA HAM BLOKLAYDI (fail-closed). Ilgari xatoda `false`
 * qaytarardi — ya'ni DB tiqilib qolsa himoya butunlay ochilib ketardi,
 * aynan spam hujumi paytida. Endi teskari: shubhali holatda to'siladi.
 */
export async function rateLimited(req: Request, action: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const key = `${action}:${clientIp(req)}`
    const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    })
    if (error) { console.error("rate_limit rpc:", error.message); return true }
    return data === false // funksiya true=ruxsat, false=oshgan
  } catch (e) {
    console.error("rate_limit:", e instanceof Error ? e.message : e)
    return true
  }
}
