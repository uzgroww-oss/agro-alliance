import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

const CACHE_TTL = 600

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { data: partners, error } = await supabaseAdmin
      .from("partners")
      .select("id, name, slug, sphere, logo, direction, sort_order")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (error) return errorResponse(error.message, 500)

    const list = (partners || []).map((p: Record<string, unknown>) => ({
      name: p.name,
      slug: p.slug,
      sphere: p.sphere || "",
      logo: p.logo || null,
      direction: p.direction || "",
    }))

    const stats = {
      total: list.length,
      countries: 15,
      strategic: 8,
      coverage: "1M+",
    }

    return cachedJsonResponse({ partners: list, stats }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
