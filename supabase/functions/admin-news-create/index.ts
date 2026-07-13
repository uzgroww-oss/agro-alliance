import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { validate, required } from "../_shared/validation.ts"
import { slugify } from "../_shared/helpers.ts"
import { now } from "../_shared/time.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response
    if (auth.user.role !== "super_admin" && auth.user.role !== "admin" && auth.user.role !== "editor") {
      return errorResponse("Ruxsat yo'q", 403, "FORBIDDEN")
    }

    const body = await req.json().catch(() => ({}))
    const errors = validate(body, {
      title: [required],
      content: [required],
    })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const {
      title,
      content,
      excerpt,
      category_id,
      language,
      cover_image,
      status = "draft",
      is_featured,
      is_breaking,
      source_name,
      source_url,
      meta_keywords,
      allow_comments,
    } = body as Record<string, unknown>

    let slug = slugify(title as string)
    if (!slug) slug = "news-" + Date.now()

    const { data: existing } = await supabaseAdmin
      .from("news_articles")
      .select("id")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle()

    if (existing) {
      slug = slug + "-" + Date.now()
    }

    const timestamp = now()

    const { data: article, error } = await supabaseAdmin
      .from("news_articles")
      .insert({
        title,
        slug,
        content,
        excerpt: excerpt || null,
        category_id: category_id || null,
        language: language || "uz",
        cover_image: cover_image || null,
        status,
        is_featured: is_featured || false,
        is_breaking: is_breaking || false,
        source_name: source_name || null,
        source_url: source_url || null,
        meta_keywords: meta_keywords || null,
        allow_comments: allow_comments !== undefined ? allow_comments : true,
        author_id: auth.user.id,
        created_by: auth.user.id,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select("id, title, slug, status")
      .single()

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({
      success: true,
      article: {
        id: article.id,
        title: article.title,
        slug: article.slug,
        status: article.status,
      },
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
