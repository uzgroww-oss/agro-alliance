import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { getDynamicStats } from "../_shared/stats.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PUT") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const stats = body.stats

    if (!Array.isArray(stats)) {
      return errorResponse("stats must be an array", 400)
    }

    const rows = stats.map((s: { key: string; value: string; label: string }) => ({
      key: s.key,
      value: s.value,
      label: s.label,
      deleted_at: null,
    }))

    for (const row of rows) {
      const { data: existing } = await supabaseAdmin
        .from("homepage_stats")
        .select("id")
        .eq("key", row.key)
        .is("deleted_at", null)
        .maybeSingle()

      if (existing) {
        const { error: updateError } = await supabaseAdmin
          .from("homepage_stats")
          .update({ value: row.value, label: row.label })
          .eq("key", row.key)
          .is("deleted_at", null)

        if (updateError) return errorResponse(updateError.message, 500)
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("homepage_stats")
          .insert({
            key: row.key,
            value: row.value,
            label: row.label,
            sort_order: 0,
          })

        if (insertError) return errorResponse(insertError.message, 500)
      }
    }

    const { data, error: fetchError } = await supabaseAdmin
      .from("homepage_stats")
      .select("key, value, label")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (fetchError) return errorResponse(fetchError.message, 500)

    const dynamicStats = await getDynamicStats(data || [])

    return jsonResponse({ success: true, stats: dynamicStats })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
