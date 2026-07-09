export const HTTP = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY: 429,
  SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
} as const

export const ROLES = {
  SUPER_ADMIN: "super_admin" as const,
  ADMIN: "admin" as const,
  EDITOR: "editor" as const,
  BLOGGER: "blogger" as const,
  COMPANY: "company" as const,
  USER: "user" as const,
}

export const ROLE_PRIORITY: Record<string, number> = {
  super_admin: 100,
  admin: 80,
  editor: 60,
  blogger: 40,
  company: 20,
  user: 10,
}

export const ACCOUNT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  BANNED: "banned",
  PENDING: "pending",
} as const

export const PARTNER_STATUS = {
  ACTIVE: "active",
  PENDING: "pending",
  COMPLETED: "completed",
} as const

export const TASK_STATUS = {
  PENDING: "pending",
  PROGRESS: "progress",
  DONE: "done",
} as const

export const SOCIAL_PLATFORMS = [
  "telegram",
  "instagram",
  "youtube",
  "tiktok",
  "twitter",
  "linkedin",
  "facebook",
] as const

export const NEWS_CATEGORIES = [
  "agro",
  "technology",
  "market",
  "policy",
  "education",
  "sustainability",
] as const

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 12,
  MAX_PER_PAGE: 50,
} as const

export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 3600,
  DAY: 86400,
} as const

export const RATE_LIMIT = {
  WINDOW_MS: 60000,
  MAX_REQUESTS: 60,
} as const

export const UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
  ALLOWED_VIDEO_TYPES: ["video/mp4", "video/webm"],
} as const
