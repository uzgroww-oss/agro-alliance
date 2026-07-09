const ALLOWED_ORIGINS = [
  "https://agroalliance.uz",
  "https://www.agroalliance.uz",
  "http://localhost:5173",
  "http://localhost:3001",
]

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("Origin") ?? ""
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-application-name",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
  }
}

/** @deprecated Use buildCorsHeaders(req) instead. Kept for backward compat. */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-application-name",
  "Access-Control-Max-Age": "86400",
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) })
  }
  return null
}
