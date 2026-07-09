import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { parsePaginationParams } from "../_shared/validation.ts"

const CACHE_TTL = 120

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const { page, per_page } = parsePaginationParams(url)
    const category = url.searchParams.get("category") || ""
    const region = url.searchParams.get("region") || ""
    const search = url.searchParams.get("search") || ""
    const sort = url.searchParams.get("sort") || "rating"

    // Step 1: resolve category + region filters (safe param queries)
    let filteredIds: string[] | null = null

    if (category) {
      const { data: ids } = await supabaseAdmin
        .from("blogger_specializations")
        .select("blogger_id")
        .eq("specialization_key", category)
        .is("deleted_at", null)
      filteredIds = (ids || []).map((r: { blogger_id: string }) => r.blogger_id)
      if (filteredIds.length === 0) {
        return cachedJsonResponse({
          bloggers: [],
          pagination: { page, per_page, total: 0, total_pages: 0 },
        }, CACHE_TTL)
      }
    }

    if (region && region !== "Barchasi") {
      const { data: ids } = await supabaseAdmin
        .from("blogger_regions")
        .select("blogger_id")
        .ilike("region", `%${region}%`)
        .is("deleted_at", null)
      const regionIds = (ids || []).map((r: { blogger_id: string }) => r.blogger_id)
      if (regionIds.length === 0) {
        return cachedJsonResponse({
          bloggers: [],
          pagination: { page, per_page, total: 0, total_pages: 0 },
        }, CACHE_TTL)
      }
      filteredIds = filteredIds === null
        ? regionIds
        : filteredIds.filter((id) => regionIds.includes(id))
      if (filteredIds.length === 0) {
        return cachedJsonResponse({
          bloggers: [],
          pagination: { page, per_page, total: 0, total_pages: 0 },
        }, CACHE_TTL)
      }
    }

    // Step 2: build base query
    let query = supabaseAdmin
      .from("bloggers")
      .select(`
        id,
        slug,
        rating,
        is_featured,
        is_verified,
        profiles!bloggers_id_fkey!inner(name, avatar),
        blogger_specializations(specialization_key),
        blogger_regions(region)
      `, { count: "exact" })
      .is("deleted_at", null)
      .eq("profiles.status", "active")
      .is("profiles.deleted_at", null)
      .eq("is_verified", true)

    if (filteredIds !== null) {
      query = query.in("id", filteredIds)
    }

    if (search) {
      const s = search.replace(/'/g, "''")
      query = query.or(`slug.ilike.%${s}%`)
    }

    query = query.order("rating", { ascending: false })

    const from = (page - 1) * per_page
    const to = from + per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) return errorResponse(error.message, 500)

    // Step 4: fetch subscriber counts for returned bloggers
    const bloggerIds = (data || []).map((b: Record<string, unknown>) => b.id as string)
    const subsMap = await getSubscriberCounts(bloggerIds)
    const avgEngagement = await getAvgEngagement(bloggerIds)

    // Step 5: build response
    const bloggers = (data || []).map((b: Record<string, unknown>) => {
      const profile = b.profiles as Record<string, unknown> || {}
      const specializations = (b.blogger_specializations as Array<Record<string, unknown>> || []).map(
        (s: Record<string, unknown>) => s.specialization_key,
      )
      const regions = (b.blogger_regions as Array<Record<string, unknown>> || []).map(
        (r: Record<string, unknown>) => r.region,
      )
      const totalSubs = subsMap[b.id as string] || 0
      const engagement = avgEngagement[b.id as string] || 0

      return {
        slug: b.slug,
        name: profile.name || "",
        cat: specializations[0] || "",
        tag: specializations.join(", ") || "",
        subs: formatCount(totalSubs),
        subsNum: totalSubs,
        eng: `${engagement.toFixed(1)}%`,
        rating: b.rating || 0,
        region: regions[0] || "",
        seed: b.slug as string,
        top: b.is_featured || false,
      }
    })

    return cachedJsonResponse({
      bloggers,
      pagination: {
        page,
        per_page,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / per_page),
      },
    }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})

async function getSubscriberCounts(bloggerIds: string[]): Promise<Record<string, number>> {
  if (bloggerIds.length === 0) return {}
  const { data } = await supabaseAdmin
    .from("blogger_social_summary")
    .select("blogger_id, total_subscribers")
    .in("blogger_id", bloggerIds)

  const map: Record<string, number> = {}
  for (const row of (data || []) as Array<{ blogger_id: string; total_subscribers: number }>) {
    map[row.blogger_id] = row.total_subscribers || 0
  }
  return map
}

async function getAvgEngagement(bloggerIds: string[]): Promise<Record<string, number>> {
  if (bloggerIds.length === 0) return {}
  const { data } = await supabaseAdmin
    .from("blogger_social_summary")
    .select("blogger_id, avg_engagement_rate")
    .in("blogger_id", bloggerIds)

  const map: Record<string, number> = {}
  for (const row of (data || []) as Array<{ blogger_id: string; avg_engagement_rate: number }>) {
    map[row.blogger_id] = Math.round((row.avg_engagement_rate || 0) * 10) / 10
  }
  return map
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K+`
  return `${n}+`
}
