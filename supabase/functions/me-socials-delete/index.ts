import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { now } from "../_shared/time.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "DELETE") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) {
      return errorResponse("ID kerak", 400)
    }

    const { data: account } = await supabaseAdmin
      .from("social_accounts")
      .select("id")
      .eq("id", id)
      .eq("blogger_id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!account) {
      return errorResponse("Ijtimoiy tarmoq topilmadi", 404)
    }

    const { error: deleteError } = await supabaseAdmin
      .from("social_accounts")
      .update({
        deleted_at: now(),
        deleted_by: auth.user.id,
      })
      .eq("id", id)

    if (deleteError) {
      return errorResponse(deleteError.message, 500)
    }

    await supabaseAdmin
      .from("social_statistics")
      .update({
        deleted_at: now(),
        deleted_by: auth.user.id,
      })
      .eq("account_id", id)

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
