import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "GET") return errorResponse("Method not allowed", 405)

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  return jsonResponse({ me: auth.user })
})
