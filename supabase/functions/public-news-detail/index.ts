import { handleCors } from "../_shared/cors.ts"
import { noCacheJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { formatNewsDate } from "../_shared/time.ts"
import { applyLang, langOf } from "../_shared/translate.ts"


Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const lang = langOf(url)
    const slug = url.searchParams.get("slug")
    if (!slug) return errorResponse("Slug query parameter is required", 400)

    const { data: article, error } = await supabaseAdmin
      .from("news_articles")
      .select(`
        id, title, slug, excerpt, content, cover_image,
        view_count, published_at, is_featured, reading_time, translations,
        category:news_categories!category_id(key, name_uz, icon),
        author:profiles!author_id(name, avatar)
      `)
      .is("deleted_at", null)
      .eq("status", "published")
      .eq("slug", slug)
      .lte("published_at", new Date().toISOString())
      .maybeSingle()

    if (error) {
      console.error("public-news-detail:", error.message)
      return errorResponse("Yangilikni yuklab bo'lmadi", 500)
    }
    // MUHIM: ilgari bu yerda 200 + {article: null} qaytardi. Ya'ni
    // o'chirilgan yoki umuman mavjud bo'lmagan maqola manzili "hammasi
    // joyida" degan javob berardi — qidiruv tizimlari uni yaroqli sahifa
    // deb indekslashda davom etardi.
    if (!article) return errorResponse("Yangilik topilmadi", 404, "NOT_FOUND")

    // Ko'rish sonini +1 qilish
    const newViewCount = (article.view_count || 0) + 1
    await supabaseAdmin
      .from("news_articles")
      .update({ view_count: newViewCount })
      .eq("id", article.id)

    // Tanlangan tilda: tarjima bo'lsa u, bo'lmasa o'zbekcha matn
    const a = applyLang(
      article as unknown as Record<string, unknown>,
      lang,
      ["title", "excerpt", "content"],
    )

    // PostgREST bog'langan jadvalni massiv deb tiplaydi, amalda esa
    // bitta obyekt keladi — shuning uchun `unknown` orqali o'giramiz.
    const cat = (a.category as unknown as Record<string, unknown>) || {}
    const author = (a.author as unknown as Record<string, unknown>) || {}
    const publishedAt = article.published_at as string || ""
    const result = {
      slug: article.slug,
      title: a.title,
      cat: cat.key || "",
      desc: a.excerpt || "",
      date: formatNewsDate(publishedAt),
      views: newViewCount > 1000
        ? `${Math.floor(newViewCount / 1000)}K+`
        : `${newViewCount}`,
      seed: article.cover_image || "",
      top: article.is_featured || false,
      author: author.name as string || undefined,
      body: [(a.content as string) || ""],
    }

    return noCacheJsonResponse({ article: result })
  } catch (err) {
    console.error("public-news-detail:", err instanceof Error ? err.message : err)
    return errorResponse("Yangilikni yuklab bo'lmadi", 500)
  }
})
