import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "DELETE") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    const id = new URL(req.url).searchParams.get("id")
    if (!id) return errorResponse("id kerak", 400)

    const { data: brand } = await supabaseAdmin
      .from("blogger_brands")
      .select("id")
      .eq("id", id)
      .eq("blogger_id", auth.user.id)
      .is("deleted_at", null)
      .single()

    if (!brand) return errorResponse("Brend topilmadi", 404)

    const { error } = await supabaseAdmin
      .from("blogger_brands")
      .update({ deleted_at: new Date().toISOString(), deleted_by: auth.user.id })
      .eq("id", id)

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
