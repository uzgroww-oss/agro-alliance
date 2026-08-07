import { supabaseAdmin } from "./supabase.ts"
import { ulanishOl, ytFetch } from "./youtubeAuth.ts"

/**
 * YOUTUBE IZOHLARI — O'QISH VA JAVOB YOZISH.
 *
 * Bu yerda faqat YouTube bilan muloqot va bazadagi hisob turadi.
 * Javob MATNINI yozish — `izohJavob.ts` da, sof mantiq esa
 * `izohMatn.ts` da. Uchalasini ikki joy ishlatadi: paneldagi
 * tugmalar (`youtube-manage`) va avtomatik yurish (`jobs/yt-izoh`).
 *
 * KVOTA. YouTube kuniga 10 000 birlik beradi:
 *   commentThreads.list —  1 birlik
 *   videos.list         —  1 birlik
 *   comments.insert     — 50 birlik
 * Ya'ni soatiga bir yurish + 20 tagacha javob kuniga ~24 000 emas,
 * ~24 x (1 + 1 + 20x50) = juda ko'p bo'lardi. Shuning uchun bitta
 * yurishdagi javoblar soni sozlamada cheklangan (odatda 20) va
 * yurish soatiga bir marta bo'ladi. Eng yomon holatda 24 x 1002 =
 * chegaradan oshadi, shuning uchun avtomatik yurish JAVOB BERILMAGAN
 * izoh qolmasa darhol to'xtaydi va odatdagi kunda bir necha birlik
 * sarflaydi.
 */

const API = "https://www.googleapis.com/youtube/v3"

export type YtIzoh = {
  /** Yuqori darajadagi izoh identifikatori — javob shunga ulanadi */
  id: string
  videoId: string
  videoTitle: string
  muallif: string
  /** Muallifning kanal ID si — o'z izohimizni ajratish uchun */
  muallifKanal: string
  matn: string
  vaqt: string
  yoqtirish: number
  /** Ipga javob yozish mumkinmi (yopilgan bo'lishi mumkin) */
  javobMumkin: boolean
  /** Kanalning O'ZI shu ipga allaqachon javob berganmi */
  javobBerilgan: boolean
}

/**
 * Kanal ID sini oladi.
 *
 * Odatda `smm_connections` da saqlangan bo'ladi. Bo'lmasa YouTube'dan
 * so'raladi — ulanish eski bo'lsa (kanal ID yozilmasdan oldin
 * ulangan) bu yagona yo'l.
 */
export async function kanalIdOl(): Promise<string> {
  const cfg = await ulanishOl()
  if (cfg?.channel_id) return cfg.channel_id
  const r = await ytFetch(`${API}/channels?part=id&mine=true`)
  if (!r.ok) return ""
  const items = r.data.items as { id?: string }[] | undefined
  return items?.[0]?.id || ""
}

/** Video sarlavhalari — bitta so'rovda hammasi (kvota 1 birlik) */
async function sarlavhalarOl(videoIds: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  const uniq = [...new Set(videoIds.filter(Boolean))].slice(0, 50)
  if (uniq.length === 0) return m
  const r = await ytFetch(`${API}/videos?part=snippet&id=${uniq.join(",")}`)
  if (!r.ok) return m
  for (const it of (r.data.items as Record<string, any>[]) || []) {
    m.set(String(it.id), String(it.snippet?.title || ""))
  }
  return m
}

/**
 * Kanalning barcha videolariga tushgan so'nggi izohlar.
 *
 * `allThreadsRelatedToChannelId` — video bo'yicha aylanib chiqishdan
 * ancha arzon: bitta so'rov butun kanalni qamrab oladi. Video bo'yicha
 * yurilsa har video uchun alohida so'rov kerak bo'lardi.
 *
 * `order=time` — eng yangisi birinchi. Avtomatik yurish uchun aynan
 * shu kerak: eski izohlarga endi javob berishning ma'nosi kam.
 */
export async function izohlarniOl(
  limit = 50,
): Promise<{ ok: boolean; izohlar: YtIzoh[]; xato: string; kanal: string }> {
  // Kanal ID ni O'ZI qaytaradi: chaqiruvchiga ham kerak (o'z izohini
  // ajratish uchun), ikki marta so'rash esa bekorga so'rov bo'lardi.
  const kanal = await kanalIdOl()
  if (!kanal) return { ok: false, izohlar: [], kanal: "", xato: "Kanal aniqlanmadi — YouTube ulanishini tekshiring" }

  const r = await ytFetch(
    `${API}/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${kanal}` +
    `&maxResults=${Math.min(100, Math.max(1, limit))}&order=time&textFormat=plainText`,
  )
  if (!r.ok) {
    /**
     * 403 bu yerda deyarli har doim BITTA narsani anglatadi: ulanishda
     * `youtube.force-ssl` ruxsati yo'q. Umumiy "YouTube xatosi" degan
     * xabar foydalanuvchini kunlab adashtirardi.
     */
    const aniq = r.status === 403
      ? "Izohlarni o'qish uchun kanalni QAYTA ulash kerak (yangi ruxsat: izohlarni boshqarish)"
      : r.xato
    return { ok: false, izohlar: [], kanal, xato: aniq }
  }

  const items = (r.data.items as Record<string, any>[]) || []
  const sarlavhalar = await sarlavhalarOl(items.map((it) => String(it.snippet?.videoId || "")))

  const izohlar: YtIzoh[] = items.map((it) => {
    const top = it.snippet?.topLevelComment
    const s = top?.snippet || {}
    const javoblar = (it.replies?.comments as Record<string, any>[]) || []
    const videoId = String(it.snippet?.videoId || "")
    return {
      id: String(top?.id || it.id || ""),
      videoId,
      videoTitle: sarlavhalar.get(videoId) || "",
      muallif: String(s.authorDisplayName || ""),
      muallifKanal: String(s.authorChannelId?.value || ""),
      matn: String(s.textOriginal || s.textDisplay || ""),
      vaqt: String(s.publishedAt || ""),
      yoqtirish: Number(s.likeCount ?? 0),
      javobMumkin: it.snippet?.canReply !== false,
      /**
       * Kanal O'ZI javob berganmi. `replies` faqat oxirgi bir nechta
       * javobni qaytaradi, lekin bizga yetarli: o'z javobimiz bo'lsa
       * u odatda oxirgilardan biri.
       *
       * Bu YAGONA tekshiruv emas — asosiy himoya bazadagi yagona
       * `comment_id`. Bu esa QO'LDA yozilgan javoblarni ham hisobga
       * oladi: tahririyat YouTube'da o'zi javob bergan bo'lsa, AI
       * ustiga ikkinchi javob yozmasligi kerak.
       */
      javobBerilgan: javoblar.some((c) => String(c.snippet?.authorChannelId?.value || "") === kanal),
    }
  }).filter((x) => x.id)

  return { ok: true, izohlar, kanal, xato: "" }
}

/**
 * Izohga javob yuboradi.
 *
 * `parentId` — yuqori darajadagi izohning ID si. YouTube javobning
 * javobini qo'llab-quvvatlamaydi: ip ichidagi har qanday javob
 * baribir yuqori darajadagi izohga ulanadi.
 */
export async function javobYubor(parentId: string, matn: string): Promise<{ ok: boolean; xato: string }> {
  const t = matn.trim()
  if (!parentId) return { ok: false, xato: "Izoh ID kerak" }
  if (!t) return { ok: false, xato: "Javob matni bo'sh" }

  const r = await ytFetch(`${API}/comments?part=snippet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snippet: { parentId, textOriginal: t.slice(0, 10_000) } }),
  })
  if (!r.ok) {
    const aniq = r.status === 403
      ? "Javob yuborish uchun kanalni QAYTA ulash kerak (yangi ruxsat: izohlarni boshqarish)"
      : r.xato
    return { ok: false, xato: aniq }
  }
  return { ok: true, xato: "" }
}

/* ==========================================================================
   BAZADAGI HISOB
   ========================================================================== */

export type JavobHolat = "qoralama" | "yuborildi" | "otkazildi" | "xato"

export type JavobYozuv = {
  comment_id: string
  video_id: string
  video_title?: string
  muallif?: string
  izoh: string
  javob?: string | null
  holat: JavobHolat
  sabab?: string | null
  avto?: boolean
  provayder?: string | null
  izoh_vaqti?: string | null
  yuborilgan_at?: string | null
}

/**
 * Yozuvni saqlaydi (bori yangilanadi).
 *
 * `comment_id` bo'yicha upsert: yagona indeks shu ustunda va aynan
 * shu narsa bir izohga ikki marta javob yozilishini imkonsiz qiladi.
 */
export async function yozuvSaqla(y: JavobYozuv): Promise<void> {
  await supabaseAdmin
    .from("yt_izoh_javob")
    .upsert({ ...y, updated_at: new Date().toISOString() }, { onConflict: "comment_id" })
}

/**
 * Qaysi izohlarga allaqachon tegilgan.
 *
 * `qoralama` HAM kiradi: tahririyat ko'rib chiqmagan qoralama bor
 * ekan, avtomatik yurish o'sha izohga yangi qoralama yozib,
 * eskisini bekorga almashtirmasligi kerak.
 */
export async function tegilganlar(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data } = await supabaseAdmin
    .from("yt_izoh_javob")
    .select("comment_id")
    .in("comment_id", ids.slice(0, 200))
  return new Set((data || []).map((r: { comment_id: string }) => r.comment_id))
}
