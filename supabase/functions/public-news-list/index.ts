import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { parsePaginationParams } from "../_shared/validation.ts"
import { formatNewsDate } from "../_shared/time.ts"

const CACHE_TTL = 120

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const { page, per_page } = parsePaginationParams(url)
    const category = url.searchParams.get("category") || ""
    const search = url.searchParams.get("search") || ""

    let query = supabaseAdmin
      .from("news_articles")
      .select(`
        id, title, slug, excerpt, cover_image, view_count,
        published_at, is_featured, reading_time,
        category:news_categories!category_id(key, name_uz, icon),
        author:profiles!author_id(name, avatar)
      `, { count: "exact" })
      .is("deleted_at", null)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())

    if (category && category !== "all") {
      query = query.eq("category.key", category)
    }

    if (search) {
      const s = search.replace(/'/g, "''")
      query = query.or(`title.ilike.%${s}%,excerpt.ilike.%${s}%`)
    }

    query = query.order("published_at", { ascending: false })

    const from = (page - 1) * per_page
    const to = from + per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) return errorResponse(error.message, 500)

    const news = (data || []).map((a: Record<string, unknown>) => {
      const cat = a.category as Record<string, unknown> || {}
      const author = a.author as Record<string, unknown> || {}
      const publishedAt = a.published_at as string || ""
      return {
        slug: a.slug,
        title: a.title,
        cat: cat.key || "",
        desc: a.excerpt || "",
        date: formatNewsDate(publishedAt),
        views: (a.view_count || 0) > 1000
          ? `${Math.floor((a.view_count as number) / 1000)}K+`
          : `${a.view_count || 0}`,
        seed: a.cover_image || "",
        top: a.is_featured || false,
        author: author.name as string || undefined,
        body: [] as string[],
      }
    })

    // Fetch categories with real article counts
    const { data: categories } = await supabaseAdmin
      .from("news_categories")
      .select(`
        key,
        name_uz,
        icon,
        articles:news_articles!inner(count)
      `)
      .eq("is_active", true)
      .is("deleted_at", null)
      .eq("news_articles.status", "published")
      .is("news_articles.deleted_at", null)
      .lte("news_articles.published_at", new Date().toISOString())
      .order("sort_order", { ascending: true })

    const cats = [
      { key: "all", label: "Barcha yangiliklar", icon: "grid", count: count || 0 },
      ...(categories || []).map((c: Record<string, unknown>) => ({
        key: c.key,
        label: c.name_uz as string || c.key as string,
        icon: (c.icon as string) || "grid",
        count: (c.articles as Array<unknown> || []).length || 0,
      })),
    ]

    return cachedJsonResponse({
      news,
      pagination: {
        page,
        per_page,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / per_page),
      },
      categories: cats,
    }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
