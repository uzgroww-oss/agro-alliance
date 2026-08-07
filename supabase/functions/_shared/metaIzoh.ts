import { supabaseAdmin } from "./supabase.ts"
import { getFacebookPage } from "./facebook.ts"
import type { UmumIzoh } from "./izohTur.ts"

/**
 * INSTAGRAM VA FACEBOOK IZOHLARI.
 *
 * Ikkalasi ham Meta Graph API — bitta faylda, chunki token olish,
 * xatolarni o'qish va ruxsat muammolari deyarli bir xil.
 *
 * RUXSATLAR (instagram-oauth-start dagi `scopes` qatorida):
 *   instagram_manage_comments — IG izohlarini o'qish va javob yozish
 *   pages_manage_engagement   — FB sahifasi nomidan izoh yozish
 * Ikkalasi ham keyin qo'shilgan, ya'ni ESKI ULANISH YETMAYDI: Meta
 * ruxsatlarni tokenga ulangan paytda biriktiradi. Panel 403/190
 * xatosini aynan shunday tushuntiradi.
 */

const G = "https://graph.facebook.com/v22.0"

/** Meta xatosini odam tushunadigan gapga aylantiradi */
function xatoMatn(d: Record<string, any>, tarmoq: string): string {
  const e = d?.error || {}
  const kod = Number(e.code || 0)
  const sub = Number(e.error_subcode || 0)
  // 190 — token yaroqsiz/eskirgan; 10 va 200 — ruxsat yetishmaydi
  if (kod === 190 || sub === 463 || sub === 467) {
    return `${tarmoq}: ulanish eskirgan — kanalni qayta ulang`
  }
  if (kod === 10 || kod === 200 || kod === 3) {
    return `${tarmoq}: izohlar uchun ruxsat yo'q — kanalni QAYTA ulang (yangi ruxsat: izohlarni boshqarish)`
  }
  return `${tarmoq}: ${String(e.message || "noma'lum xato")}`
}

async function graf(url: string): Promise<{ ok: boolean; data: Record<string, any> }> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    const d = await r.json().catch(() => ({}))
    return { ok: r.ok && !d?.error, data: d }
  } catch (e) {
    return { ok: false, data: { error: { message: e instanceof Error ? e.message : "tarmoq xatosi" } } }
  }
}

async function grafPost(url: string, tana: Record<string, string>): Promise<{ ok: boolean; data: Record<string, any> }> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tana),
      signal: AbortSignal.timeout(20_000),
    })
    const d = await r.json().catch(() => ({}))
    return { ok: r.ok && !d?.error, data: d }
  } catch (e) {
    return { ok: false, data: { error: { message: e instanceof Error ? e.message : "tarmoq xatosi" } } }
  }
}

/* ==========================================================================
   FACEBOOK SAHIFASI
   ========================================================================== */

/**
 * Sahifadagi so'nggi postlar va ularning izohlari — BITTA so'rovda.
 *
 * Post bo'yicha aylanib chiqish (har post uchun alohida so'rov) Graph
 * chegarasini tez yeydi. Ichma-ich `comments{...}` bilan hammasi bir
 * marta keladi.
 *
 * Ichkarida yana `comments{from}` bor: bu izohga kanal O'ZI javob
 * berganmi degan savolga javob. Usiz tahririyat qo'lda yozgan javob
 * ko'rinmasdi va AI ustiga ikkinchisini yozardi.
 */
export async function facebookIzohlar(limit: number): Promise<{ ok: boolean; izohlar: UmumIzoh[]; xato: string }> {
  const page = await getFacebookPage()
  if (!page) return { ok: false, izohlar: [], xato: "Facebook sahifasi ulanmagan" }

  const fields =
    "id,message,created_time,permalink_url," +
    "comments.limit(25){id,message,from,created_time,like_count,comments.limit(5){from}}"
  const r = await graf(
    `${G}/${page.id}/feed?fields=${encodeURIComponent(fields)}&limit=10&access_token=${encodeURIComponent(page.token)}`,
  )
  if (!r.ok) return { ok: false, izohlar: [], xato: xatoMatn(r.data, "Facebook") }

  const izohlar: UmumIzoh[] = []
  for (const post of (r.data.data as Record<string, any>[]) || []) {
    const sarlavha = String(post.message || "").replace(/\s+/g, " ").slice(0, 120)
    for (const c of (post.comments?.data as Record<string, any>[]) || []) {
      const fromId = String(c.from?.id || "")
      izohlar.push({
        id: String(c.id),
        postId: String(post.id || ""),
        postTitle: sarlavha,
        havola: String(post.permalink_url || ""),
        muallif: String(c.from?.name || "—"),
        ozimizmi: fromId === page.id,
        matn: String(c.message || ""),
        vaqt: String(c.created_time || ""),
        yoqtirish: Number(c.like_count ?? 0),
        javobMumkin: true,
        javobBerilgan: ((c.comments?.data as Record<string, any>[]) || [])
          .some((x) => String(x.from?.id || "") === page.id),
      })
    }
  }
  // Eng yangisi birinchi — eski izohga endi javob berishning ma'nosi kam
  izohlar.sort((a, b) => (b.vaqt || "").localeCompare(a.vaqt || ""))
  return { ok: true, izohlar: izohlar.slice(0, limit), xato: "" }
}

export async function facebookJavob(commentId: string, matn: string): Promise<{ ok: boolean; xato: string }> {
  const page = await getFacebookPage()
  if (!page) return { ok: false, xato: "Facebook sahifasi ulanmagan" }
  const r = await grafPost(`${G}/${commentId}/comments`, {
    message: matn.slice(0, 8000),
    access_token: page.token,
  })
  return r.ok ? { ok: true, xato: "" } : { ok: false, xato: xatoMatn(r.data, "Facebook") }
}

/* ==========================================================================
   INSTAGRAM
   ========================================================================== */

async function igHisob(): Promise<{ id: string; token: string; username: string } | null> {
  const { data } = await supabaseAdmin
    .from("instagram_tokens")
    .select("access_token, instagram_account_id, instagram_username")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.access_token || !data?.instagram_account_id) return null
  return {
    id: String(data.instagram_account_id),
    token: String(data.access_token),
    username: String(data.instagram_username || ""),
  }
}

/**
 * Instagram'da "hisobning barcha izohlari" degan endpoint YO'Q —
 * media bo'yicha yurish kerak. Lekin ichma-ich so'rov bilan so'nggi
 * postlar va ularning izohlari BITTA chaqiruvda keladi.
 *
 * `replies{username}` — bu izohga o'zimiz javob berganmizmi. IG
 * javobni izoh muallifi USERNAME i bilan qaytaradi, ID bilan emas,
 * shuning uchun solishtiruv username bo'yicha.
 */
export async function instagramIzohlar(limit: number): Promise<{ ok: boolean; izohlar: UmumIzoh[]; xato: string }> {
  const h = await igHisob()
  if (!h) return { ok: false, izohlar: [], xato: "Instagram ulanmagan" }

  const fields =
    "id,caption,permalink,timestamp," +
    "comments.limit(25){id,text,username,timestamp,like_count,replies.limit(5){username}}"
  const r = await graf(
    `${G}/${h.id}/media?fields=${encodeURIComponent(fields)}&limit=10&access_token=${encodeURIComponent(h.token)}`,
  )
  if (!r.ok) return { ok: false, izohlar: [], xato: xatoMatn(r.data, "Instagram") }

  const izohlar: UmumIzoh[] = []
  for (const m of (r.data.data as Record<string, any>[]) || []) {
    const sarlavha = String(m.caption || "").replace(/\s+/g, " ").slice(0, 120)
    for (const c of (m.comments?.data as Record<string, any>[]) || []) {
      const user = String(c.username || "")
      izohlar.push({
        id: String(c.id),
        postId: String(m.id || ""),
        postTitle: sarlavha,
        havola: String(m.permalink || ""),
        muallif: user || "—",
        ozimizmi: Boolean(h.username) && user === h.username,
        matn: String(c.text || ""),
        vaqt: String(c.timestamp || ""),
        yoqtirish: Number(c.like_count ?? 0),
        javobMumkin: true,
        javobBerilgan: ((c.replies?.data as Record<string, any>[]) || [])
          .some((x) => Boolean(h.username) && String(x.username || "") === h.username),
      })
    }
  }
  izohlar.sort((a, b) => (b.vaqt || "").localeCompare(a.vaqt || ""))
  return { ok: true, izohlar: izohlar.slice(0, limit), xato: "" }
}

export async function instagramJavob(commentId: string, matn: string): Promise<{ ok: boolean; xato: string }> {
  const h = await igHisob()
  if (!h) return { ok: false, xato: "Instagram ulanmagan" }
  const r = await grafPost(`${G}/${commentId}/replies`, {
    message: matn.slice(0, 2200),
    access_token: h.token,
  })
  return r.ok ? { ok: true, xato: "" } : { ok: false, xato: xatoMatn(r.data, "Instagram") }
}
