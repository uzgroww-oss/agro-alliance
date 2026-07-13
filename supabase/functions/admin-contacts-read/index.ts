import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { now } from "../_shared/time.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PATCH") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin", "admin")
  if (auth.response) return auth.response

  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return errorResponse("id kerak", 400)

    const body = await req.json().catch(() => ({}))
    if (body.is_read === undefined) {
      return errorResponse("is_read kerak", 400)
    }

    const updates: Record<string, unknown> = { is_read: body.is_read }
    if (body.is_read) {
      updates.read_at = now()
      updates.read_by = auth.user.id
    } else {
      updates.read_at = null
      updates.read_by = null
    }

    const { data, error } = await supabaseAdmin
      .from("contact_messages")
      .update(updates)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id, is_read")
      .single()

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ success: true, message: { id: data.id, is_read: data.is_read } })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
