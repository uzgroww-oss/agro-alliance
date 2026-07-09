import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { formatNewsDate } from "../_shared/time.ts"

const CACHE_TTL = 300

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { data, error } = await supabaseAdmin
      .from("news_articles")
      .select(`
        id, title, slug, cover_image, view_count, published_at,
        category:news_categories!category_id(key),
        author:profiles!author_id(name)
      `)
      .is("deleted_at", null)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("view_count", { ascending: false })
      .limit(5)

    if (error) return errorResponse(error.message, 500)

    const popular = (data || []).map((a: Record<string, unknown>) => {
      const publishedAt = a.published_at as string || ""
      return {
        title: a.title,
        date: formatNewsDate(publishedAt),
        views: (a.view_count || 0) > 1000
          ? `${Math.floor((a.view_count as number) / 1000)}K+`
          : `${a.view_count || 0}`,
        seed: a.cover_image || "",
        slug: a.slug,
      }
    })

    return cachedJsonResponse({ popular }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
