import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { validate, required } from "../_shared/validation.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") return errorResponse("Method not allowed", 405)

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  const body = await req.json().catch(() => ({}))
  const errors = validate(body, { title: [required] })
  if (errors.length > 0) return errorResponse(errors[0], 400)

  try {
    // Foydalanuvchining roli "blogger" bo'lsa ham, `bloggers` jadvalida
    // qatori bo'lmasligi mumkin. Tekshiruvsiz insert FK cheklovini buzib,
    // foydalanuvchiga xom DB xatosini ko'rsatardi:
    // "violates foreign key constraint blogger_achievements_blogger_id_fkey"
    const { data: blogger } = await supabaseAdmin
      .from("bloggers")
      .select("id")
      .eq("id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle()
    if (!blogger) {
      return errorResponse(
        "Hisobingiz hali bloger sifatida ro'yxatdan o'tkazilmagan. Administrator bilan bog'laning.",
        404,
      )
    }

    const { data, error } = await supabaseAdmin
      .from("blogger_achievements")
      .insert({ blogger_id: auth.user.id, ...body, created_by: auth.user.id })
      .select()
      .single()

    if (error) {
      // Xom DB xabari mijozga ketmasin — jadval/cheklov nomlarini oshkor qiladi
      console.error("me-achievements-add:", error.message)
      return errorResponse("Yutuqni qo'shib bo'lmadi", 500)
    }
    return jsonResponse({ success: true, achievement: data })
  } catch (err) {
    console.error("me-achievements-add:", err instanceof Error ? err.message : err)
    return errorResponse("Xatolik yuz berdi", 500)
  }
})
