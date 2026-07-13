import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

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
    const id = url.searchParams.get("id")
    if (!id) return errorResponse("ID kerak", 400)

    const { data: article, error } = await supabaseAdmin
      .from("news_articles")
      .select(`
        id, title, slug, excerpt, content, status, language,
        cover_image, is_featured, is_breaking, published_at,
        reading_time, view_count,
        seo_title, seo_description, meta_keywords,
        created_at, updated_at,
        category:news_categories!category_id(id, key, name_uz),
        author:profiles!author_id(id, name, avatar)
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) return errorResponse(error.message, 500)
    if (!article) return errorResponse("Yangilik topilmadi", 404)

    const { data: tags } = await supabaseAdmin
      .from("news_article_tags")
      .select(`
        tag:news_tags!tag_id(id, name)
      `)
      .eq("article_id", id)

    const tagList = (tags || []).map((t: Record<string, unknown>) => {
      const tag = t.tag as Record<string, unknown> || {}
      return { id: tag.id as string, name: tag.name as string }
    })

    const cat = article.category as Record<string, unknown> || {}
    const author = article.author as Record<string, unknown> || {}

    return jsonResponse({
      article: {
        id: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content,
        category: {
          id: cat.id,
          key: cat.key,
          label: cat.name_uz,
        },
        author: {
          id: author.id,
          name: author.name,
          avatar: author.avatar,
        },
        status: article.status,
        language: article.language,
        cover_image: article.cover_image,
        is_featured: article.is_featured,
        is_breaking: article.is_breaking,
        published_at: article.published_at,
        reading_time: article.reading_time,
        view_count: article.view_count,
        tags: tagList,
        seo_title: article.seo_title,
        seo_description: article.seo_description,
        meta_keywords: article.meta_keywords,
        created_at: article.created_at,
        updated_at: article.updated_at,
      },
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
