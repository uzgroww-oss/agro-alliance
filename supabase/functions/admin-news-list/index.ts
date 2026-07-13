import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { paginatedResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { parsePaginationParams } from "../_shared/validation.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response
    if (auth.user.role !== "super_admin" && auth.user.role !== "admin" && auth.user.role !== "editor") {
      return errorResponse("Ruxsat yo'q", 403, "FORBIDDEN")
    }

    const url = new URL(req.url)
    const { page, per_page } = parsePaginationParams(url)
    const status = url.searchParams.get("status") || ""
    const search = url.searchParams.get("search") || ""

    let query = supabaseAdmin
      .from("news_articles")
      .select(`
        id, title, slug, status, language, is_featured, is_breaking,
        published_at, view_count, created_at,
        category:news_categories!category_id(id, name_uz, key),
        author:profiles!author_id(id, name)
      `, { count: "exact" })
      .is("deleted_at", null)

    if (status) {
      query = query.eq("status", status)
    }

    if (search) {
      const s = search.replace(/'/g, "''")
      query = query.ilike("title", `%${s}%`)
    }

    query = query.order("created_at", { ascending: false })

    const from = (page - 1) * per_page
    const to = from + per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) return errorResponse(error.message, 500)

    const articles = (data || []).map((a: Record<string, unknown>) => {
      const cat = (a.category || {}) as Record<string, unknown>
      return {
        id: a.id,
        title: a.title,
        slug: a.slug,
        category: cat.id ? { id: cat.id, key: cat.key, label: cat.name_uz } : null,
        author: a.author as Record<string, unknown> || null,
        status: a.status,
        language: a.language,
        is_featured: a.is_featured,
        is_breaking: a.is_breaking,
        published_at: a.published_at,
        view_count: a.view_count,
        created_at: a.created_at,
      }
    })

    return paginatedResponse(articles, page, per_page, count || 0)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
