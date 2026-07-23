/**
 * OAuth "state" ni HMAC bilan imzolash/tekshirish.
 * Maqsad: hujumchi boshqa foydalanuvchi userId'si uchun yaroqli state yasay olmasin
 * (account-linking CSRF / token grafting oldini olish).
 * Kalit sifatida FACEBOOK_APP_SECRET ishlatiladi (ikkala funksiyada mavjud).
 */

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
function b64urlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/")
  s += "=".repeat((4 - (s.length % 4)) % 4)
  return atob(s)
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data))
  return b64url(new Uint8Array(sig))
}

/**
 * Ruxsat etilgan qaytish manzillari.
 *
 * NEGA RO'YXAT: callback state ichidagi manzilga qaytaradi. Ro'yxatsiz
 * bu ochiq qayta yo'naltirish bo'lardi — tizimga kirgan foydalanuvchi
 * Origin sarlavhasini o'zgartirib, callback'ni istalgan saytga
 * yo'naltirtira olardi.
 */
const ALLOWED_ORIGINS = [
  "https://agroalliance.uz",
  "https://www.agroalliance.uz",
]
function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  // Ishlab chiqish serverlari: har safar port o'zgaradi
  return /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
}

/** Imzolangan state yaratish. origin — OAuth tugagach qaytiladigan manzil. */
export async function signState(secret: string, userId: string, origin = ""): Promise<string> {
  const safeOrigin = isAllowedOrigin(origin) ? origin : ""
  const payload = JSON.stringify({ userId, origin: safeOrigin, ts: Date.now() })
  const p = b64url(enc.encode(payload))
  const sig = await hmac(secret, p)
  return `${p}.${sig}`
}

/** Statena tekshirish; yaroqli bo'lsa {userId, origin}, aks holda null. Muddat: 15 daqiqa. */
export async function verifyState(
  secret: string,
  state: string,
): Promise<{ userId: string; origin: string } | null> {
  const parts = state.split(".")
  if (parts.length !== 2) return null
  const [p, sig] = parts
  const expected = await hmac(secret, p)
  // doimiy vaqt taqqoslash
  if (sig.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  if (diff !== 0) return null
  try {
    const { userId, origin, ts } = JSON.parse(b64urlDecode(p))
    if (!userId || typeof ts !== "number") return null
    if (Date.now() - ts > 15 * 60 * 1000) return null // 15 daqiqadan eski — rad
    // Imzoni buzib bo'lmaydi, lekin eski state'larda origin yo'q —
    // shuning uchun bu yerda ham qaytadan tekshiramiz.
    const safe = typeof origin === "string" && isAllowedOrigin(origin) ? origin : ""
    return { userId, origin: safe }
  } catch {
    return null
  }
}
