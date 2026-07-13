import { I } from "./ui"

export type Blogger = {
  slug: string
  name: string
  cat: string
  tag: string
  subs: string
  subsNum: number
  views: string
  viewsNum: number
  eng: string
  rating: number
  region: string
  seed: string
  top?: boolean
  avatar?: string
  cover?: string
}

export const categories = [
  { key: "all", label: "Barchasi", icon: I.grid },
  { key: "fermerlik", label: "Fermerlik", icon: I.sprout },
  { key: "issiqxona", label: "Issiqxona", icon: I.building },
  { key: "bogdorchilik", label: "Bog'dorchilik", icon: I.tree },
  { key: "chorvachilik", label: "Chorvachilik", icon: I.cow },
  { key: "texnologiya", label: "Agro texnologiya", icon: I.cpu },
  { key: "ekologik", label: "Ekologik dehqonchilik", icon: I.shield },
  { key: "biznes", label: "Agro biznes", icon: I.briefcase },
  { key: "boshqalar", label: "Boshqalar", icon: I.dots },
]
export const catLabel = (k: string) => categories.find((c) => c.key === k)?.label ?? k

export const bloggers: Blogger[] = [
  { slug: "elyor", name: "Fermer Elyor", cat: "issiqxona", tag: "Issiqxona • Fermerlik", subs: "1.2M+", subsNum: 1200000, views: "5M+", viewsNum: 5000000, eng: "8.7%", rating: 4.9, region: "Toshkent viloyati", seed: "elyor", top: true },
  { slug: "aziz", name: "Bog'bon Aziz", cat: "bogdorchilik", tag: "Bog'dorchilik", subs: "820K+", subsNum: 820000, views: "3M+", viewsNum: 3000000, eng: "7.2%", rating: 4.8, region: "Namangan viloyati", seed: "aziz" },
  { slug: "chorva", name: "Chorva House", cat: "chorvachilik", tag: "Chorvachilik", subs: "650K+", subsNum: 650000, views: "2M+", viewsNum: 2000000, eng: "6.1%", rating: 4.7, region: "Samarqand viloyati", seed: "chorva" },
  { slug: "agrotech", name: "Agro Tech UZ", cat: "texnologiya", tag: "Agro texnologiya", subs: "560K+", subsNum: 560000, views: "1.8M+", viewsNum: 1800000, eng: "9.3%", rating: 4.9, region: "Toshkent shahri", seed: "agrotech" },
  { slug: "ecofermer", name: "Eco Fermer", cat: "ekologik", tag: "Ekologik dehqonchilik", subs: "480K+", subsNum: 480000, views: "1.5M+", viewsNum: 1500000, eng: "7.8%", rating: 4.6, region: "Farg'ona viloyati", seed: "ecofermer" },
  { slug: "agrobiznes", name: "Agro Biznes", cat: "biznes", tag: "Agro biznes", subs: "430K+", subsNum: 430000, views: "1.2M+", viewsNum: 1200000, eng: "6.5%", rating: 4.5, region: "Buxoro viloyati", seed: "agrobiznes" },
  { slug: "issiqxona", name: "Issiqxona Pro", cat: "issiqxona", tag: "Issiqxona", subs: "390K+", subsNum: 390000, views: "900K+", viewsNum: 900000, eng: "7.0%", rating: 4.7, region: "Toshkent viloyati", seed: "issiqxona" },
  { slug: "dehqon", name: "Dehqon Bobo", cat: "fermerlik", tag: "Fermerlik", subs: "350K+", subsNum: 350000, views: "700K+", viewsNum: 700000, eng: "6.8%", rating: 4.6, region: "Andijon viloyati", seed: "dehqon" },
  { slug: "smartagro", name: "Smart Agro", cat: "texnologiya", tag: "Agro texnologiya", subs: "300K+", subsNum: 300000, views: "600K+", viewsNum: 600000, eng: "8.1%", rating: 4.8, region: "Toshkent shahri", seed: "smartagro" },
]

export const findBlogger = (slug?: string) => bloggers.find((b) => b.slug === slug) ?? bloggers[0]

export const regions = ["Barchasi", "Toshkent shahri", "Toshkent viloyati", "Namangan viloyati", "Samarqand viloyati", "Farg'ona viloyati", "Buxoro viloyati", "Andijon viloyati"]
export const sorts = ["Barchasi", "Reyting bo'yicha", "Obunachilar bo'yicha"]
export const platforms = ["Barchasi", "YouTube", "Instagram", "TikTok", "Telegram"]
export const cover = (seed: string) => `https://picsum.photos/seed/${seed}/640/420`

/* Live API loaders (fallback to mock data on error) */
import { api } from "./api"
import { supabase } from "./supabase"

export type BloggerListResponse = {
  bloggers: Blogger[]
  pagination: { page: number; per_page: number; total: number; total_pages: number }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K+`
  return `${n}+`
}

export async function loadTopBlogger(): Promise<Blogger | null> {
  try {
    // 1. Get top 20 bloggers by rating from DB (verified + active)
    const { data: bloggerRows } = await supabase
      .from("bloggers")
      .select(`
        id, slug, rating, is_featured, is_verified, cover,
        profiles!bloggers_id_fkey!inner(name, avatar, status),
        blogger_specializations(specialization_key),
        blogger_regions(region)
      `)
      .is("deleted_at", null)
      .eq("is_verified", true)
      .eq("profiles.status", "active")
      .order("rating", { ascending: false })
      .limit(20)

    if (!bloggerRows || bloggerRows.length === 0) {
      // Fallback to API
      const res = await api<BloggerListResponse>("/public/bloggers?per_page=10&sort=rating")
      const list = res.bloggers || []
      return list.sort((a, b) => b.subsNum - a.subsNum)[0] || null
    }

    // 2. Get subscriber + views counts from blogger_social_summary
    const ids = bloggerRows.map((b: Record<string, unknown>) => b.id as string)
    const { data: socialRows } = await supabase
      .from("blogger_social_summary")
      .select("blogger_id, total_subscribers, total_views, avg_engagement_rate")
      .in("blogger_id", ids)

    const socialMap: Record<string, { subs: number; views: number; eng: number }> = {}
    for (const s of (socialRows || []) as Array<Record<string, unknown>>) {
      socialMap[s.blogger_id as string] = {
        subs: Number(s.total_subscribers || 0),
        views: Number(s.total_views || 0),
        eng: Math.round(Number(s.avg_engagement_rate || 0) * 10) / 10,
      }
    }

    // 3. Map to Blogger type and pick the one with most subscribers
    const mapped: Blogger[] = (bloggerRows as Array<Record<string, unknown>>).map((b) => {
      const profile = b.profiles as Record<string, unknown> || {}
      const specs = (b.blogger_specializations as Array<Record<string, unknown>> || []).map(
        (s) => s.specialization_key as string,
      )
      const regions = (b.blogger_regions as Array<Record<string, unknown>> || []).map(
        (r) => r.region as string,
      )
      const social = socialMap[b.id as string] || { subs: 0, views: 0, eng: 0 }
      return {
        slug: b.slug as string,
        name: (profile.name as string) || "",
        cat: specs[0] || "",
        tag: specs.join(", ") || "",
        subs: formatCount(social.subs),
        subsNum: social.subs,
        views: formatCount(social.views),
        viewsNum: social.views,
        eng: `${social.eng.toFixed(1)}%`,
        rating: (b.rating as number) || 0,
        region: regions[0] || "",
        seed: b.slug as string,
        top: (b.is_featured as boolean) || false,
        avatar: (profile.avatar as string) || "",
        cover: (b.cover as string) || "",
      }
    })

    // Pick top by subscribers, then rating
    mapped.sort((a, b) => {
      if (b.subsNum !== a.subsNum) return b.subsNum - a.subsNum
      return b.rating - a.rating
    })
    return mapped[0] || null
  } catch {
    // Fallback to edge function
    try {
      const res = await api<BloggerListResponse>("/public/bloggers?per_page=10&sort=rating")
      const list = res.bloggers || []
      return list.sort((a, b) => b.subsNum - a.subsNum)[0] || null
    } catch {
      return null
    }
  }
}

export async function loadBloggers(params?: {
  category?: string
  region?: string
  search?: string
  sort?: string
  platform?: string
  page?: number
  per_page?: number
}): Promise<BloggerListResponse> {
  const perPage = params?.per_page || 12
  const page = params?.page || 1

  try {
    // Step 1: filter by category (specialization_key)
    let filteredIds: string[] | null = null
    if (params?.category && params.category !== "all") {
      const { data: specData } = await supabase
        .from("blogger_specializations")
        .select("blogger_id")
        .eq("specialization_key", params.category)
        .is("deleted_at", null)
      filteredIds = (specData || []).map((r: Record<string, unknown>) => r.blogger_id as string)
      if (filteredIds.length === 0) {
        return { bloggers: [], pagination: { page, per_page: perPage, total: 0, total_pages: 0 } }
      }
    }

    // Step 2: filter by region
    if (params?.region && params.region !== "Barchasi") {
      const { data: regData } = await supabase
        .from("blogger_regions")
        .select("blogger_id")
        .ilike("region", `%${params.region}%`)
        .is("deleted_at", null)
      const regionIds = (regData || []).map((r: Record<string, unknown>) => r.blogger_id as string)
      if (regionIds.length === 0) {
        return { bloggers: [], pagination: { page, per_page: perPage, total: 0, total_pages: 0 } }
      }
      filteredIds = filteredIds === null ? regionIds : filteredIds.filter((id) => regionIds.includes(id))
      if (filteredIds.length === 0) {
        return { bloggers: [], pagination: { page, per_page: perPage, total: 0, total_pages: 0 } }
      }
    }

    // Step 3: build base query
    type QueryType = ReturnType<typeof supabase.from>
    let query: QueryType = supabase
      .from("bloggers")
      .select(`
        id, slug, rating, is_featured, is_verified, cover,
        profiles!bloggers_id_fkey!inner(name, avatar, status),
        blogger_specializations(specialization_key),
        blogger_regions(region)
      `, { count: "exact" })
      .is("deleted_at", null)
      .eq("is_verified", true)
      .eq("profiles.status", "active")

    if (filteredIds !== null) query = query.in("id", filteredIds)
    if (params?.search) query = query.ilike("slug", `%${params.search}%`)
    query = query.order("rating", { ascending: false })

    const isSortBySubs = params?.sort === "Obunachilar bo'yicha"
    let data: Array<Record<string, unknown>> = []
    let total = 0

    if (isSortBySubs) {
      const { data: all, count } = await query.limit(500)
      data = (all || []) as Array<Record<string, unknown>>
      total = count || data.length
    } else {
      const from = (page - 1) * perPage
      const { data: rows, count } = await query.range(from, from + perPage - 1)
      data = (rows || []) as Array<Record<string, unknown>>
      total = count || 0
    }

    // Step 4: enrich with social data
    const ids = data.map((b) => b.id as string)
    const { data: socialRows } = ids.length > 0
      ? await supabase
          .from("blogger_social_summary")
          .select("blogger_id, total_subscribers, total_views, avg_engagement_rate")
          .in("blogger_id", ids)
      : { data: [] }

    const socialMap: Record<string, { subs: number; views: number; eng: number }> = {}
    for (const s of (socialRows || []) as Array<Record<string, unknown>>) {
      socialMap[s.blogger_id as string] = {
        subs: Number(s.total_subscribers || 0),
        views: Number(s.total_views || 0),
        eng: Math.round(Number(s.avg_engagement_rate || 0) * 10) / 10,
      }
    }

    // Step 5: map to Blogger
    let mapped: Blogger[] = data.map((b) => {
      const profile = (b.profiles as Record<string, unknown>) || {}
      const specs = (b.blogger_specializations as Array<Record<string, unknown>> || []).map(
        (s) => s.specialization_key as string,
      )
      const regs = (b.blogger_regions as Array<Record<string, unknown>> || []).map(
        (r) => r.region as string,
      )
      const social = socialMap[b.id as string] || { subs: 0, views: 0, eng: 0 }
      return {
        slug: b.slug as string,
        name: (profile.name as string) || "",
        cat: specs[0] || "",
        tag: specs.join(", ") || "",
        subs: formatCount(social.subs),
        subsNum: social.subs,
        views: formatCount(social.views),
        viewsNum: social.views,
        eng: `${social.eng.toFixed(1)}%`,
        rating: (b.rating as number) || 0,
        region: regs[0] || "",
        seed: b.slug as string,
        top: (b.is_featured as boolean) || false,
        avatar: (profile.avatar as string) || "",
        cover: (b.cover as string) || "",
      }
    })

    // Step 6: sort if needed
    if (params?.sort === "Reyting bo'yicha") mapped.sort((a, b) => b.rating - a.rating)
    else if (isSortBySubs) mapped.sort((a, b) => b.subsNum - a.subsNum)

    if (isSortBySubs) {
      const from = (page - 1) * perPage
      mapped = mapped.slice(from, from + perPage)
    }

    return { bloggers: mapped, pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) } }
  } catch (err) {
    console.error("loadBloggers error:", err)
    // fallback to mock data
    let r = [...bloggers]
    if (params?.category && params.category !== "all") r = r.filter((b) => b.cat === params.category)
    if (params?.region && params.region !== "Barchasi") r = r.filter((b) => b.region === params.region)
    if (params?.search) { const s = params.search.toLowerCase(); r = r.filter((b) => b.name.toLowerCase().includes(s) || b.tag.toLowerCase().includes(s)) }
    if (params?.sort === "Reyting bo'yicha") r.sort((a, b) => b.rating - a.rating)
    if (params?.sort === "Obunachilar bo'yicha") r.sort((a, b) => b.subsNum - a.subsNum)
    const total = r.length
    const from = (page - 1) * perPage
    const sliced = r.slice(from, from + perPage)
    return { bloggers: sliced, pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) } }
  }
}

