/**
 * Public endpointlar uchun IP-asosli rate limit (DB-atomik, edge'da ishonchli).
 * Ishlatish:
 *   const limited = await rateLimited(req, "contact", 5, 60)  // 60 sekundda 5 ta
 *   if (limited) return errorResponse("Juda ko'p urinish. Birozdan keyin qayta urining.", 429)
 */
import { supabaseAdmin } from "./supabase.ts"

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || ""
  const ip = xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown"
  return ip
}

/** true qaytarsa — chegara oshgan (bloklash kerak). Xato bo'lsa false (ochiq, ilova buzilmasin). */
export async function rateLimited(req: Request, action: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const key = `${action}:${clientIp(req)}`
    const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    })
    if (error) { console.error("rate_limit rpc:", error.message); return false }
    return data === false // funksiya true=ruxsat, false=oshgan
  } catch (e) {
    console.error("rate_limit:", e instanceof Error ? e.message : e)
    return false
  }
}
