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

/** Imzolangan state yaratish */
export async function signState(secret: string, userId: string): Promise<string> {
  const payload = JSON.stringify({ userId, ts: Date.now() })
  const p = b64url(enc.encode(payload))
  const sig = await hmac(secret, p)
  return `${p}.${sig}`
}

/** Statena tekshirish; yaroqli bo'lsa userId qaytaradi, aks holda null. Muddat: 15 daqiqa. */
export async function verifyState(secret: string, state: string): Promise<string | null> {
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
    const { userId, ts } = JSON.parse(b64urlDecode(p))
    if (!userId || typeof ts !== "number") return null
    if (Date.now() - ts > 15 * 60 * 1000) return null // 15 daqiqadan eski — rad
    return userId
  } catch {
    return null
  }
}
