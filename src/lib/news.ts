import { I } from "./ui"

export type News = {
  slug: string
  title: string
  cat: string
  desc: string
  date: string
  views: string
  seed: string
  top?: boolean
  author?: string
  body: string[]
}

export const cats = [
  { key: "all", label: "Barcha yangiliklar", icon: I.grid, count: 0 },
  { key: "texnologiya", label: "Agro texnologiya", icon: I.cpu, count: 0 },
  { key: "qishloq", label: "Qishloq xo'jaligi", icon: I.sprout, count: 0 },
  { key: "bozor", label: "Bozor va iqtisodiyot", icon: I.chart, count: 0 },
  { key: "davlat", label: "Davlat dasturlari", icon: I.doc, count: 0 },
  { key: "innovatsiya", label: "Innovatsiya", icon: I.bolt, count: 0 },
  { key: "ekologiya", label: "Ekologiya", icon: I.leaf, count: 0 },
  { key: "tadqiqotlar", label: "Tadqiqotlar", icon: I.flask, count: 0 },
  { key: "xalqaro", label: "Xalqaro yangiliklar", icon: I.globe, count: 0 },
]
export const newsCatLabel = (k: string) => cats.find((c) => c.key === k)?.label ?? k

export const themes = ["Barchasi", "Sug'orish", "Texnika", "Eksport", "Subsidiya", "Iqlim"]
export const dates = ["Barchasi", "Bugun", "Bu hafta", "Bu oy", "Bu yil"]
export const newsImg = (seed: string, w = 640, h = 400) => {
  if (!seed) return `https://picsum.photos/seed/agro-default/${w}/${h}`
  if (seed.startsWith("http")) return seed
  return `https://picsum.photos/seed/${seed}/${w}/${h}`
}

/* Live API loaders — empty fallbacks when API is unavailable */
import { api } from "./api"

export type NewsListResponse = {
  news: News[]
  pagination: { page: number; per_page: number; total: number; total_pages: number }
  categories: { key: string; label: string; icon: string; count: number }[]
}

export async function loadNews(params?: {
  category?: string
  search?: string
  page?: number
  per_page?: number
}): Promise<NewsListResponse> {
  try {
    const q = new URLSearchParams()
    if (params?.category && params.category !== "all") q.set("category", params.category)
    if (params?.search) q.set("search", params.search)
    if (params?.page) q.set("page", String(params.page))
    if (params?.per_page) q.set("per_page", String(params.per_page))
    const qs = q.toString()
    return await api<NewsListResponse>(`/public/news${qs ? `?${qs}` : ""}`)
  } catch {
    return {
      news: [],
      pagination: { page: 1, per_page: 12, total: 0, total_pages: 0 },
      categories: cats,
    }
  }
}

export async function loadNewsDetail(slug: string): Promise<News | null> {
  try {
    const d = await api<{ article: News }>(`/public/news/${slug}`)
    return d.article
  } catch {
    return null
  }
}

export async function loadRelatedNews(slug: string): Promise<News[]> {
  try {
    const d = await api<{ news: News[] }>(`/public/news/${slug}/related`)
    return d.news
  } catch {
    return []
  }
}

export async function loadPopularNews(): Promise<{ title: string; date: string; views: string; seed: string; slug: string }[]> {
  try {
    const d = await api<{ popular: { title: string; date: string; views: string; seed: string; slug: string }[] }>("/public/news/popular")
    return d.popular
  } catch {
    return []
  }
}
