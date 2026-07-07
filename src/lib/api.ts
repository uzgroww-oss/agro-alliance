const TOKEN_KEY = "aa_token"

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any)?.error || "Xatolik yuz berdi")
  return data as T
}

export type User = {
  id: number
  name: string
  email: string
  role: "superadmin" | "blogger" | "client"
  partnerId?: number
  status?: string
  profile?: Record<string, string>
  socials?: { id: number; platform: string; link: string; connected: boolean; name?: string; avatar?: string; subscribers?: string }[]
  videos?: { id: number; name: string; link: string; views: string; plats: string[]; date: string; status: string; thumbnail?: string; author?: string }[]
}
