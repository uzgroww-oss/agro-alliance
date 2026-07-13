import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/webp": "webp", "image/gif": "gif",
  }
  return map[mime] || "bin"
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  try {
    const { originalFilename, mimeType, sizeBytes, isPublic } = await req.json()

    if (!originalFilename || !mimeType) {
      return errorResponse("originalFilename va mimeType talab qilinadi", 400)
    }
    if (sizeBytes > MAX_SIZE) {
      return errorResponse("Fayl hajmi 10MB dan oshmasligi kerak", 400)
    }
    if (!ALLOWED_MIME.includes(mimeType)) {
      return errorResponse(`Ruxsat etilmagan fayl turi: ${mimeType}`, 400)
    }

    const ext = extFromMime(mimeType)
    const storageKey = `${crypto.randomUUID()}.${ext}`
    const bucket = isPublic ? "public" : "private"

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(storageKey)

    if (signedError) {
      console.error("createSignedUploadUrl error:", signedError.message)
      return errorResponse(`Storage xatosi: ${signedError.message}`, 500)
    }

    const { data: fileRecord, error: dbError } = await supabaseAdmin.from("media_files").insert({
      original_filename: originalFilename,
      stored_filename: storageKey,
      storage_key: storageKey,
      bucket,
      mime_type: mimeType,
      extension: ext,
      size_bytes: sizeBytes,
      uploaded_by: auth.user.id,
      status: "uploading",
      is_public: isPublic ?? true,
    }).select("id").single()

    if (dbError) {
      console.error("DB insert error:", dbError.message)
      return errorResponse(`DB xatosi: ${dbError.message}`, 500)
    }

    const publicUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${bucket}/${storageKey}`

    return jsonResponse({ fileId: fileRecord.id, signedUrl: signedData.signedUrl, storageKey, publicUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("media-get-signed-upload-url error:", msg)
    return errorResponse(msg, 400)
  }
})