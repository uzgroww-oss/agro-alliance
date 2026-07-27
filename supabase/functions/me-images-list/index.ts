import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * Bloger galereyasi: ro'yxat (GET), qo'shish (POST), o'chirish (DELETE).
 *
 * NEGA BITTA FUNKSIYADA: ilgari uchta alohida funksiya bor edi
 * (me-images-list / -add / -delete), lekin faqat BIRINCHISI deploy
 * qilingan edi. Natijada galereya ochilardi, ammo rasm qo'shish va
 * o'chirish 404 qaytarardi — foydalanuvchi uchun "tugma ishlamaydi".
 * Edge funksiya limiti (~100) yangi slot ajratishga imkon bermaydi,
 * shuning uchun uchalasi allaqachon deploy qilingan shu funksiyaga
 * birlashtirildi. Loyihada bu naqsh bor (me-socials, me-videos-add).
 */

type GalleryImage = { id: string; url: string; caption?: string; createdAt: string }

/** Profil metadata'sini va undagi rasmlar ro'yxatini o'qiydi */
async function readImages(userId: string): Promise<{ meta: Record<string, unknown>; images: GalleryImage[] }> {
  const { data: current } = await supabaseAdmin
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .is("deleted_at", null)
    .single()

  const meta = (current?.metadata as Record<string, unknown>) || {}
  return { meta, images: (meta.images as GalleryImage[]) || [] }
}

function writeImages(userId: string, meta: Record<string, unknown>, images: GalleryImage[]) {
  return supabaseAdmin
    .from("profiles")
    .update({ metadata: { ...meta, images } })
    .eq("id", userId)
    .is("deleted_at", null)
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response
    const uid = auth.user.id

    if (req.method === "GET") {
      const { images } = await readImages(uid)
      return jsonResponse({ images })
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const errors = validate(body, { url: [required] })
      if (errors.length > 0) return errorResponse(errors[0], 400)

      const { url, caption } = body as { url: string; caption?: string }
      const { meta, images } = await readImages(uid)

      const newImage: GalleryImage = {
        id: crypto.randomUUID(),
        url,
        caption: caption || "",
        createdAt: new Date().toISOString(),
      }
      images.push(newImage)

      const { error } = await writeImages(uid, meta, images)
      if (error) {
        // Xom DB xabari mijozga ketmasin — sxema tafsilotlarini oshkor qiladi
        console.error("me-images POST:", error.message)
        return errorResponse("Rasmni saqlab bo'lmadi", 500)
      }
      return jsonResponse({ success: true, image: newImage })
    }

    if (req.method === "DELETE") {
      const imageId = new URL(req.url).searchParams.get("id")
      if (!imageId) return errorResponse("id kerak", 400)

      const { meta, images } = await readImages(uid)
      const filtered = images.filter((img) => img.id !== imageId)
      if (filtered.length === images.length) return errorResponse("Rasm topilmadi", 404)

      const { error } = await writeImages(uid, meta, filtered)
      if (error) {
        console.error("me-images DELETE:", error.message)
        return errorResponse("Rasmni o'chirib bo'lmadi", 500)
      }
      return jsonResponse({ success: true })
    }

    return errorResponse("Method not allowed", 405)
  } catch (err) {
    console.error("me-images:", err instanceof Error ? err.message : err)
    return errorResponse("Xatolik yuz berdi", 500)
  }
})
