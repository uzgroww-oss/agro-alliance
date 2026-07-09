import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from("homepage_sections")
      .select("id, section_key, title, subtitle, is_active, sort_order")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (sectionsError) throw sectionsError

    if (!sections || sections.length === 0) {
      return jsonResponse({ sections: [] })
    }

    const sectionIds = sections.map((s) => s.id)

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("homepage_section_items")
      .select("id, section_id, item_key, title, description, icon, link, sort_order, is_active")
      .in("section_id", sectionIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    if (itemsError) throw itemsError

    const itemsBySection: Record<string, typeof items> = {}
    for (const item of items ?? []) {
      if (!itemsBySection[item.section_id]) {
        itemsBySection[item.section_id] = []
      }
      itemsBySection[item.section_id].push(item)
    }

    const result = sections.map((s) => ({
      id: s.id,
      section_key: s.section_key,
      title: s.title,
      subtitle: s.subtitle,
      is_active: s.is_active,
      sort_order: s.sort_order,
      items: itemsBySection[s.id] || [],
    }))

    return jsonResponse({ sections: result })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
