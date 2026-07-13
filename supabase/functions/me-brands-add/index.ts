import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    const body = await req.json().catch(() => ({}))
    const errors = validate(body, { name: [required] })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const { name, logo_url } = body as { name: string; logo_url?: string }

    const { data: blogger } = await supabaseAdmin
      .from("bloggers")
      .select("id")
      .eq("id", auth.user.id)
      .is("deleted_at", null)
      .single()

    if (!blogger) {
      return errorResponse("Bloger topilmadi", 404)
    }

    const { data: brand, error } = await supabaseAdmin
      .from("blogger_brands")
      .insert({
        blogger_id: auth.user.id,
        name,
        logo_url: logo_url || null,
        created_by: auth.user.id,
      })
      .select("id, name, logo_url, sort_order")
      .single()

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ success: true, brand })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
