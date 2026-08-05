import { currentLang } from "./lang"
const TOKEN_KEY = "aa_token"
const REMEMBER_KEY = "aa_remember"

export const getRememberPref = (): boolean => localStorage.getItem(REMEMBER_KEY) !== "false"
export const setRememberPref = (v: boolean) => localStorage.setItem(REMEMBER_KEY, String(v))

export const getToken = (): string | null => {
  const t = localStorage.getItem(TOKEN_KEY)
  if (t) return t
  return sessionStorage.getItem(TOKEN_KEY)
}
export const setToken = (t: string) => {
  // Foydalanuvchi almashdi — oldingi hisobning keshlangan javoblari
  // ko'rinib qolmasin
  if (getToken() !== t) clearApiCache()
  if (getRememberPref()) {
    localStorage.setItem(TOKEN_KEY, t)
    sessionStorage.removeItem(TOKEN_KEY)
  } else {
    sessionStorage.setItem(TOKEN_KEY, t)
    localStorage.removeItem(TOKEN_KEY)
  }
}
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  clearApiCache()
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ""
// Zaxira manzil YO'Q: ilgari bu yerda localhost:3001 turardi va sozlama
// yetishmasa so'rovlar jimgina o'lik manzilga ketardi. Endi bo'sh qoladi
// va xato so'rov paytida aniq ko'rinadi.
const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : "")
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

const PUBLIC_ROUTES: Record<string, string> = {
  "/public/stats": "public-stats",
  "/public/bloggers": "public-bloggers-list",
  "/public/news": "public-news-list",
  "/public/partners": "public-partners",
  "/public/categories": "public-categories",
  "/public/news/popular": "public-news-popular",
  "/public/team": "public-team",
}

function resolvePublicUrl(path: string): string {
  const idx = path.indexOf("?")
  const basePath = idx === -1 ? path : path.substring(0, idx)
  const qsRaw = idx === -1 ? "" : path.substring(idx + 1)

  const fn = PUBLIC_ROUTES[basePath]
  if (fn) return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`

  const bloggerProfileMatch = basePath.match(/^\/public\/bloggers\/([^/]+)$/)
  if (bloggerProfileMatch) {
    const qs = new URLSearchParams(qsRaw)
    qs.set("slug", bloggerProfileMatch[1])
    return `${SUPABASE_FUNCTIONS_URL}/public-bloggers-profile?${qs.toString()}`
  }

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
    if (segments.length === 3 && segments[2] === "social") {
      const qs = new URLSearchParams(qsRaw)
      qs.set("blogger_id", segments[1])
      return `${SUPABASE_FUNCTIONS_URL}/admin-bloggers-social-add?${qs.toString()}`
    }
    if (segments.length === 3 && segments[2] === "status") {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      return `${SUPABASE_FUNCTIONS_URL}/admin-bloggers-status?${qs.toString()}`
    }
    if (segments.length === 2) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      const fn = method === "PATCH" ? "admin-bloggers-update" : "admin-bloggers-delete"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}?${qs.toString()}`
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
      const fn = method === "PATCH" ? "admin-partners-update" : "admin-partners-delete"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}?${qs.toString()}`
    }
  }

  if (segments[0] === "me") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/auth-me${qsRaw ? `?${qsRaw}` : ""}`

    const resource = segments[1]

    // Profile
    if (resource === "profile") {
      return `${SUPABASE_FUNCTIONS_URL}/me-profile-update${qsRaw ? `?${qsRaw}` : ""}`
    }

    // Socials: POST /me/socials (add), DELETE /me/socials/{id} (delete) — birlashtirilgan me-socials
    if (resource === "socials") {
      if (segments.length === 2) return `${SUPABASE_FUNCTIONS_URL}/me-socials${qsRaw ? `?${qsRaw}` : ""}`
      if (segments.length === 3) {
        const qs = new URLSearchParams(qsRaw)
        qs.set("id", segments[2])
        return `${SUPABASE_FUNCTIONS_URL}/me-socials?${qs.toString()}`
      }
    }

    // Videos: POST /me/videos (add), DELETE /me/videos/{id} (delete)
    if (resource === "videos") {
      if (segments.length === 2) return `${SUPABASE_FUNCTIONS_URL}/me-videos-add${qsRaw ? `?${qsRaw}` : ""}`
      if (segments.length === 3) {
        const qs = new URLSearchParams(qsRaw)
        qs.set("id", segments[2])
        return `${SUPABASE_FUNCTIONS_URL}/me-videos-add?${qs.toString()}`
      }
    }

    /**
     * Xizmatlar / Hududlar / Yo'nalishlar — hammasi `me-lists` da.
     *
     * ILGARI bu uchtasi 8 ta alohida funksiyaga yo'naltirilardi
     * (me-services-list, me-regions-add, ...), lekin ularning HECH BIRI
     * serverga deploy qilinmagan edi — natijada uchala bo'lim ham 404
     * olib, saytda umuman ishlamasdi.
     */
    if (resource === "services" || resource === "regions" || resource === "specializations") {
      const qs = new URLSearchParams(qsRaw)
      qs.set("kind", resource)
      if (segments.length === 3) qs.set("id", segments[2])
      return `${SUPABASE_FUNCTIONS_URL}/me-lists?${qs.toString()}`
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
        // Faqat o'chirish. Tahrirlash marshruti `me-achievements-update` ga
        // ketardi — u deploy qilinmagan va UI'da tahrirlash tugmasi ham yo'q.
        return `${SUPABASE_FUNCTIONS_URL}/me-achievements-delete?${qs.toString()}`
      }
    }

    // Youtube-videos: GET /me/youtube-videos
    if (resource === "youtube-videos") {
      return `${SUPABASE_FUNCTIONS_URL}/me-youtube-videos${qsRaw ? `?${qsRaw}` : ""}`
    }

    /**
     * Galereya: GET/POST /me/images, DELETE /me/images/{id}
     *
     * Hammasi `me-images-list` da. Ilgari POST `me-images-add` ga,
     * DELETE `me-images-delete` ga ketardi — ikkalasi ham deploy
     * qilinmagan edi, ya'ni rasm qo'shish ham, o'chirish ham ishlamasdi.
     */
    if (resource === "images") {
      const qs = new URLSearchParams(qsRaw)
      if (segments.length === 3) qs.set("id", segments[2])
      const tail = qs.toString()
      return `${SUPABASE_FUNCTIONS_URL}/me-images-list${tail ? `?${tail}` : ""}`
    }

    // Brands: GET /me/brands, POST /me/brands, DELETE /me/brands/{id}
    if (resource === "brands") {
      if (segments.length === 2) {
        const fn = method === "POST" ? "me-brands-add" : "me-brands-list"
        return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
      }
      if (segments.length === 3) {
        const qs = new URLSearchParams(qsRaw)
        qs.set("id", segments[2])
        return `${SUPABASE_FUNCTIONS_URL}/me-brands-delete?${qs.toString()}`
      }
    }

    // Partner
    if (resource === "partner") return `${SUPABASE_FUNCTIONS_URL}/me-partner${qsRaw ? `?${qsRaw}` : ""}`

    // Notifications
    if (resource === "notifications") return `${SUPABASE_FUNCTIONS_URL}/me-notifications-list${qsRaw ? `?${qsRaw}` : ""}`

    // Topshiriqlar (TZ): GET /me/tasks (ro'yxat), PATCH /me/tasks/{assignment_id} (holat)
    if (resource === "tasks") {
      if (segments.length === 2) return `${SUPABASE_FUNCTIONS_URL}/me-tasks-list${qsRaw ? `?${qsRaw}` : ""}`
      if (segments.length === 3) {
        const qs = new URLSearchParams(qsRaw)
        qs.set("id", segments[2])
        return `${SUPABASE_FUNCTIONS_URL}/me-tasks-update?${qs.toString()}`
      }
    }


    // Fallback
    return `${SUPABASE_FUNCTIONS_URL}/auth-me${qsRaw ? `?${qsRaw}` : ""}`
  }

  /**
   * MIJOZ (hamkor kompaniya) yo'nalishlari.
   *
   * Bu yerda ilgari yetti xil yo'nalish bor edi: statistics,
   * notifications, settings, tasks-update, tasks-delete... Ularning
   * BIRORTASI ham serverda mavjud emas — funksiyalar hech qachon
   * yozilmagan. Chaqirilsa 404 qaytarardi, lekin chaqirmasdi ham:
   * mijoz kodida bu yo'llarga murojaat yo'q edi.
   *
   * Yolg'on yo'nalish kodni o'qiyotgan odamni chalg'itadi — "demak
   * bunday imkoniyat bor" deb o'ylatadi. Shuning uchun faqat
   * HAQIQATAN mavjudlari qoldirildi.
   */
  if (segments[0] === "client") {
    const resource = segments[1]

    if (resource === "tasks" && segments.length === 2 && method === "POST") {
      return `${SUPABASE_FUNCTIONS_URL}/client-tasks-add${qsRaw ? `?${qsRaw}` : ""}`
    }
    if (resource === "partner") {
      return `${SUPABASE_FUNCTIONS_URL}/client-partner-update${qsRaw ? `?${qsRaw}` : ""}`
    }
    throw new ApiError(`Noma'lum yo'nalish: /client/${segments.slice(1).join("/")}`, 404)
  }

  /**
   * Yangiliklar: ro'yxat, bitta yangilik, yaratish, tahrirlash — hammasi
   * `admin-news-list` da. O'chirish alohida (`admin-news-delete`).
   *
   * ILGARI: POST /news ham `admin-news-list` ga ketardi (u faqat GET ni
   * qabul qilardi), PATCH esa deploy qilinmagan `admin-news-update` ga.
   * Ya'ni yangilik yaratish ham, tahrirlash ham prinsipial ishlamasdi.
   */
  if (segments[0] === "news") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/admin-news-list${qsRaw ? `?${qsRaw}` : ""}`
    if (segments.length === 2 && segments[1] === "jobs") {
      return `${SUPABASE_FUNCTIONS_URL}/admin-news-jobs-list${qsRaw ? `?${qsRaw}` : ""}`
    }
    if (segments.length === 4 && segments[1] === "jobs" && segments[3] === "retry") {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[2])
      return `${SUPABASE_FUNCTIONS_URL}/admin-news-jobs-retry?${qs.toString()}`
    }
    if (segments.length === 2) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      const fn = method === "DELETE" ? "admin-news-delete" : "admin-news-list"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}?${qs.toString()}`
    }
  }

  if (segments[0] === "categories") {
    if (segments.length === 1 && method === "POST") return `${SUPABASE_FUNCTIONS_URL}/admin-categories-create${qsRaw ? `?${qsRaw}` : ""}`
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
    if (segments.length === 2 && segments[1] === "create") return `${SUPABASE_FUNCTIONS_URL}/admin-users-create${qsRaw ? `?${qsRaw}` : ""}`
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

  if (segments[0] === "roles") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/admin-roles-list${qsRaw ? `?${qsRaw}` : ""}`
    if (segments.length === 2 && segments[1] === "create") return `${SUPABASE_FUNCTIONS_URL}/admin-roles-create${qsRaw ? `?${qsRaw}` : ""}`
    if (segments.length === 2 && segments[1] === "update") {
      const qs = new URLSearchParams(qsRaw)
      return `${SUPABASE_FUNCTIONS_URL}/admin-roles-update?${qs.toString()}`
    }
    if (segments.length === 2 && segments[1] === "delete") {
      const qs = new URLSearchParams(qsRaw)
      return `${SUPABASE_FUNCTIONS_URL}/admin-roles-delete?${qs.toString()}`
    }
  }

  if (segments[0] === "permissions") {
    if (segments.length === 1) return `${SUPABASE_FUNCTIONS_URL}/admin-permissions-list${qsRaw ? `?${qsRaw}` : ""}`
  }

  // Topshiriqlar (TZ): GET /tasks (ro'yxat), POST /tasks (yangi), DELETE /tasks/{id}
  // SMM: AI tahlil/kontent va postlarni joylash.
  // Edge funksiya limiti sababli ikkala funksiya ham action bilan ishlaydi.
  if (segments[0] === "smm") {
    // /smm/ai?action=analyze|generate
    if (segments[1] === "ai") {
      return `${SUPABASE_FUNCTIONS_URL}/smm-ai${qsRaw ? `?${qsRaw}` : ""}`
    }
    // /smm/posts            -> ro'yxat / yangi
    // /smm/posts/:id        -> tahrirlash / o'chirish
    // /smm/posts/:id?action=publish -> tasdiqlash va joylash
    if (segments[1] === "posts") {
      const qs = new URLSearchParams(qsRaw)
      if (segments[2]) qs.set("id", segments[2])
      const q = qs.toString()
      return `${SUPABASE_FUNCTIONS_URL}/smm-publish${q ? `?${q}` : ""}`
    }
  }

  /**
   * YouTube kanalini boshqarish.
   *   /youtube/oauth?action=start  -> youtube-oauth
   *   /youtube/manage?action=...   -> youtube-manage
   */
  if (segments[0] === "youtube" && (segments[1] === "oauth" || segments[1] === "manage")) {
    return `${SUPABASE_FUNCTIONS_URL}/youtube-${segments[1]}${qsRaw ? `?${qsRaw}` : ""}`
  }

  if (segments[0] === "tasks") {
    if (segments.length === 1) {
      const fn = method === "POST" ? "admin-tasks-create" : "admin-tasks-list"
      return `${SUPABASE_FUNCTIONS_URL}/${fn}${qsRaw ? `?${qsRaw}` : ""}`
    }
    if (segments.length === 2) {
      const qs = new URLSearchParams(qsRaw)
      qs.set("id", segments[1])
      return `${SUPABASE_FUNCTIONS_URL}/admin-tasks-list?${qs.toString()}`
    }
  }

  if (segments[0] === "role-permissions") {
    if (segments.length === 1 && method === "GET") return `${SUPABASE_FUNCTIONS_URL}/admin-role-permissions-get${qsRaw ? `?${qsRaw}` : ""}`
    if (segments.length === 1 && method === "PUT") return `${SUPABASE_FUNCTIONS_URL}/admin-role-permissions-update${qsRaw ? `?${qsRaw}` : ""}`
  }

  if (segments[0] === "user-role") {
    return `${SUPABASE_FUNCTIONS_URL}/admin-user-role-update${qsRaw ? `?${qsRaw}` : ""}`
  }

  if (segments[0] === "media-get-signed-upload-url") {
    return `${SUPABASE_FUNCTIONS_URL}/media-get-signed-upload-url${qsRaw ? `?${qsRaw}` : ""}`
  }
  if (segments[0] === "media-get-signed-download-url") {
    return `${SUPABASE_FUNCTIONS_URL}/media-get-signed-download-url${qsRaw ? `?${qsRaw}` : ""}`
  }

  // Instagram OAuth va Fetch
  if (segments[0] === "instagram-oauth-start") {
    return `${SUPABASE_FUNCTIONS_URL}/instagram-oauth-start${qsRaw ? `?${qsRaw}` : ""}`
  }
  if (segments[0] === "instagram-fetch") {
    return `${SUPABASE_FUNCTIONS_URL}/instagram-fetch${qsRaw ? `?${qsRaw}` : ""}`
  }
  if (segments[0] === "instagram-status") {
    return `${SUPABASE_FUNCTIONS_URL}/instagram-status${qsRaw ? `?${qsRaw}` : ""}`
  }

  // Team members
  if (segments[0] === "team") {
    const qs = new URLSearchParams(qsRaw)
    if (segments.length === 2) qs.set("id", segments[1])
    return `${SUPABASE_FUNCTIONS_URL}/admin-team?${qs.toString()}`
  }

  // News sources
  if (segments[0] === "news-sources") {
    const qs = new URLSearchParams(qsRaw)
    if (segments.length === 2) qs.set("id", segments[1])
    return `${SUPABASE_FUNCTIONS_URL}/admin-news-sources?${qs.toString()}`
  }

  // YouTube Videos
  if (segments[0] === "me-youtube-videos") {
    return `${SUPABASE_FUNCTIONS_URL}/me-youtube-videos${qsRaw ? `?${qsRaw}` : ""}`
  }

  const fnName = basePath.replace(/^\//, "admin-").replace(/\//g, "-")
  return `${SUPABASE_FUNCTIONS_URL}/${fnName}${qsRaw ? `?${qsRaw}` : ""}`
}

/**
 * 15 soniya kam edi: edge funksiya "sovuq" ishga tushganda javob
 * kechikadi va so'rov uzilib qolardi — holbuki server ishni
 * BAJARIB bo'lgan bo'lardi. Natijada post saqlanardi, lekin panel
 * "So'rov vaqti tugadi" deb ko'rsatardi.
 */
const REQUEST_TIMEOUT = 30_000
/**
 * AI so'rovlari sekin (model javobi + zaxira provayder) — 15s yetmaydi va
 * "signal is aborted without reason" xatosi chiqadi. Ularga uzunroq vaqt.
 */
// Rasm generatsiyasi bir necha modelni sinashi mumkin (har biri
// 20s), ustiga so'rov matnini tayyorlash. Eng yomon holat ~85s,
// shuning uchun 110s qo'yamiz — backend edge chegarasi (150s) ichida.
const SLOW_TIMEOUT = 110_000
// Uzoq davom etadigan AI amallari — oddiy timeout ularga yetmaydi.
// Qayta tarjima bir chaqiruvda ~45 soniya ishlaydi.
/**
 * `/smm/posts` ham shu ro'yxatda: joylash bir necha tarmoqqa boradi
 * va har biri o'z tarmoq so'rovini kutadi (Instagram ikki bosqichli,
 * YouTube esa video faylni uzatadi). 30 soniya yetmasdi — server
 * ishlashda davom etardi, panel esa "So'rov vaqti tugadi" deb
 * ko'rsatib, post joylanganini bilmay qolardi.
 */
const SLOW_PATHS = ["/smm/ai", "/smm/posts", "/settings?action=retranslate", "/news"]

async function fetchWithTimeout(url: string, opts: RequestInit, timeout = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    return res
  } finally {
    clearTimeout(id)
  }
}

// Login talab qilmaydigan, lekin /public/ prefiksisiz Edge Function'lar
const PUBLIC_FUNCTIONS = ["/contact-submit", "/newsletter-subscribe", "/blogger-reviews"]

/* ==========================================================================
   GET SO'ROVLARI KESHI
   ==========================================================================
   MUAMMO: loyihada kesh qatlami umuman yo'q edi (react-query/SWR ham yo'q).
   Natijada:
     - profil ma'lumoti sahifa ochilishida IKKI MARTA yuklanardi
     - admin panelida /bloggers AYNAN bir xil URL bilan ikki marta
     - panel ichida tab almashtirilganda hamma so'rov qaytadan ketardi
   Har bir so'rov Frankfurtga borib keladi (~1 sekund), shuning uchun
   takroriylar to'g'ridan-to'g'ri kutish vaqtiga aylanadi.

   Ikki qatlam:
     1) UCHUVDAGI so'rovlar — bir xil URL bir vaqtda ikki marta so'ralsa,
        BITTA tarmoq so'rovi ketadi va ikkalasi shu javobni oladi.
     2) QISQA KESH — TTL ichida takroriy GET umuman tarmoqqa chiqmaydi.

   Har qanday yozish amali (POST/PUT/PATCH/DELETE) keshni butunlay
   tozalaydi: eskirgan ma'lumot ko'rsatilmasin.
   ========================================================================== */

const CACHE_TTL_MS = 30_000
type CacheYozuv = { vaqt: number; data: unknown }
const getCache = new Map<string, CacheYozuv>()
const uchuvda = new Map<string, Promise<unknown>>()

/** Yozish amalidan keyin va login/logout paytida chaqiriladi */
export function clearApiCache(): void {
  getCache.clear()
  uchuvda.clear()
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const publicFn = PUBLIC_FUNCTIONS.some((p) => path === p || path.startsWith(p + "?"))
  const isPublic = path.startsWith("/public/")
  const method = opts.method || "GET"
  const needsAuth = !isPublic && !publicFn

  // MUHIM: token yo'q bo'lsa so'rov ilgari `/api${path}` ga ketardi.
  // Bunday manzil yo'q — dev'da 502, production'da 404 qaytarardi va
  // foydalanuvchi "Ma'lumotni yuklab bo'lmadi" degan tushunarsiz xato
  // ko'rardi. Aslida sabab bitta: sessiya tugagan.
  if (needsAuth && !token) {
    throw new Error("Sessiya tugadi — qayta kiring")
  }

  let url = publicFn
    ? `${SUPABASE_FUNCTIONS_URL}${path}`
    : isPublic ? resolvePublicUrl(path) : resolveAdminUrl(path, method)

  /**
   * TIL — bir joyda qo'shiladi.
   *
   * Har bir yuklovchi funksiyaga (loadNews, loadBloggers, ...) qo'lda
   * `lang` parametri qo'shish o'rniga shu yerda qo'shamiz: yangi
   * endpoint qo'shilganda uni unutib qolish mumkin emas.
   *
   * Faqat OMMAVIY so'rovlarga: admin panel doim o'zbekcha manba
   * matn bilan ishlaydi, aks holda muharrir tarjimani tahrirlab
   * asl matnni buzib qo'yardi.
   */
  if (isPublic) {
    const l = currentLang()
    if (l !== "uz") url += (url.includes("?") ? "&" : "?") + `lang=${l}`
  }

  // Yozish amali — kesh eskirdi
  if (method !== "GET") clearApiCache()

  // Kesh kaliti tokenni ham hisobga oladi: boshqa foydalanuvchining
  // javobi ko'rinib qolmasin.
  const kalit = `${token ? "a" : "p"}:${url}`

  if (method === "GET") {
    const bor = getCache.get(kalit)
    if (bor && Date.now() - bor.vaqt < CACHE_TTL_MS) return bor.data as T
    const kutilmoqda = uchuvda.get(kalit)
    if (kutilmoqda) return kutilmoqda as Promise<T>
  }

  const h = new Headers(opts.headers)
  h.set("Content-Type", "application/json")
  if (token) h.set("Authorization", `Bearer ${token}`)
  h.set("apikey", SUPABASE_ANON_KEY)

  const slow = SLOW_PATHS.some((p) => path.startsWith(p))

  const yubor = async (): Promise<T> => {
    let res: Response
    try {
      res = await fetchWithTimeout(
        url,
        { ...opts, headers: h },
        slow ? SLOW_TIMEOUT : REQUEST_TIMEOUT,
      )
    } catch (e) {
      // AbortError xom holda "signal is aborted without reason" deb chiqadi —
      // foydalanuvchi uchun tushunarsiz. Aniq sabab yozamiz.
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error("So'rov vaqti tugadi — qayta urining", { cause: e })
      }
      throw e
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errMsg = (data as { error?: string })?.error || (data as { message?: string })?.message || "Xatolik yuz berdi"
      console.error("API error:", res.status, url, data)
      throw new ApiError(errMsg, res.status)
    }
    return data as T
  }

  if (method !== "GET") return yubor()

  // XATO KESHLANMAYDI: faqat muvaffaqiyatli javob saqlanadi, aks holda
  // bir marta yiqilgan so'rov 30 soniya davomida qayta urinishga
  // imkon bermasdi.
  const p = yubor()
    .then((data) => {
      getCache.set(kalit, { vaqt: Date.now(), data })
      return data
    })
    .finally(() => {
      uchuvda.delete(kalit)
    })

  uchuvda.set(kalit, p)
  return p
}

/**
 * HTTP holat kodini saqlab qoladigan xato.
 *
 * NEGA KERAK: oddiy Error bilan chaqiruvchi 404 (haqiqatan yo'q) ni
 * 500 yoki tarmoq uzilishidan ajrata olmasdi. Natijada server yiqilsa
 * ham foydalanuvchi "topilmadi" degan YOLG'ON xabarni ko'rardi.
 */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export type User = {
  id: string
  name: string
  email: string
  role: "superadmin" | "blogger" | "partner"
  adminRole?: string
  partnerId: string | null
  status?: string
  profile?: Record<string, unknown>
  socials?: { id: string; platform: string; link: string; connected: boolean; name?: string; avatar?: string; subscribers?: string; views?: string }[]
  /** `partner_id` — video qaysi hamkor kompaniya uchun tayyorlangani */
  videos?: { id: string; name: string; link: string; views: string; plats: string[]; date: string; status: string; thumbnail?: string; author?: string; partner_id?: string | null; partner_name?: string | null }[]
}
