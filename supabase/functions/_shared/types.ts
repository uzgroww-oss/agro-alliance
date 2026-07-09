export interface PaginationParams {
  page: number
  per_page: number
}

export interface PaginationMeta {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export interface SiteStat {
  key: string
  value: string
  label: string
}

export interface BloggerProfile {
  slug: string
  name: string
  email: string
  niche: string
  tag: string
  region: string
  photo: string | null
  cover: string | null
  bio: string | null
  tags: string[]
  rating: number
  top: boolean
  created_at: string
}

export interface SocialAccount {
  id: number
  platform: string
  link: string
  name: string | null
  avatar: string | null
  subscribers: string | null
  connected: boolean
}

export interface Video {
  id: number
  name: string
  link: string
  views: string
  thumbnail: string | null
  platforms: string[]
  date: string
  duration: string | null
}

export interface Partner {
  id: number
  name: string
  sphere: string
  contract_no: string
  amount: number
  signed_date: string
  status: "active" | "pending" | "completed"
  tasks: Task[]
  client: { id: number; name: string; email: string } | null
}

export interface Task {
  id: number
  title: string
  status: "pending" | "progress" | "done"
}

export interface NewsArticle {
  slug: string
  title: string
  category: string
  description: string
  body: string[]
  image: string | null
  date: string
  views: string
  author: string
  tags: string[]
  is_featured: boolean
  created_at: string
}

export interface Category {
  key: string
  label: string
  count: number
}
