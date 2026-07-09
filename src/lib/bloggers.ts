import { I } from "./ui"

export type Blogger = {
  slug: string
  name: string
  cat: string
  tag: string
  subs: string
  subsNum: number
  eng: string
  rating: number
  region: string
  seed: string
  top?: boolean
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
  { slug: "elyor", name: "Fermer Elyor", cat: "issiqxona", tag: "Issiqxona • Fermerlik", subs: "1.2M+", subsNum: 1200000, eng: "8.7%", rating: 4.9, region: "Toshkent viloyati", seed: "elyor", top: true },
  { slug: "aziz", name: "Bog'bon Aziz", cat: "bogdorchilik", tag: "Bog'dorchilik", subs: "820K+", subsNum: 820000, eng: "7.2%", rating: 4.8, region: "Namangan viloyati", seed: "aziz" },
  { slug: "chorva", name: "Chorva House", cat: "chorvachilik", tag: "Chorvachilik", subs: "650K+", subsNum: 650000, eng: "6.1%", rating: 4.7, region: "Samarqand viloyati", seed: "chorva" },
  { slug: "agrotech", name: "Agro Tech UZ", cat: "texnologiya", tag: "Agro texnologiya", subs: "560K+", subsNum: 560000, eng: "9.3%", rating: 4.9, region: "Toshkent shahri", seed: "agrotech" },
  { slug: "ecofermer", name: "Eco Fermer", cat: "ekologik", tag: "Ekologik dehqonchilik", subs: "480K+", subsNum: 480000, eng: "7.8%", rating: 4.6, region: "Farg'ona viloyati", seed: "ecofermer" },
  { slug: "agrobiznes", name: "Agro Biznes", cat: "biznes", tag: "Agro biznes", subs: "430K+", subsNum: 430000, eng: "6.5%", rating: 4.5, region: "Buxoro viloyati", seed: "agrobiznes" },
  { slug: "issiqxona", name: "Issiqxona Pro", cat: "issiqxona", tag: "Issiqxona", subs: "390K+", subsNum: 390000, eng: "7.0%", rating: 4.7, region: "Toshkent viloyati", seed: "issiqxona" },
  { slug: "dehqon", name: "Dehqon Bobo", cat: "fermerlik", tag: "Fermerlik", subs: "350K+", subsNum: 350000, eng: "6.8%", rating: 4.6, region: "Andijon viloyati", seed: "dehqon" },
  { slug: "smartagro", name: "Smart Agro", cat: "texnologiya", tag: "Agro texnologiya", subs: "300K+", subsNum: 300000, eng: "8.1%", rating: 4.8, region: "Toshkent shahri", seed: "smartagro" },
]

export const findBlogger = (slug?: string) => bloggers.find((b) => b.slug === slug) ?? bloggers[0]

export const regions = ["Barchasi", "Toshkent shahri", "Toshkent viloyati", "Namangan viloyati", "Samarqand viloyati", "Farg'ona viloyati", "Buxoro viloyati", "Andijon viloyati"]
export const sorts = ["Barchasi", "Reyting bo'yicha", "Obunachilar bo'yicha"]
export const platforms = ["Barchasi", "YouTube", "Instagram", "TikTok", "Telegram"]
export const cover = (seed: string) => `https://picsum.photos/seed/${seed}/640/420`

/* Live API loaders (fallback to mock data on error) */
import { api } from "./api"

export type BloggerListResponse = {
  bloggers: Blogger[]
  pagination: { page: number; per_page: number; total: number; total_pages: number }
}

export async function loadBloggers(params?: {
  category?: string
  region?: string
  search?: string
  sort?: string
  page?: number
  per_page?: number
}): Promise<BloggerListResponse> {
  try {
    const q = new URLSearchParams()
    if (params?.category && params.category !== "all") q.set("category", params.category)
    if (params?.region && params.region !== "Barchasi") q.set("region", params.region)
    if (params?.search) q.set("search", params.search)
    if (params?.sort && params.sort !== "Barchasi") q.set("sort", params.sort === "Obunachilar bo'yicha" ? "subscribers" : "rating")
    if (params?.page) q.set("page", String(params.page))
    if (params?.per_page) q.set("per_page", String(params.per_page))
    const qs = q.toString()
    return await api<BloggerListResponse>(`/public/bloggers${qs ? `?${qs}` : ""}`)
  } catch {
    // fallback: apply filters to mock data
    let r = [...bloggers]
    if (params?.category && params.category !== "all") r = r.filter((b) => b.cat === params.category)
    if (params?.region && params.region !== "Barchasi") r = r.filter((b) => b.region === params.region)
    if (params?.search) { const s = params.search.toLowerCase(); r = r.filter((b) => b.name.toLowerCase().includes(s) || b.tag.toLowerCase().includes(s)) }
    if (params?.sort === "Reyting bo'yicha") r.sort((a, b) => b.rating - a.rating)
    if (params?.sort === "Obunachilar bo'yicha") r.sort((a, b) => b.subsNum - a.subsNum)
    const perPage = params?.per_page || 12
    const page = params?.page || 1
    const total = r.length
    const from = (page - 1) * perPage
    const sliced = r.slice(from, from + perPage)
    return { bloggers: sliced, pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) } }
  }
}
