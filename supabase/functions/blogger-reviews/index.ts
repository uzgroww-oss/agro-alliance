import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

// blogger-reviews — bloger sharhlari (public)
//  GET  ?slug=<blogerslug>  → { reviews, avg, count }
//  POST { slug, author_name, rating(1-5), comment }  → sharh qo'shish

async function bloggerIdBySlug(slug: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("bloggers").select("id").eq("slug", slug).is("deleted_at", null).maybeSingle()
  return data?.id || null
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    if (req.method === "GET") {
      const url = new URL(req.url)
      const slug = url.searchParams.get("slug") || ""
      const bid = await bloggerIdBySlug(slug)
      if (!bid) return jsonResponse({ reviews: [], avg: 0, count: 0 })
      const { data } = await supabaseAdmin
        .from("blogger_reviews")
        .select("id, author_name, rating, comment, created_at")
        .eq("blogger_id", bid).eq("is_approved", true).is("deleted_at", null)
        .order("created_at", { ascending: false }).limit(50)
      const reviews = data || []
      const avg = reviews.length ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0
      return jsonResponse({ reviews, avg: Math.round(avg * 10) / 10, count: reviews.length })
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const slug = (body.slug || "").trim()
      const author = (body.author_name || "").trim()
      const rating = Number(body.rating)
      const comment = (body.comment || "").trim()
      if (!slug || !author) return errorResponse("Ism va bloger kerak", 400)
      if (!(rating >= 1 && rating <= 5)) return errorResponse("Reyting 1-5 orasida bo'lishi kerak", 400)
      if (author.length > 120 || comment.length > 1000) return errorResponse("Matn juda uzun", 400)
      const bid = await bloggerIdBySlug(slug)
      if (!bid) return errorResponse("Bloger topilmadi", 404)
      const { error } = await supabaseAdmin.from("blogger_reviews").insert({
        blogger_id: bid, author_name: author, rating, comment: comment || null, is_approved: true,
      })
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    return errorResponse("Method not allowed", 405)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
