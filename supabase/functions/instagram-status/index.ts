import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response

    const { data: token } = await supabaseAdmin
      .from("instagram_tokens")
      .select("instagram_username, instagram_account_id, expires_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    return jsonResponse({
      connected: !!(token && token.instagram_account_id),
      username: token?.instagram_username || null,
      expires_at: token?.expires_at || null,
    })
  } catch (err) {
    return jsonResponse({ connected: false, username: null, expires_at: null })
  }
})
