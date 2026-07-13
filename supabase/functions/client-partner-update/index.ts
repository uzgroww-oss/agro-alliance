import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * Hamkor kompaniya self-service endpoint (konsolidatsiya qilingan):
 *  - GET  → { settings, notifications }  (kompaniya profil extralari + bildirishnomalar)
 *  - PUT  → hamkor yozuvini (name/sphere/contractNo/amount) va profil settings extralarini saqlaydi
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "company")
  if (auth.response) return auth.response

  try {
    // --- GET: extralar + bildirishnomalar ---
    if (req.method === "GET") {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("metadata").eq("id", auth.user.id).single()
      const settings = (profile?.metadata as Record<string, unknown>)?.settings ?? {}

      const { data: notifications } = await supabaseAdmin
        .from("notifications")
        .select("id, title, body, type, is_read, link, created_at")
        .eq("user_id", auth.user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50)

      return jsonResponse({ settings, notifications: notifications || [] })
    }

    if (req.method !== "PUT" && req.method !== "PATCH") {
      return errorResponse("Method not allowed", 405)
    }

    const body = await req.json().catch(() => ({}))
    if (Object.keys(body).length === 0) return errorResponse("Hech qanday maydon kiritilmagan", 400)

    const { data: partner } = await supabaseAdmin
      .from("partners").select("id").eq("client_profile_id", auth.user.id).is("deleted_at", null).maybeSingle()
    if (!partner) return errorResponse("Hamkor topilmadi", 404)

    // Hamkor yozuvi maydonlari
    const updates: Record<string, unknown> = {}
    if (body.name) updates.name = body.name
    if (body.sphere !== undefined) updates.sphere = body.sphere
    if (body.contractNo) updates.contract_no = body.contractNo
    if (body.amount !== undefined) updates.contract_amount = body.amount
    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin.from("partners").update(updates).eq("id", partner.id)
      if (error) return errorResponse(error.message, 500)
    }

    // Profil settings extralari (description, website, phone, address, instagram, telegram)
    const extraKeys = ["description", "website", "phone", "address", "instagram", "telegram"]
    const extras: Record<string, unknown> = {}
    for (const k of extraKeys) if (body[k] !== undefined) extras[k] = body[k]
    if (Object.keys(extras).length > 0) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("metadata").eq("id", auth.user.id).single()
      const meta = (profile?.metadata as Record<string, unknown>) ?? {}
      const mergedSettings = { ...((meta.settings as Record<string, unknown>) ?? {}), ...extras }
      const { error } = await supabaseAdmin
        .from("profiles").update({ metadata: { ...meta, settings: mergedSettings } }).eq("id", auth.user.id)
      if (error) return errorResponse(error.message, 500)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
