import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { slugify } from "../_shared/helpers.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const errors = validate(body, { name: [required] })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const { name, sphere, contractNo, amount, status } = body as {
      name: string
      sphere?: string
      contractNo?: string
      amount?: number
      status?: string
    }

    const slug = slugify(name)

    const { data: partner, error } = await supabaseAdmin
      .from("partners")
      .insert({
        name,
        slug,
        sphere: sphere || null,
        contract_no: contractNo || null,
        contract_amount: amount || null,
        signed_date: new Date().toISOString(),
        status: status || "active",
        created_by: auth.user.id,
      })
      .select("id, name, sphere, contract_no, contract_amount, signed_date, status")
      .single()

    if (error) throw error

    return jsonResponse({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        sphere: partner.sphere,
        contractNo: partner.contract_no,
        amount: partner.contract_amount,
        signedDate: partner.signed_date,
        status: partner.status,
      },
    })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
