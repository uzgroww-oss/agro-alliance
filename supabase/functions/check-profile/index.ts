import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, status, deleted_at")
      .eq("id", "62bac161-0ce2-423f-a5f2-c582a6cc127c")
      .maybeSingle()

    if (error) return errorResponse(error.message, 500)
    return jsonResponse({ profile: data })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
