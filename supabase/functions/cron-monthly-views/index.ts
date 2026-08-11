/**
 * cron-monthly-views — "O'tgan oy" ko'rishlari (YouTube + Instagram).
 *
 * YouTube — SNAPSHOT AYIRMASI (asosiy usul):
 *   Har oy kanalning UMRBOD jami ko'rishi view_snapshots ga yoziladi.
 *   Oylik ko'rish = (shu oy jami) − (o'tgan oy jami).
 *   Bu ESKI videolar olgan ko'rishlarni ham qamrab oladi.
 *
 *   Zaxira usul: oldingi oy snapshoti hali yo'q bo'lsa (birinchi ishga tushirish),
 *   eski usulga qaytamiz — o'tgan oyda YUKLANGAN videolarning viewCount yig'indisi.
 *   Bu usul katta arxivli kanallarda ko'rsatkichni jiddiy kam ko'rsatadi,
 *   shuning uchun u faqat vaqtinchalik.
 *
 * Instagram — XUDDI SHU SNAPSHOT AYIRMASI:
 *   Jami sifatida SO'NGGI 100 postning view_count yig'indisi olinadi
 *   (business_discovery orqali). Ayirma "oy davomida ortgan ko'rish"
 *   ni beradi — eski postlarga tushgan ko'rish ham ichida.
 *
 *   Nega barcha postlar emas, oyna — `igLifetimeViews` izohiga qarang:
 *   Graph API ilova so'rov chegarasi buni ko'tarmadi.
 *
 *   ILGARI boshqacha edi: o'sha oyda JOYLANGAN postlarning ko'rishi
 *   sanalardi. Bu YouTube bilan boshqa narsani o'lchardi — eski
 *   postlarga shu oy tushgan ko'rish hisobga olinmasdi, oy oxirida
 *   chiqqan post esa hali ko'rish yig'ib ulgurmagan bo'lardi.
 *   Instagram umumiy raqamning 93% ini bergani uchun natija amalda
 *   o'sha usulga tayanardi.
 *
 *   Zaxira usul o'sha-o'sha: oldingi oy snapshoti yo'q bo'lsa (birinchi
 *   ishga tushirish) eski usulga qaytamiz.
 *
 * ?month=YYYY-MM bilan ma'lum oyni ham hisoblash mumkin (test uchun).
 */
import { supabaseAdmin } from "../_shared/supabase.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"

const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") || ""

/* ---------------- YouTube ---------------- */
function extractHandle(url: string): string | null {
  const m = url.match(/\/@([a-zA-Z0-9_.-]+)/)
  if (m) return m[1]
  const c = url.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)
  if (c) return c[1]
  return null
}

/**
 * Kanalning UMRBOD jami ko'rishi. Snapshot ayirmasi shu qiymatga tayanadi.
 * Xatoda null — chaqiruvchi akkauntni o'tkazib yuboradi (eski qiymat saqlanadi).
 */
async function ytLifetimeViews(handle: string): Promise<number | null> {
  const isId = handle.startsWith("UC")
  const param = isId ? `id=${handle}` : `forHandle=${encodeURIComponent(handle)}`
  const u = `https://www.googleapis.com/youtube/v3/channels?part=statistics&${param}&key=${YT_KEY}`
  const r = await fetch(u)
  if (!r.ok) return null
  const d = await r.json()
  const v = d.items?.[0]?.statistics?.viewCount
  return v === undefined || v === null ? null : Number(v)
}

async function ytUploads(handle: string): Promise<string | null> {
  const isId = handle.startsWith("UC")
  const param = isId ? `id=${handle}` : `forHandle=${encodeURIComponent(handle)}`
  const u = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${param}&key=${YT_KEY}`
  const r = await fetch(u)
  if (!r.ok) return null
  const d = await r.json()
  return d.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null
}

async function ytMonthViews(handle: string, startIso: string, endIso: string): Promise<number> {
  const uploads = await ytUploads(handle)
  if (!uploads) return 0
  const ids: string[] = []
  let pageToken = ""
  for (let page = 0; page < 6; page++) {
    const u = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}&key=${YT_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`
    const r = await fetch(u); const d = await r.json()
    let anyInOrNewer = false
    for (const it of d.items || []) {
      const pub = it.contentDetails?.videoPublishedAt
      if (!pub) continue
      if (pub >= startIso && pub < endIso) ids.push(it.contentDetails.videoId)
      if (pub >= startIso) anyInOrNewer = true
    }
    const last = d.items?.[d.items.length - 1]?.contentDetails?.videoPublishedAt
    if (!d.nextPageToken || (last && last < startIso && !anyInOrNewer)) break
    pageToken = d.nextPageToken
  }
  let views = 0
  for (let i = 0; i < ids.length; i += 50) {
    const u = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.slice(i, i + 50).join(",")}&key=${YT_KEY}`
    const r = await fetch(u); const d = await r.json()
    for (const v of d.items || []) views += Number(v.statistics?.viewCount || 0)
  }
  return views
}

/**
 * Ro'yxatni bir vaqtda `limit` tadan bajaradi va natijalarni KIRISH
 * TARTIBIDA qaytaradi.
 *
 * NEGA KERAK: Instagram snapshoti akkauntiga ~7 ta so'rov talab
 * qiladi (o'rtacha 310 post, 50 tadan). 34 akkaunt uchun ~240 so'rov
 * — ketma-ket bajarilsa edge funksiyaning 150 soniyasi yetmaydi.
 *
 * NEGA `Promise.all` EMAS: u 240 ta so'rovni bir yo'la yuborardi va
 * Graph API burst chegarasiga urilardi. Bu yerda navbat: bo'shagan
 * joyga keyingisi tushadi.
 *
 * Bitta akkaunt yiqilsa qolganlari davom etadi — natijasi `null`.
 */
async function parallelBajar<T, R>(
  items: T[],
  limit: number,
  fn: (x: T) => Promise<R | null>,
): Promise<(R | null)[]> {
  const natija: (R | null)[] = new Array(items.length).fill(null)
  let keyingi = 0
  const ishchi = async () => {
    while (true) {
      const i = keyingi++
      if (i >= items.length) return
      try {
        natija[i] = await fn(items[i])
      } catch (e) {
        console.error("akkaunt xatosi:", e instanceof Error ? e.message : e)
        natija[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, ishchi))
  return natija
}

/* ---------------- Instagram ---------------- */
function extractIgUsername(url: string): string | null {
  const m = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/)
  return m ? m[1].replace(/\/$/, "") : null
}

/**
 * Instagram uchun "jami ko'rish" — SO'NGGI POSTLAR OYNASI bo'yicha.
 *
 * NEGA UMRBOD EMAS. Instagram akkaunt darajasida umrbod ko'rish
 * bermaydi: `business_discovery` faqat obunachi, post soni va har
 * postning ko'rishini beradi, Insights API esa faqat O'Z akkauntingiz
 * uchun ishlaydi — blogerlar hisoblari bizniki emas. Ya'ni jamini
 * faqat postlarni sanab chiqib olish mumkin.
 *
 * BARCHA POSTNI SANASH IMKONSIZ BO'LDI. O'lchandi: akkauntlarda
 * o'rtacha 310 post, 50 tadan 7 sahifa, 34 akkaunt uchun ~240 so'rov.
 * Jonli sinovda Graph API buni ko'tarmadi:
 *   (#4) Application request limit reached
 * va O'TTIZ TO'RTALA akkaunt o'tkazib yuborildi.
 *
 * YECHIM: oyna. So'nggi 100 postning ko'rishlari yig'indisi olinadi
 * (2 sahifa, 34 akkaunt uchun ~68 so'rov).
 *
 * NEGA AYIRMA BUNDA HAM TO'G'RI: oyna bir oylik kontentdan ancha keng
 * — blogerlar oyiga o'rtacha 10-40 post joylaydi, ya'ni 100 postlik
 * oyna 3-10 oyni qamraydi. Ikki oy o'lchovida deyarli o'sha postlar
 * turadi, ustiga yangilari qo'shiladi. Oynadan chiqib ketgan eski
 * postlar esa amalda o'smaydi — Instagram'da ko'rishning katta qismi
 * birinchi kunlarda yig'iladi. Demak ayirma "oy davomida ortgan
 * ko'rish" ni beradi, xuddi YouTube dagidek.
 *
 * Oyna torayib ketsa yoki post o'chirilsa jami KAMAYISHI mumkin —
 * chaqiruvchi bunday holatda zaxira usulga o'tadi (`lifetime >= prev`
 * tekshiruvi).
 *
 * Birinchi sahifada xato bo'lsa `null` — akkaunt o'tkazib yuboriladi
 * va eski qiymat 0 bilan yozib yuborilmaydi.
 */
const IG_OYNA_SAHIFA = 2

async function igLifetimeViews(token: string, accountId: string, username: string): Promise<number | null> {
  let after = ""
  let jami = 0
  for (let page = 0; page < IG_OYNA_SAHIFA; page++) {
    const mediaEdge = after
      ? `media.limit(50).after(${after}){id,view_count}`
      : `media.limit(50){id,view_count}`
    const url = `https://graph.facebook.com/v22.0/${accountId}?fields=business_discovery.username(${username}){${mediaEdge}}&access_token=${token}`
    const r = await fetch(url)
    const d = await r.json()
    if (d.error) return page === 0 ? null : jami
    const bd = d.business_discovery
    if (!bd) return page === 0 ? null : jami
    const items = bd.media?.data || []
    for (const m of items) jami += Number(m.view_count || 0)
    const next = bd.media?.paging?.cursors?.after
    if (!next || items.length === 0) break
    after = next
  }
  return jami
}

/** API xatosi bo'lsa null — chaqiruvchi akkauntni o'tkazib yuboradi (0 yozilmaydi). */
async function igMonthViews(token: string, accountId: string, username: string, startIso: string, endIso: string): Promise<number | null> {
  const mediaFields = "id,media_type,timestamp,view_count"
  let after = ""
  let views = 0
  for (let page = 0; page < 15; page++) {
    const mediaEdge = after
      ? `media.limit(50).after(${after}){${mediaFields}}`
      : `media.limit(50){${mediaFields}}`
    const url = `https://graph.facebook.com/v22.0/${accountId}?fields=business_discovery.username(${username}){${mediaEdge}}&access_token=${token}`
    const r = await fetch(url); const d = await r.json()
    // API xatosi (masalan rate-limit) birinchi sahifada bo'lsa — null qaytaramiz,
    // shunda eski qiymat 0 bilan yozib yuborilmaydi (ma'lumot yo'qolmasin)
    if (d.error) return page === 0 ? null : views
    const bd = d.business_discovery
    if (!bd) return page === 0 ? null : views
    const items = bd.media?.data || []
    let reachedOlder = false
    for (const m of items) {
      const ts = m.timestamp
      if (!ts) continue
      if (ts >= startIso && ts < endIso) views += Number(m.view_count || 0)
      if (ts < startIso) reachedOlder = true
    }
    const next = bd.media?.paging?.cursors?.after
    if (!next || items.length === 0 || reachedOlder) break
    after = next
  }
  return views
}

/* ---------------- Main ---------------- */
Deno.serve(async (req) => {
  // XAVFSIZLIK: faqat maxfiy kalit bilan chaqirilishi mumkin (pg_cron header yuboradi)
  const CRON_SECRET = Deno.env.get("CRON_SECRET") || ""
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return errorResponse("Forbidden", 403)
  }

  const url = new URL(req.url)
  const monthParam = url.searchParams.get("month")
  let year: number, month: number
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number); year = y; month = m - 1
  } else {
    const now = new Date()
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    year = prev.getUTCFullYear(); month = prev.getUTCMonth()
  }
  const startIso = new Date(Date.UTC(year, month, 1)).toISOString()
  const endIso = new Date(Date.UTC(year, month + 1, 1)).toISOString()
  const label = `${year}-${String(month + 1).padStart(2, "0")}`

  // Snapshot davrlari. Hisoblanayotgan oy = [startIso, endIso).
  //   prevPeriod = o'sha oyning 1-sanasi   (oy BOSHIDAGI umrbod jami)
  //   snapPeriod = keyingi oyning 1-sanasi (oy OXIRIDAGI umrbod jami = bugun)
  // Oylik ko'rish = snapPeriod jami − prevPeriod jami
  const prevPeriod = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  const snapPeriod = new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 10)

  // Platformalar
  const { data: platforms } = await supabaseAdmin.from("social_platforms").select("id, key").is("deleted_at", null)
  const ytId = platforms?.find((p: { key: string }) => p.key === "youtube")?.id
  const igId = platforms?.find((p: { key: string }) => p.key === "instagram")?.id

  // Instagram admin tokeni (muddati tugagan bo'lsa yangilash)
  const { data: tok } = await supabaseAdmin
    .from("instagram_tokens").select("id, access_token, instagram_account_id, expires_at")
    .order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (tok && new Date(tok.expires_at) < new Date()) {
    const appId = Deno.env.get("FACEBOOK_APP_ID") || ""
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET") || ""
    try {
      const rr = await fetch(`https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tok.access_token}`)
      const rd = await rr.json()
      if (rd.access_token) {
        tok.access_token = rd.access_token
        await supabaseAdmin.from("instagram_tokens").update({
          access_token: rd.access_token,
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        }).eq("id", tok.id)
      }
    } catch { /* token yangilanmasa IG o'tkazib yuboriladi */ }
  }

  const { data: accounts } = await supabaseAdmin
    .from("social_accounts")
    .select("id, platform_id, profile_url")
    .is("deleted_at", null)
    .in("platform_id", [ytId, igId].filter(Boolean))

  const today = new Date().toISOString().slice(0, 10)
  /**
   * AKKAUNTLAR PARALLEL ISHLANADI.
   *
   * ILGARI KETMA-KET edi va Instagram eski usulda ishlaganda bu
   * yetardi: ro'yxat oyning boshigacha yetgach to'xtardi, ya'ni
   * akkauntiga 1-2 sahifa. Snapshot usuli esa BARCHA postlarni
   * ko'rishni talab qiladi — o'lchandi: o'rtacha 310 post, 50 tadan
   * 7 sahifa, 34 akkaunt uchun ~240 so'rov. Ketma-ket bajarilsa edge
   * funksiyaning 150 soniyasi yetmasdi.
   *
   * Bir vaqtda 3 ta. Ko'proq qilinsa Instagram Graph API
   * "(#4) Application request limit reached" qaytaradi — jonli
   * sinovda aynan shunday bo'lgan va hamma IG akkaunti
   * o'tkazib yuborilgan edi.
   *
   * Akkauntlar bir-biriga bog'liq emas — har biri o'z snapshotini va
   * o'z statistika qatorini yozadi.
   */
  type Natija = { platform: string; name: string; views: number; method: string } | null

  async function akkauntniHisobla(acc: { id: string; platform_id: string; profile_url: string }): Promise<Natija> {
    let views: number | null = 0
    let platform = ""
    let method = ""

    if (acc.platform_id === ytId) {
      const handle = extractHandle(String(acc.profile_url || ""))
      if (!handle) return null

      const lifetime = await ytLifetimeViews(handle)
      // API xatosi — akkauntni o'tkazib yuboramiz, eski qiymat saqlanadi
      if (lifetime === null) return null

      const r = await ayirmaYoZaxira(acc.id, lifetime, () => ytMonthViews(handle, startIso, endIso))
      views = r.views
      method = r.method
      platform = "yt"
    } else if (acc.platform_id === igId && tok?.instagram_account_id) {
      const uname = extractIgUsername(String(acc.profile_url || ""))
      if (!uname) return null

      /**
       * Instagram endi XUDDI YouTube kabi: umrbod jami olinadi va
       * o'tgan oynikidan ayiriladi. Zaxira — eski usul (o'sha oyda
       * joylangan postlar), u faqat birinchi yurishda ishlaydi.
       */
      const lifetime = await igLifetimeViews(tok.access_token, tok.instagram_account_id, uname)
      if (lifetime === null) return null

      const r = await ayirmaYoZaxira(acc.id, lifetime, () =>
        igMonthViews(tok.access_token, tok.instagram_account_id, uname, startIso, endIso))
      views = r.views
      method = r.method
      platform = "ig"
    } else return null

    // API xatosi (null) bo'lsa — eski qiymatni saqlab qolamiz, 0 bilan yozib yubormaymiz
    if (views === null) return null

    /**
     * OYLIK KO'RISH ALOHIDA USTUNGA yoziladi (`monthly_views`).
     *
     * ILGARI `views_count` ga yozilardi — o'sha ustunga profil
     * sinxronizatsiyasi ham yozadi va u BUTUNLAY BOSHQA narsani
     * bildiradi: YouTube uchun kanalning umrbod ko'rishi, Instagram
     * uchun esa layk+izoh yig'indisi.
     *
     * Natijada bloger profilini yangilashi bilan bosh sahifadagi
     * "Oylik ko'rishlar" umrbod raqamga sakrab ketardi va keyingi
     * oyning 1-sanasigacha shunday qolardi. Endi ikki qiymat
     * bir-biriga tegmaydi.
     */
    const { data: stat } = await supabaseAdmin
      .from("social_statistics").select("id")
      .eq("account_id", acc.id).is("deleted_at", null)
      .order("snapshot_date", { ascending: false }).limit(1).maybeSingle()
    if (stat) {
      await supabaseAdmin.from("social_statistics").update({ monthly_views: views }).eq("id", stat.id)
    } else {
      await supabaseAdmin.from("social_statistics")
        .insert({ account_id: acc.id, monthly_views: views, snapshot_date: today })
    }

    return { platform, name: String(acc.profile_url || ""), views, method }
  }

  /**
   * Umrbod jamini yozadi va oylik ko'rishni qaytaradi.
   *
   * Asosiy usul — o'tgan oynikidan ayirish. Snapshot yo'q bo'lsa
   * (birinchi yurish) yoki jami KAMAYGAN bo'lsa (video/post
   * o'chirilgan) zaxira usulga o'tiladi.
   */
  async function ayirmaYoZaxira(
    accountId: string,
    lifetime: number,
    zaxira: () => Promise<number | null>,
  ): Promise<{ views: number | null; method: string }> {
    // Bu oyning jamisi (qayta ishga tushirilsa yangilanadi)
    await supabaseAdmin.from("view_snapshots").upsert(
      { account_id: accountId, period: snapPeriod, lifetime_views: lifetime },
      { onConflict: "account_id,period" },
    )
    const { data: prevSnap } = await supabaseAdmin
      .from("view_snapshots").select("lifetime_views")
      .eq("account_id", accountId).eq("period", prevPeriod).maybeSingle()

    const prev = prevSnap ? Number(prevSnap.lifetime_views) : null
    // ASOSIY USUL: ayirma — eski video/postlar ko'rishlari ham ichida
    if (prev !== null && lifetime >= prev) return { views: lifetime - prev, method: "snapshot" }
    // ZAXIRA: snapshot yo'q (birinchi oy) yoki jami kamaygan (kontent o'chirilgan)
    return { views: await zaxira(), method: "zaxira" }
  }

  const barchasi = await parallelBajar(accounts || [], 3, akkauntniHisobla)
  const details = barchasi.filter((x): x is Exclude<Natija, null> => x !== null)
  const skipped = (accounts?.length || 0) - details.length

  let ytTotal = 0, igTotal = 0, ytCount = 0, igCount = 0
  let ytBySnapshot = 0, ytByUploads = 0
  let igBySnapshot = 0, igByPosts = 0
  for (const d of details) {
    if (d.platform === "yt") {
      ytTotal += d.views; ytCount++
      if (d.method === "snapshot") ytBySnapshot++; else ytByUploads++
    } else {
      igTotal += d.views; igCount++
      if (d.method === "snapshot") igBySnapshot++; else igByPosts++
    }
  }

  return jsonResponse({
    ok: true, month: label, skipped,
    snapshot_periods: { prev: prevPeriod, current: snapPeriod },
    youtube: {
      accounts: ytCount,
      views: ytTotal,
      // by_snapshot = to'g'ri usul; by_uploads = zaxira (kam ko'rsatadi)
      by_snapshot: ytBySnapshot,
      by_uploads: ytByUploads,
    },
    instagram: {
      accounts: igCount,
      views: igTotal,
      // by_snapshot = to'g'ri usul; by_posts = zaxira (birinchi yurish)
      by_snapshot: igBySnapshot,
      by_posts: igByPosts,
    },
    total_monthly_views: ytTotal + igTotal,
    top: details.sort((a, b) => b.views - a.views).slice(0, 10),
  })
})
