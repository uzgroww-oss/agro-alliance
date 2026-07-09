import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await requireRole(req, "super_admin")
    if (auth.response) return auth.response

    const url = new URL(req.url)
    const status = url.searchParams.get("status")
    const jobType = url.searchParams.get("job_type")

    let query = supabaseAdmin
      .from("news_jobs")
      .select("*")
      .is("deleted_at", null)

    if (status) {
      query = query.eq("status", status)
    }

    if (jobType) {
      query = query.eq("job_type", jobType)
    }

    query = query.order("created_at", { ascending: false })

    const { data: jobs, error } = await query

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ jobs: jobs || [] })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
