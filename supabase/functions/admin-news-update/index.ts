import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { slugify } from "../_shared/helpers.ts"
import { now } from "../_shared/time.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PATCH" && req.method !== "PUT") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response
    if (auth.user.role !== "super_admin" && auth.user.role !== "admin") {
      return errorResponse("Ruxsat yo'q", 403, "FORBIDDEN")
    }

    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return errorResponse("ID kerak", 400)

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("news_articles")
      .select("id, title, slug")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()

    if (fetchError) return errorResponse(fetchError.message, 500)
    if (!existing) return errorResponse("Yangilik topilmadi", 404)

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    const fields: string[] = [
      "title", "content", "excerpt", "category_id", "language",
      "cover_image", "status", "is_featured", "is_breaking",
      "source_name", "source_url", "published_at",
      "seo_title", "seo_description", "canonical_url", "og_image",
      "meta_keywords", "allow_comments", "reading_time",
    ]

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (body.title !== undefined && body.title !== existing.title) {
      let newSlug = slugify(body.title as string)
      if (!newSlug) newSlug = "news-" + Date.now()

      const { data: slugExisting } = await supabaseAdmin
        .from("news_articles")
        .select("id")
        .eq("slug", newSlug)
        .neq("id", id)
        .is("deleted_at", null)
        .maybeSingle()

      if (slugExisting) {
        newSlug = newSlug + "-" + Date.now()
      }

      updates.slug = newSlug
    }

    updates.editor_id = auth.user.id
    updates.updated_by = auth.user.id
    updates.updated_at = now()

    const { data: article, error } = await supabaseAdmin
      .from("news_articles")
      .update(updates)
      .eq("id", id)
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
