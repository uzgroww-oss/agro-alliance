/**
 * media-get-signed-download-url — imzolangan yuklab olish havolasi.
 * Body: { fileId: string, expiresIn?: number }
 * Public fayllar hammaga; private fayllar faqat yuklovchining o'ziga.
 */
import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { getDownloadUrl } from "../_shared/r2Storage.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { log } from "../_shared/logger.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  // XAVFSIZLIK: haqiqiy JWT tekshiruvi (avval oddiy "Bearer <profileId>" ishlatilgan edi — IDOR)
  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  try {
    const { fileId, expiresIn } = await req.json().catch(() => ({}))
    if (!fileId) return errorResponse("fileId talab qilinadi", 400)
    const signed = await getDownloadUrl({ fileId, expiresIn, requesterId: auth.user.id })
    return jsonResponse({ url: signed })
  } catch (e) {
    log("error", `download url: ${e instanceof Error ? e.message : String(e)}`)
    return errorResponse("Yuklab olish havolasini yaratib bo'lmadi", 400)
  }
})
