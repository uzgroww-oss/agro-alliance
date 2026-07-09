import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { formatNewsDate } from "../_shared/time.ts"

const CACHE_TTL = 120

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const slug = new URL(req.url).searchParams.get("slug")
    if (!slug) return errorResponse("Slug query parameter is required", 400)

    const { data: article, error } = await supabaseAdmin
      .from("news_articles")
      .select(`
        id, title, slug, excerpt, content, cover_image,
        view_count, published_at, is_featured, reading_time,
        category:news_categories!category_id(key, name_uz, icon),
        author:profiles!author_id(name, avatar)
      `)
      .is("deleted_at", null)
      .eq("status", "published")
      .eq("slug", slug)
      .lte("published_at", new Date().toISOString())
      .maybeSingle()

    if (error) return errorResponse(error.message, 500)
    if (!article) return cachedJsonResponse({ article: null }, CACHE_TTL)

    const cat = article.category as Record<string, unknown> || {}
    const author = article.author as Record<string, unknown> || {}
    const publishedAt = article.published_at as string || ""
    const content = (article.content as string || "").split("\n\n")

    const result = {
      slug: article.slug,
      title: article.title,
      cat: cat.key || "",
      desc: article.excerpt || "",
      date: formatNewsDate(publishedAt),
      views: (article.view_count || 0) > 1000
        ? `${Math.floor((article.view_count as number) / 1000)}K+`
        : `${article.view_count || 0}`,
      seed: article.cover_image || "",
      top: article.is_featured || false,
      author: author.name as string || undefined,
      body: content,
    }

    return cachedJsonResponse({ article: result }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
