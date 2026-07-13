import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, successResponse, errorResponse } from "../_shared/response.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  const url = new URL(req.url)
  const sourceId = url.searchParams.get("id")

  try {
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("news_sources")
        .select("id, name, type, url, is_active, last_fetched_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ sources: data || [] })
    }

    if (req.method === "POST") {
      const { name, type, url } = await req.json()
      if (!name || !type || !url) return errorResponse("name, type va url majburiy", 400)

      const { data, error } = await supabaseAdmin
        .from("news_sources")
        .insert({ name, type, url, created_by: auth.user.id })
        .select("id, name, type, url, is_active, last_fetched_at")
        .single()

      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ source: data }, 201)
    }

    if (req.method === "DELETE") {
      if (!sourceId) return errorResponse("source id kerak", 400)

      const { error } = await supabaseAdmin
        .from("news_sources")
        .update({ deleted_at: new Date().toISOString(), deleted_by: auth.user.id })
        .eq("id", sourceId)

      if (error) return errorResponse(error.message, 500)
      return successResponse({})
    }

    return errorResponse("Method not allowed", 405)
  } catch (e) {
    return errorResponse((e as Error).message, 500)
  }
})