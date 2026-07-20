import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * Mavjud hamkorni tahrirlash (nom, yo'nalish, logo, shartnoma, summa, holat).
 *
 * Mijoz logini (email/parol) BU YERDA o'zgartirilmaydi — buning uchun
 * alohida admin-partners-client-create / -client-delete funksiyalari bor.
 *
 * Slug ataylab o'zgartirilmaydi: u ommaviy havolalarda ishlatiladi,
 * nomni tahrirlaganda eski havolalar buzilib qolmasligi kerak.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PATCH" && req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin", "admin")
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return errorResponse("id majburiy", 400)

    const body = await req.json().catch(() => ({}))
    const { name, sphere, contractNo, amount, status, logo } = body as {
      name?: string
      sphere?: string
      contractNo?: string
      amount?: number | string
      status?: string
      logo?: string
    }

    // Hamkor mavjudligini tekshiramiz
    const { data: current, error: findErr } = await supabaseAdmin
      .from("partners")
      .select("id, name")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()
    if (findErr) throw new Error(findErr.message)
    if (!current) return errorResponse("Hamkor topilmadi", 404)

    const patch: Record<string, unknown> = {}

    if (typeof name === "string") {
      const trimmed = name.trim()
      if (!trimmed) return errorResponse("Tashkilot nomi bo'sh bo'lmasligi kerak", 400)
      if (trimmed.length > 200) return errorResponse("Nom juda uzun", 400)
      // Nom o'zgargan bo'lsa — boshqa hamkorda shu nom yo'qligini tekshiramiz
      if (trimmed !== current.name) {
        const { data: dup } = await supabaseAdmin
          .from("partners")
          .select("id")
          .eq("name", trimmed)
          .is("deleted_at", null)
          .neq("id", id)
          .maybeSingle()
        if (dup) return errorResponse(`"${trimmed}" nomli hamkor allaqachon mavjud.`, 409)
      }
      patch.name = trimmed
    }

    // Bo'sh satr = qiymatni tozalash (null), shuning uchun `|| null` ishlatamiz
    if (typeof sphere === "string") patch.sphere = sphere.trim().slice(0, 200) || null
    if (typeof logo === "string") patch.logo = logo.trim().slice(0, 1000) || null
    if (typeof contractNo === "string") patch.contract_no = contractNo.trim().slice(0, 100) || null

    if (amount !== undefined) {
      const n = Number(amount)
      if (amount !== "" && (!Number.isFinite(n) || n < 0)) {
        return errorResponse("Summa noto'g'ri", 400)
      }
      patch.contract_amount = amount === "" ? null : n
    }

    if (typeof status === "string") {
      if (!["active", "pending", "completed"].includes(status)) {
        return errorResponse("Holat noto'g'ri", 400)
      }
      patch.status = status
    }

    if (Object.keys(patch).length === 0) {
      return errorResponse("O'zgartirish uchun maydon berilmadi", 400)
    }

    const { data: updated, error } = await supabaseAdmin
      .from("partners")
      .update(patch)
      .eq("id", id)
      .select("id, name, sphere, logo, contract_no, contract_amount, signed_date, status")
      .single()

    if (error) throw new Error(error.message)

    return jsonResponse({
      success: true,
      partner: {
        id: updated.id,
        name: updated.name,
        sphere: updated.sphere,
        logo: updated.logo,
        contractNo: updated.contract_no,
        amount: updated.contract_amount,
        signedDate: updated.signed_date,
        status: updated.status,
      },
    })
  } catch (err) {
    const msg = (err && typeof err === "object" && "message" in err) ? String((err as { message: unknown }).message) : String(err)
    return errorResponse(msg || "Xatolik yuz berdi", 500)
  }
})
