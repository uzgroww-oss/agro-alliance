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

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const errors = validate(body, {
      key: [required],
      label: [required],
      type: [required],
    })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const validTypes = ["blogger", "news", "partner"]
    if (!validTypes.includes(body.type as string)) {
      return errorResponse("Type notog'ri", 400)
    }

    const { key, label, type, icon, sort_order } = body as {
      key: string
      label: string
      type: string
      icon?: string
      sort_order?: number
    }

    const { data: category, error } = await supabaseAdmin
      .from("categories")
      .insert({
        key,
        label,
        type,
        icon: icon || null,
        sort_order: sort_order ?? 0,
        created_by: auth.user.id,
      })
      .select("id, key, label, type, icon, sort_order")
      .single()

    if (error) throw error

    return jsonResponse({
      success: true,
      category,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
