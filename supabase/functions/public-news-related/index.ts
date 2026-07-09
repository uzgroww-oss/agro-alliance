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

    const { data: current, error: curErr } = await supabaseAdmin
      .from("news_articles")
      .select("id, category_id")
      .is("deleted_at", null)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()

    if (curErr) return errorResponse(curErr.message, 500)
    if (!current) return cachedJsonResponse({ news: [] }, CACHE_TTL)

    // Prefer same-category articles first, up to 3 total
    let related: Record<string, unknown>[] = []
    let needed = 3

    if (current.category_id) {
      const { data: sameCat, error: scErr } = await supabaseAdmin
        .from("news_articles")
        .select(`
          id, title, slug, excerpt, cover_image, view_count, published_at,
          category:news_categories!category_id(key, name_uz, icon),
          author:profiles!author_id(name)
        `)
        .is("deleted_at", null)
        .eq("status", "published")
        .neq("id", current.id)
        .eq("category_id", current.category_id)
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false })
        .limit(needed)

      if (scErr) return errorResponse(scErr.message, 500)
      related = (sameCat || []) as Record<string, unknown>[]
      needed -= related.length
    }

    // Fill remaining from other categories
    if (needed > 0) {
      const excludeIds = [current.id, ...related.map((r) => r.id)]
      const { data: otherCat, error: ocErr } = await supabaseAdmin
        .from("news_articles")
        .select(`
          id, title, slug, excerpt, cover_image, view_count, published_at,
          category:news_categories!category_id(key, name_uz, icon),
          author:profiles!author_id(name)
        `)
        .is("deleted_at", null)
        .eq("status", "published")
        .not("id", "in", `(${excludeIds.join(",")})`)
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false })
        .limit(needed)

      if (ocErr) return errorResponse(ocErr.message, 500)
      related = [...related, ...((otherCat || []) as Record<string, unknown>[])]
    }

    const news = related.map((a: Record<string, unknown>) => {
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
        author: author.name as string || undefined,
      }
    })

    return cachedJsonResponse({ news }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})


