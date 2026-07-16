const ALLOWED_ORIGINS = [
  "https://agroalliance.uz",
  "https://www.agroalliance.uz",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3001",
]

const COMMON = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-application-name",
  "Access-Control-Max-Age": "86400",
}

// XAVFSIZLIK: API Bearer-token ishlatadi (cookie emas), shuning uchun
// "Access-Control-Allow-Credentials" YO'Q. Kredensiallarsiz wildcard xavfsiz —
// begona sayt foydalanuvchining localStorage'dagi tokenini o'qiy olmaydi.
// Ruxsat berilgan domen bo'lsa aniq origin qaytariladi (defense-in-depth).
export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin")
  const acao = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "*"
  return { "Access-Control-Allow-Origin": acao, "Vary": "Origin", ...COMMON }
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  ...COMMON,
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) })
  }
  return null
}
