/**
 * JWT NI MAHALLIY TEKSHIRISH.
 *
 * MUAMMO: `verifyAuth` har himoyalangan so'rovda
 * `supabaseAdmin.auth.getUser(token)` chaqirardi — bu Auth xizmatiga
 * ALOHIDA TARMOQ SO'ROVI. O'lchandi: 0.5–0.95 soniya. Ya'ni
 * foydalanuvchi panelda tugma bosganda vaqtning yarmi tokenni
 * "haqiqiymi?" deb so'rashga ketardi.
 *
 * YECHIM: token imzosini O'ZIMIZ tekshiramiz. Supabase JWT ni ES256
 * (ECDSA P-256) bilan imzolaydi va ochiq kalitni JWKS orqali beradi —
 * ya'ni imzoni tekshirish uchun hech kimdan so'rash shart emas.
 * Kalit bir marta olinadi va xotirada saqlanadi. Tekshiruvning o'zi
 * mikrosekundlar.
 *
 * NIMA TEKSHIRILADI (hammasi majburiy):
 *   imzo  — kalit bizniki ekanini isbotlaydi
 *   exp   — muddati o'tgan token o'tmaydi
 *   iss   — token AYNAN bizning loyihamizdan
 *   aud   — `authenticated` (anon kalit bilan kirib bo'lmasin)
 *
 * NIMAGA ISHONILMAYDI: token ichidagi boshqa hech narsaga. Rol va
 * holat baribir BAZADAN o'qiladi — token eskirgan bo'lishi mumkin,
 * admin esa foydalanuvchini bloklagan bo'lishi mumkin.
 *
 * ZAXIRA: imzoni tekshirib bo'lmasa (kalit almashgan, eski HS256
 * token) chaqiruvchi eski yo'lga — `getUser()` ga qaytadi. Ya'ni bu
 * o'zgarish hech kimni tizimdan chiqarib yubormaydi.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`
const KUTILGAN_ISS = `${SUPABASE_URL}/auth/v1`

/** kid -> ochiq kalit. Kalitlar kamdan-kam almashadi, xotirada tursin. */
const kalitlar = new Map<string, CryptoKey>()
let oxirgiYuklash = 0
/** Noma'lum kid kelganda qayta yuklaymiz, lekin daqiqada bir martadan ko'p emas */
const QAYTA_YUKLASH_MS = 60_000

function b64urlDecode(s: string): Uint8Array {
  const t = s.replace(/-/g, "+").replace(/_/g, "/")
  const pad = t + "=".repeat((4 - (t.length % 4)) % 4)
  const xom = atob(pad)
  const bayt = new Uint8Array(xom.length)
  for (let i = 0; i < xom.length; i++) bayt[i] = xom.charCodeAt(i)
  return bayt
}

function b64urlJson(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(s)))
  } catch {
    return null
  }
}

async function kalitlarniYukla(): Promise<void> {
  if (Date.now() - oxirgiYuklash < QAYTA_YUKLASH_MS) return
  oxirgiYuklash = Date.now()
  try {
    const r = await fetch(JWKS_URL)
    if (!r.ok) return
    const d = await r.json() as { keys?: Record<string, unknown>[] }
    for (const jwk of d.keys || []) {
      const kid = String(jwk.kid || "")
      if (!kid || jwk.kty !== "EC") continue
      try {
        const key = await crypto.subtle.importKey(
          "jwk",
          jwk as JsonWebKey,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"],
        )
        kalitlar.set(kid, key)
      } catch { /* bitta kalit yaroqsiz bo'lsa qolganlari ishlaydi */ }
    }
  } catch { /* tarmoq xatosi — chaqiruvchi zaxira yo'lga o'tadi */ }
}

export type TokenDavo = { sub: string; email: string }

/**
 * Token haqiqiymi. Haqiqiy bo'lsa `sub` (foydalanuvchi id) qaytadi,
 * aks holda `null` — chaqiruvchi zaxira yo'lga o'tadi.
 */
export async function tokenTekshir(token: string): Promise<TokenDavo | null> {
  const qism = token.split(".")
  if (qism.length !== 3) return null
  const [h, p, sig] = qism

  const bosh = b64urlJson(h)
  if (!bosh || bosh.alg !== "ES256") return null // faqat kutilgan algoritm
  const kid = String(bosh.kid || "")
  if (!kid) return null

  if (!kalitlar.has(kid)) await kalitlarniYukla()
  const kalit = kalitlar.get(kid)
  if (!kalit) return null

  let ok = false
  try {
    ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      kalit,
      b64urlDecode(sig),
      new TextEncoder().encode(`${h}.${p}`),
    )
  } catch {
    return null
  }
  if (!ok) return null

  const dava = b64urlJson(p)
  if (!dava) return null

  // Muddati. 30 soniya farq beriladi — soatlar aniq bir xil bo'lmaydi.
  const exp = Number(dava.exp || 0)
  if (!exp || Date.now() / 1000 > exp + 30) return null

  // Token AYNAN bizning loyihadan
  if (String(dava.iss || "") !== KUTILGAN_ISS) return null

  // `anon` kaliti ham to'g'ri imzolangan JWT — uni odam deb qabul
  // qilib bo'lmaydi
  const aud = dava.aud
  const audOk = Array.isArray(aud) ? aud.includes("authenticated") : aud === "authenticated"
  if (!audOk) return null

  const sub = String(dava.sub || "")
  if (!sub) return null

  return { sub, email: String(dava.email || "") }
}
