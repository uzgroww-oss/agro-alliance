import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const errors = validate(body, {
      key: [required],
      name_uz: [required],
    })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const { key, name_uz, name_ru, name_en, icon } = body as Record<string, unknown>

    const { data: category, error } = await supabaseAdmin
      .from("news_categories")
      .insert({
        key: key as string,
        name_uz: name_uz as string,
        name_ru: (name_ru as string) || "",
        name_en: (name_en as string) || "",
        icon: (icon as string) || null,
        created_by: auth.user.id,
      })
      .select("id, key, name_uz, name_ru, name_en, icon, sort_order, is_active")
      .single()

    if (error) throw error

    return jsonResponse({ success: true, category })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
