import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * me-tasks-update — Bloger o'z topshirig'i holatini yangilaydi (o'qildi / bajarilmoqda / bajarildi).
 * PATCH ?id=<assignment_id>  Body: { status?, is_read?, note? }
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== "PATCH" && req.method !== "PUT") return errorResponse("Method not allowed", 405)

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return errorResponse("id talab qilinadi", 400)

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.status !== undefined) {
      if (!["new", "in_progress", "done"].includes(body.status)) return errorResponse("Noto'g'ri status", 400)
      updates.status = body.status
    }
    if (body.is_read !== undefined) updates.is_read = !!body.is_read
    if (body.note !== undefined) updates.note = String(body.note)

    // Faqat o'z topshirig'ini yangilay oladi
    const { data, error } = await supabaseAdmin
      .from("blogger_task_assignments")
      .update(updates)
      .eq("id", id)
      .eq("blogger_id", auth.user.id)
      .is("deleted_at", null)
      .select("id, status, is_read, note")
      .maybeSingle()
    if (error) return errorResponse(error.message, 500)
    if (!data) return errorResponse("Topshiriq topilmadi", 404)

    return jsonResponse({ success: true, assignment: data })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
