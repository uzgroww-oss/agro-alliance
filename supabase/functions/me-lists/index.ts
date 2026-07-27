import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { now } from "../_shared/time.ts"

/**
 * Bloger profilining uchta oddiy ro'yxati: xizmatlar, hududlar, yo'nalishlar.
 *
 * NEGA BIRLASHTIRILDI: bu uchtasi uchun 8 ta alohida funksiya yozilgan edi
 * (me-services-list/-add/-update/-delete, me-regions-list/-add/-delete,
 * me-specializations-list/-add), lekin ULARDAN DEYARLI HECH BIRI DEPLOY
 * QILINMAGAN edi. Natijada "Xizmatlar", "Hududlar" va "Yo'nalishlar"
 * bo'limlari saytda umuman ishlamasdi — 404 qaytarardi.
 *
 * Edge funksiya limiti (~100) 8 ta yangi slotga imkon bermaydi, ustiga
 * ular bir xil kodning nusxalari edi. Shuning uchun bittaga birlashtirildi:
 *   GET    ?kind=services
 *   POST   ?kind=regions          { region: "..." }
 *   PUT    ?kind=services&id=...  { title: "..." }
 *   DELETE ?kind=services&id=...
 */

/** Ruxsat etilgan ro'yxatlar. Jadval nomi kodda qat'iy — mijoz tanlay olmaydi. */
const KINDS = {
  services: { table: "blogger_services", key: "services", one: "service", requiredField: "title" },
  regions: { table: "blogger_regions", key: "regions", one: "region", requiredField: "region" },
  specializations: {
    table: "blogger_specializations",
    key: "specializations",
    one: "specialization",
    requiredField: "specialization_key",
  },
} as const

type KindName = keyof typeof KINDS

/** Faqat shu maydonlarni yozishga ruxsat — mijoz blogger_id yoki deleted_at ni yubora olmaydi */
const WRITABLE: Record<KindName, string[]> = {
  services: ["title", "description", "sort_order"],
  regions: ["region", "sort_order"],
  specializations: ["specialization_key", "sort_order"],
}

function pickWritable(kind: KindName, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of WRITABLE[kind]) {
    if (body[f] !== undefined) out[f] = body[f]
  }
  return out
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response
  const uid = auth.user.id

  const url = new URL(req.url)
  const kindParam = url.searchParams.get("kind") || ""
  if (!(kindParam in KINDS)) return errorResponse("kind noto'g'ri", 400)
  const kind = kindParam as KindName
  const { table, key, one, requiredField } = KINDS[kind]

  try {
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select("*")
        .is("deleted_at", null)
        .eq("blogger_id", uid)
        .order("sort_order", { ascending: true })

      if (error) {
        console.error(`me-lists GET ${kind}:`, error.message)
        return errorResponse("Ma'lumotni yuklab bo'lmadi", 500)
      }
      return jsonResponse({ [key]: data || [] })
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>
      const val = body[requiredField]
      if (typeof val !== "string" || !val.trim()) {
        return errorResponse(`${requiredField} majburiy`, 400)
      }

      const { data, error } = await supabaseAdmin
        .from(table)
        .insert({ blogger_id: uid, ...pickWritable(kind, body), created_by: uid })
        .select()
        .single()

      if (error) {
        console.error(`me-lists POST ${kind}:`, error.message)
        return errorResponse("Qo'shib bo'lmadi", 500)
      }
      return jsonResponse({ success: true, [one]: data })
    }

    const id = url.searchParams.get("id")

    if (req.method === "PUT" || req.method === "PATCH") {
      if (!id) return errorResponse("id kiritilmagan", 400)
      const body = await req.json().catch(() => ({}))
      const patch = pickWritable(kind, body)
      if (Object.keys(patch).length === 0) return errorResponse("O'zgartirish uchun maydon yo'q", 400)

      // .eq("blogger_id", uid) — boshqa blogerning yozuvini tahrirlab bo'lmasin
      const { data, error } = await supabaseAdmin
        .from(table)
        .update({ ...patch, updated_by: uid })
        .eq("id", id)
        .eq("blogger_id", uid)
        .is("deleted_at", null)
        .select()
        .maybeSingle()

      if (error) {
        console.error(`me-lists PUT ${kind}:`, error.message)
        return errorResponse("Saqlab bo'lmadi", 500)
      }
      if (!data) return errorResponse("Topilmadi", 404)
      return jsonResponse({ success: true, [one]: data })
    }

    if (req.method === "DELETE") {
      if (!id) return errorResponse("id kiritilmagan", 400)

      const { error } = await supabaseAdmin
        .from(table)
        .update({ deleted_at: now(), deleted_by: uid })
        .eq("id", id)
        .eq("blogger_id", uid)

      if (error) {
        console.error(`me-lists DELETE ${kind}:`, error.message)
        return errorResponse("O'chirib bo'lmadi", 500)
      }
      return jsonResponse({ success: true })
    }

    return errorResponse("Method not allowed", 405)
  } catch (err) {
    console.error("me-lists:", err instanceof Error ? err.message : err)
    return errorResponse("Xatolik yuz berdi", 500)
  }
})
