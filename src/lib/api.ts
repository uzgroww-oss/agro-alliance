const TOKEN_KEY = "aa_token"

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ""
const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : "http://localhost:3001/api")
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

const PUBLIC_ROUTES: Record<string, string> = {
  "/public/stats": "public-stats",
  "/public/bloggers": "public-bloggers-list",
  "/public/news": "public-news-list",
  "/public/partners": "public-partners",
  "/public/categories": "public-categories",
  "/public/news/popular": "public-news-popular",
}

function resolvePublicUrl(path: string): string {
  const idx = path.indexOf("?")
  const basePath = idx === -1 ? path : path.substring(0, idx)
  const qsRaw = idx === -1 ? "" : path.substring(idx + 1)

  const fn = PUBLIC_ROUTES[basePath]
  if (fn) return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`

  const detailMatch = basePath.match(/^\/public\/news\/([^/]+)$/)
  if (detailMatch) {
    const qs = new URLSearchParams(qsRaw)
    qs.set("slug", detailMatch[1])
    return `${SUPABASE_FUNCTIONS_URL}/public-news-detail?${qs.toString()}`
  }

  const relatedMatch = basePath.match(/^\/public\/news\/([^/]+)\/related$/)
  if (relatedMatch) {
    const qs = new URLSearchParams(qsRaw)
    qs.set("slug", relatedMatch[1])
    return `${SUPABASE_FUNCTIONS_URL}/public-news-related?${qs.toString()}`
  }

  const fnName = basePath.replace(/^\/public\//, "public-").replace(/\//g, "-")
  return `${SUPABASE_FUNCTIONS_URL}/${fnName}${qsRaw ? `?${qsRaw}` : ""}`
}

function resolveAdminUrl(path: string, method: string): string {
  const idx = path.indexOf("?")
  const basePath = idx === -1 ? path : path.substring(0, idx)
  const qsRaw = idx === -1 ? "" : path.substring(idx + 1)
  const segments = basePath.split("/").filter(Boolean)

  if (segments[0] === "stats") {
    const fn = method === "PUT" ? "admin-stats-update" : "admin-stats-get"
    return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
  }

  if (segments[0] === "bloggers") {
    if (segments.length === 1) {
      const fn = method === "POST" ? "admin-bloggers-create" : "admin-bloggers-list"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
    }
    if (segments.length === 3 && segments[2] === "status") {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      return `${SUPABASE_FUNCTIONS_URL}/admin-bloggers-status?${qs.toString()}`
    }
    if (segments.length === 2) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      return `${SUPABASE_FUNCTIONS_URL}/admin-bloggers-delete?${qs.toString()}`
    }
  }

  if (segments[0] === "partners") {
    if (segments.length === 1) {
      const fn = method === "POST" ? "admin-partners-create" : "admin-partners-list"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
    }
    if (segments.length === 4 && segments[2] === "tasks") {
      const qs = new URLSearchParams(qsRaw)
      qs.set("pid", segments[1])
      qs.set("tid", segments[3])
      const fn = method === "DELETE" ? "admin-partners-tasks-delete" : "admin-partners-tasks-cycle"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}?${qs.toString()}`
    }
    if (segments.length === 3 && segments[2] === "tasks") {
      const qs = new URLSearchParams(qsRaw)
      qs.set("pid", segments[1])
      return `${SUPABASE_FUNCTIONS_URL}/admin-partners-tasks-add?${qs.toString()}`
    }
    if (segments.length === 3 && segments[2] === "client") {
      const qs = new URLSearchParams(qsRaw)
      qs.set("pid", segments[1])
      const fn = method === "DELETE" ? "admin-partners-client-delete" : "admin-partners-client-create"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}?${qs.toString()}`
    }
    if (segments.length === 2) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      return `${SUPABASE_FUNCTIONS_URL}/admin-partners-delete?${qs.toString()}`
    }
  }

  if (segments[0] === "me") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/auth-me${qsRaw ? `?${qsRaw}` : ""}`

    const resource = segments[1]

    // Profile
    if (resource === "profile") {
      return `${SUPABASE_FUNCTIONS_URL}/me-profile-update${qsRaw ? `?${qsRaw}` : ""}`
    }

    // Socials: POST /me/socials (add), DELETE /me/socials/{id} (delete)
    if (resource === "socials") {
      if (segments.length === 2) return `${SUPABASE_FUNCTIONS_URL}/me-socials-add${qsRaw ? `?${qsRaw}` : ""}`
      if (segments.length === 3) {
        const qs = new URLSearchParams(qsRaw)
        qs.set("id", segments[2])
        return `${SUPABASE_FUNCTIONS_URL}/me-socials-delete?${qs.toString()}`
      }
    }

    // Videos: POST /me/videos (add), DELETE /me/videos/{id} (delete)
    if (resource === "videos") {
      if (segments.length === 2) return `${SUPABASE_FUNCTIONS_URL}/me-videos-add${qsRaw ? `?${qsRaw}` : ""}`
      if (segments.length === 3) {
        const qs = new URLSearchParams(qsRaw)
        qs.set("id", segments[2])
        return `${SUPABASE_FUNCTIONS_URL}/me-videos-delete?${qs.toString()}`
      }
    }

    // Services: GET /me/services, POST /me/services, PUT/DELETE /me/services/{id}
    if (resource === "services") {
      if (segments.length === 2) {
        const fn = method === "POST" ? "me-services-add" : "me-services-list"
        return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
      }
      if (segments.length === 3) {
        const qs = new URLSearchParams(qsRaw)
        qs.set("id", segments[2])
        const fn = method === "DELETE" ? "me-services-delete" : "me-services-update"
        return `${SUPABASE_FUNCTIONS_URL}/${fn}?${qs.toString()}`
      }
    }

    // Achievements: GET /me/achievements, POST /me/achievements, PUT/DELETE /me/achievements/{id}
    if (resource === "achievements") {
      if (segments.length === 2) {
        const fn = method === "POST" ? "me-achievements-add" : "me-achievements-list"
        return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
      }
      if (segments.length === 3) {
        const qs = new URLSearchParams(qsRaw)
        qs.set("id", segments[2])
        const fn = method === "DELETE" ? "me-achievements-delete" : "me-achievements-update"
        return `${SUPABASE_FUNCTIONS_URL}/${fn}?${qs.toString()}`
      }
    }

    // Regions: GET /me/regions, POST /me/regions, DELETE /me/regions/{id}
    if (resource === "regions") {
      if (segments.length === 2) {
        const fn = method === "POST" ? "me-regions-add" : "me-regions-list"
        return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
      }
      if (segments.length === 3) {
        const qs = new URLSearchParams(qsRaw)
        qs.set("id", segments[2])
        return `${SUPABASE_FUNCTIONS_URL}/me-regions-delete?${qs.toString()}`
      }
    }

    // Specializations: GET /me/specializations, POST /me/specializations, DELETE /me/specializations/{id}
    if (resource === "specializations") {
      if (segments.length === 2) {
        const fn = method === "POST" ? "me-specializations-add" : "me-specializations-list"
        return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
      }
      if (segments.length === 3) {
        const qs = new URLSearchParams(qsRaw)
        qs.set("id", segments[2])
        return `${SUPABASE_FUNCTIONS_URL}/me-specializations-delete?${qs.toString()}`
      }
    }

    // Availability (single resource)
    if (resource === "availability") {
      const fn = method === "PUT" || method === "PATCH" ? "me-availability-update" : "me-availability-get"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
    }

    // Partner
    if (resource === "partner") return `${SUPABASE_FUNCTIONS_URL}/me-partner${qsRaw ? `?${qsRaw}` : ""}`

    // Analytics
    if (resource === "analytics") return `${SUPABASE_FUNCTIONS_URL}/me-analytics${qsRaw ? `?${qsRaw}` : ""}`

    // Notifications
    if (resource === "notifications") return `${SUPABASE_FUNCTIONS_URL}/me-notifications-list${qsRaw ? `?${qsRaw}` : ""}`

    // Settings
    if (resource === "settings") {
      const fn = method === "PUT" || method === "PATCH" ? "me-settings-update" : "me-settings-get"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
    }

    // Fallback
    return `${SUPABASE_FUNCTIONS_URL}/auth-me${qsRaw ? `?${qsRaw}` : ""}`
  }

  if (segments[0] === "client") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/client-statistics${qsRaw ? `?${qsRaw}` : ""}`

    const resource = segments[1]

    // Tasks (POST creates via client-tasks-add; GET falls through to statistics)
    if (resource === "tasks") {
      if (segments.length === 2 && method === "POST") {
        return `${SUPABASE_FUNCTIONS_URL}/client-tasks-add${qsRaw ? `?${qsRaw}` : ""}`
      }
      if (segments.length === 3) {
        const qs = new URLSearchParams(qsRaw)
        qs.set("id", segments[2])
        const fn = method === "DELETE" ? "client-tasks-delete" : "client-tasks-update"
        return `${SUPABASE_FUNCTIONS_URL}/${fn}?${qs.toString()}`
      }
    }

    // Partner profile update
    if (resource === "partner") {
      return `${SUPABASE_FUNCTIONS_URL}/client-partner-update${qsRaw ? `?${qsRaw}` : ""}`
    }

    // Statistics
    if (resource === "statistics") {
      return `${SUPABASE_FUNCTIONS_URL}/client-statistics${qsRaw ? `?${qsRaw}` : ""}`
    }

    // Notifications
    if (resource === "notifications") {
      return `${SUPABASE_FUNCTIONS_URL}/client-notifications-list${qsRaw ? `?${qsRaw}` : ""}`
    }

    // Settings
    if (resource === "settings") {
      const fn = method === "PUT" || method === "PATCH" ? "client-settings-update" : "client-settings-get"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
    }

    // Fallback
    return `${SUPABASE_FUNCTIONS_URL}/client-statistics${qsRaw ? `?${qsRaw}` : ""}`
  }

  if (segments[0] === "news") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/admin-news-list${qsRaw ? `?${qsRaw}` : ""}`
    if (segments.length === 2) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      const fn = method === "DELETE" ? "admin-news-delete" : method === "PATCH" || method === "PUT" ? "admin-news-update" : "admin-news-detail"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}?${qs.toString()}`
    }
  }

  if (segments[0] === "categories") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/admin-categories-list${qsRaw ? `?${qsRaw}` : ""}`
    if (segments.length === 2) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      const fn = method === "DELETE" ? "admin-categories-delete" : method === "PATCH" || method === "PUT" ? "admin-categories-update" : "admin-categories-list"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}?${qs.toString()}`
    }
  }

  if (segments[0] === "settings") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/admin-settings-list${qsRaw ? `?${qsRaw}` : ""}`
    if (segments.length === 2) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      return `${SUPABASE_FUNCTIONS_URL}/admin-settings-update?${qs.toString()}`
    }
  }

  if (segments[0] === "messages") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/admin-contacts-list${qsRaw ? `?${qsRaw}` : ""}`
    if (segments.length === 2) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      const fn = method === "DELETE" ? "admin-contacts-delete" : "admin-contacts-read"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}?${qs.toString()}`
    }
  }

  if (segments[0] === "subscribers") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/admin-subscribers-list${qsRaw ? `?${qsRaw}` : ""}`
    if (segments.length === 2) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      return `${SUPABASE_FUNCTIONS_URL}/admin-subscribers-delete?${qs.toString()}`
    }
  }

  if (segments[0] === "users") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/admin-users-list${qsRaw ? `?${qsRaw}` : ""}`
    if (segments.length === 2) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      return `${SUPABASE_FUNCTIONS_URL}/admin-users-status?${qs.toString()}`
    }
  }

  if (segments[0] === "homepage") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/admin-homepage-get${qsRaw ? `?${qsRaw}` : ""}`
    if (segments[0] === "homepage" && segments[1] === "sections" && segments.length === 3) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[2])
      return `${SUPABASE_FUNCTIONS_URL}/admin-homepage-section-update?${qs.toString()}`
    }
    if (segments[0] === "homepage" && segments[1] === "items" && segments.length === 3) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[2])
      return `${SUPABASE_FUNCTIONS_URL}/admin-homepage-item-update?${qs.toString()}`
    }
  }

  const fnName = basePath.replace(/^\//, "admin-").replace(/\//g, "-")
  return `${SUPABASE_FUNCTIONS_URL}/${fnName}${qsRaw ? `?${qsRaw}` : ""}`
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const isPublic = path.startsWith("/public/")
  const method = opts.method || "GET"
  const isAdmin = !isPublic && token !== null
  const url = isPublic ? resolvePublicUrl(path) : isAdmin ? resolveAdminUrl(path, method) : `/api${path}`

  const h = new Headers(opts.headers)
  h.set("Content-Type", "application/json")
  if (token) h.set("Authorization", `Bearer ${token}`)
  if (isPublic) h.set("apikey", SUPABASE_ANON_KEY)

  const res = await fetch(url, { ...opts, headers: h })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any)?.error || "Xatolik yuz berdi")
  return data as T
}

export type User = {
  id: string
  name: string
  email: string
  role: "superadmin" | "blogger" | "client"
  partnerId: string | null
  status?: string
  profile?: Record<string, string>
  socials?: { id: string; platform: string; link: string; connected: boolean; name?: string; avatar?: string; subscribers?: string }[]
  videos?: { id: string; name: string; link: string; views: string; plats: string[]; date: string; status: string; thumbnail?: string; author?: string }[]
}
