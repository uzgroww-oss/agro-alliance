import { supabaseAdmin } from "./supabase.ts"

export interface StatItem {
  key: string
  value: string
  label: string
}

function formatStatValue(count: number, key: string): string {
  if (key === "views") {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`
    if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K+`
    return String(count)
  }
  if (key === "contents" && count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K+`
  }
  if (key === "regions" && count > 0) {
    return `${count}+`
  }
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K+`
  return String(count)
}

export async function getDynamicStats(dbStats: StatItem[]): Promise<StatItem[]> {
  try {
    // 1. Bloggers Count — all non-deleted bloggers with active profiles
    // Use service_role which bypasses RLS automatically
    const { count: bloggerCount } = await supabaseAdmin
      .from("bloggers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)

    // 2. Views Count (sum of total_views from blogger_social_summary view)
    const { data: viewsData } = await supabaseAdmin
      .from("blogger_social_summary")
      .select("total_views")
    const viewsCount = (viewsData || []).reduce(
      (sum: number, item: Record<string, unknown>) => sum + Number(item.total_views || 0),
      0,
    )

    // 3. Partners Count
    const { count: partnerCount } = await supabaseAdmin
      .from("partners")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null)

    // 4. Regions Count (unique non-deleted regions)
    const { data: regionsData } = await supabaseAdmin
      .from("blogger_regions")
      .select("region")
      .is("deleted_at", null)
    const uniqueRegions = new Set(
      (regionsData || [])
        .map((r: Record<string, unknown>) => String(r.region || "").trim())
        .filter(Boolean),
    )
    const regionsCount = uniqueRegions.size

    // 5. Contents Count = published news + total videos
    const { count: newsCount } = await supabaseAdmin
      .from("news_articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null)

    const { data: videosData } = await supabaseAdmin
      .from("blogger_social_summary")
      .select("total_videos")
    const videosCount = (videosData || []).reduce(
      (sum: number, item: Record<string, unknown>) => sum + Number(item.total_videos || 0),
      0,
    )
    const contentsCount = (newsCount || 0) + videosCount

    console.log("Dynamic stats computed:", {
      bloggers: bloggerCount,
      views: viewsCount,
      partners: partnerCount,
      regions: regionsCount,
      contents: contentsCount,
    })

    const computedValues: Record<string, number> = {
      bloggers: bloggerCount || 0,
      views: viewsCount || 0,
      partners: partnerCount || 0,
      regions: regionsCount || 0,
      contents: contentsCount || 0,
    }

    return dbStats.map((item) => {
      const computed = computedValues[item.key]
      // Use computed value even if 0 (override static), only fallback if key unknown
      const finalValue =
        computed !== undefined
          ? computed > 0
            ? formatStatValue(computed, item.key)
            : item.value
          : item.value
      return {
        key: item.key,
        value: finalValue,
        label: item.label,
      }
    })
  } catch (e) {
    console.error("Error computing dynamic stats:", e)
    return dbStats
  }
}
