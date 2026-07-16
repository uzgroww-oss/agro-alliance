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

    // Step 2: If sorting by subscribers, get ordered IDs from blogger_social_summary
    let subscriberOrderedIds: string[] | null = null
    if (sort === "subscribers") {
      let subsQuery = supabaseAdmin
        .from("blogger_social_summary")
        .select("blogger_id, total_subscribers")
        .order("total_subscribers", { ascending: false })
      if (filteredIds !== null) {
        subsQuery = subsQuery.in("blogger_id", filteredIds)
      }
      const { data: subsData } = await subsQuery
      subscriberOrderedIds = (subsData || []).map(
        (r: { blogger_id: string }) => r.blogger_id,
      )
      // If no social data, fall back to all filteredIds
      if (subscriberOrderedIds.length === 0 && filteredIds !== null) {
        subscriberOrderedIds = filteredIds
      }
      // Update filteredIds to subscriber-sorted IDs
      if (subscriberOrderedIds.length > 0) {
        filteredIds = subscriberOrderedIds
      }
    }

    // Step 3: build base query
    let query = supabaseAdmin
      .from("bloggers")
      .select(`
        id,
        slug,
        rating,
        is_featured,
        is_verified,
        cover,
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

    // XAVFSIZLIK: PostgREST filtr metabelgilarini ( , . ( ) : * % " ' \ ) olib tashlash — filtr injeksiyasi oldini olish
    const s = search.replace(/^@/, "").replace(/[,.():*%"'\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
    if (s) {
      // Instagram/YouTube username yoki profil linki bo'yicha mos blogerlar
      const { data: socialMatches } = await supabaseAdmin
        .from("social_accounts")
        .select("blogger_id")
        .or(`account_name.ilike.%${s}%,profile_url.ilike.%${s}%`)
        .is("deleted_at", null)

      // Ism bo'yicha mos blogerlar (profiles alohida jadval bo'lgani uchun alohida so'rov)
      const { data: nameMatches } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("name", `%${s}%`)

      const matchedIds = new Set<string>([
        ...(socialMatches || []).map((r: { blogger_id: string }) => r.blogger_id),
        ...(nameMatches || []).map((r: { id: string }) => r.id),
      ])

      if (matchedIds.size > 0) {
        query = query.or(`slug.ilike.%${s}%,id.in.(${[...matchedIds].join(",")})`)
      } else {
        query = query.or(`slug.ilike.%${s}%`)
      }
    }

    // Sort order — rating by default, subscribers handled via ID ordering above
    if (sort !== "subscribers") {
      query = query.order("rating", { ascending: false })
    } else {
      // Keep the DB row order but we'll re-sort after fetch using subscriberOrderedIds
      query = query.order("rating", { ascending: false })
    }

    const from = (page - 1) * per_page
    const to = from + per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) return errorResponse(error.message, 500)

    // Step 4: fetch subscriber counts and views for returned bloggers
    const bloggerIds = (data || []).map((b: Record<string, unknown>) => b.id as string)
    const socialMap = await getSocialData(bloggerIds)

    // Step 5: Re-sort by subscribers if needed
    let rows = (data || []) as Array<Record<string, unknown>>
    if (sort === "subscribers" && subscriberOrderedIds && subscriberOrderedIds.length > 0) {
      const orderMap = new Map(subscriberOrderedIds.map((id, i) => [id, i]))
      rows = rows.sort((a, b) => (orderMap.get(a.id as string) ?? 999) - (orderMap.get(b.id as string) ?? 999))
    }

    // Step 6: build response
    const bloggers = rows.map((b: Record<string, unknown>) => {
      const profile = b.profiles as Record<string, unknown> || {}
      const specializations = (b.blogger_specializations as Array<Record<string, unknown>> || []).map(
        (s: Record<string, unknown>) => s.specialization_key,
      )
      const regions = (b.blogger_regions as Array<Record<string, unknown>> || []).map(
        (r: Record<string, unknown>) => r.region,
      )
      const social = socialMap[b.id as string] || {}
      const totalSubs = social.totalSubscribers || 0
      const totalViews = social.totalViews || 0
      const engagement = social.avgEngagement || 0

      return {
        slug: b.slug,
        name: profile.name || "",
        cat: specializations[0] || "",
        tag: specializations.join(", ") || "",
        subs: formatCount(totalSubs),
        subsNum: totalSubs,
        views: formatCount(totalViews),
        viewsNum: totalViews,
        eng: `${engagement.toFixed(1)}%`,
        rating: b.rating || 0,
        region: regions[0] || "",
        seed: b.slug as string,
        top: b.is_featured || false,
        avatar: profile.avatar as string || "",
        cover: (b as Record<string, unknown>).cover as string || "",
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

interface SocialData {
  totalSubscribers: number
  totalViews: number
  avgEngagement: number
}

async function getSocialData(bloggerIds: string[]): Promise<Record<string, SocialData>> {
  if (bloggerIds.length === 0) return {}
  const { data } = await supabaseAdmin
    .from("blogger_social_summary")
    .select("blogger_id, total_subscribers, total_views, avg_engagement_rate")
    .in("blogger_id", bloggerIds)

  const map: Record<string, SocialData> = {}
  for (const row of (data || []) as Array<{
    blogger_id: string
    total_subscribers: number
    total_views: number
    avg_engagement_rate: number
  }>) {
    map[row.blogger_id] = {
      totalSubscribers: row.total_subscribers || 0,
      totalViews: row.total_views || 0,
      avgEngagement: Math.round((row.avg_engagement_rate || 0) * 10) / 10,
    }
  }
  return map
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K+`
  return `${n}+`
}
