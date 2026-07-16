import { corsHeaders } from "./cors.ts"

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...corsHeaders, "Content-Type": "application/json", ...extra }
}

export function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: buildHeaders(extraHeaders),
  })
}

export function cachedJsonResponse(data: unknown, ttlSeconds: number, status = 200): Response {
  return jsonResponse(data, status, {
    "Cache-Control": `public, s-maxage=${ttlSeconds}, max-age=${ttlSeconds}`,
  })
}

// O'chirilgan/yangilangan kontent darhol yo'qolishi kerak bo'lgan endpointlar uchun
export function noCacheJsonResponse(data: unknown, status = 200): Response {
  return jsonResponse(data, status, { "Cache-Control": "no-store" })
}

export function successResponse(data: Record<string, unknown>): Response {
  return jsonResponse({ success: true, ...data })
}

export function errorResponse(
  message: string,
  status = 400,
  code?: string,
  details?: unknown,
): Response {
  return jsonResponse(
    { error: message, ...(code && { code }), ...(details && { details }) },
    status,
  )
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  perPage: number,
  total: number,
): Response {
  return jsonResponse({
    data,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  })
}
