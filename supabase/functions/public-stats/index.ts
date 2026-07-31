import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { getDynamicStats } from "../_shared/stats.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const stats = await getDynamicStats()
    return cachedJsonResponse({ stats }, 300)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
