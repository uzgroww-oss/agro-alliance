import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = await requireRole(req, "super_admin")
    if (auth.response) return auth.response

    const { data, error } = await supabaseAdmin
      .from("bloggers")
      .select(`
        id,
        slug,
        profiles!bloggers_id_fkey!inner(name, email, status),
        blogger_specializations(specialization_key),
        blogger_regions(region)
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (error) return errorResponse(error.message, 500)

    const bloggers = (data || []).map((b: Record<string, unknown>) => {
      const profile = (b.profiles as Record<string, unknown>) || {}
      const specializations = (b.blogger_specializations as Array<Record<string, unknown>> || []).map(
        (s: Record<string, unknown>) => s.specialization_key,
      )
      const regions = (b.blogger_regions as Array<Record<string, unknown>> || []).map(
        (r: Record<string, unknown>) => r.region,
      )
      return {
        id: b.id,
        name: profile.name || "",
        email: profile.email || "",
        status: profile.status || "",
        cat: (specializations[0] as string) || "",
        region: (regions[0] as string) || "",
      }
    })

    return jsonResponse({ bloggers })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
