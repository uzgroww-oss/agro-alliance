import { ulanishOl, ytFetch } from "./youtubeAuth.ts"
import type { UmumIzoh } from "./izohTur.ts"

/**
 * YOUTUBE IZOHLARI — O'QISH VA JAVOB YOZISH.
 *
 * KVOTA. YouTube kuniga 10 000 birlik beradi:
 *   commentThreads.list —  1 birlik
 *   videos.list         —  1 birlik
 *   comments.insert     — 50 birlik
 * Soatiga bir yurish + sozlamadagi chegara (odatda 20 javob) —
 * javobsiz izoh ko'p bo'lgan kunda ham kvota yetadi, odatdagi kunda
 * esa bir necha birlik sarflanadi.
 *
 * RUXSAT: `youtube.force-ssl` shart — `comments.insert` boshqa hech
 * qanday ruxsat bilan ishlamaydi. U keyin qo'shilgan, ya'ni ESKI
 * ULANISH YETMAYDI: Google ruxsatlarni tokenga ulangan paytda
 * biriktiradi. 403 xatosi aynan shunday tushuntiriladi.
 */

const API = "https://www.googleapis.com/youtube/v3"

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
 * ancha arzon: bitta so'rov butun kanalni qamrab oladi.
 *
 * `order=time` — eng yangisi birinchi. Avtomatik yurish uchun aynan
 * shu kerak: eski izohlarga endi javob berishning ma'nosi kam.
 */
export async function youtubeIzohlar(
  limit = 50,
): Promise<{ ok: boolean; izohlar: UmumIzoh[]; xato: string }> {
  const kanal = await kanalIdOl()
  if (!kanal) return { ok: false, izohlar: [], xato: "Kanal aniqlanmadi — YouTube ulanishini tekshiring" }

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
      ? "YouTube: izohlar uchun ruxsat yo'q — kanalni QAYTA ulang (yangi ruxsat: izohlarni boshqarish)"
      : r.xato
    return { ok: false, izohlar: [], xato: aniq }
  }

  const items = (r.data.items as Record<string, any>[]) || []
  const sarlavhalar = await sarlavhalarOl(items.map((it) => String(it.snippet?.videoId || "")))

  const izohlar: UmumIzoh[] = items.map((it) => {
    const top = it.snippet?.topLevelComment
    const s = top?.snippet || {}
    const javoblar = (it.replies?.comments as Record<string, any>[]) || []
    const videoId = String(it.snippet?.videoId || "")
    const id = String(top?.id || it.id || "")
    return {
      id,
      postId: videoId,
      postTitle: sarlavhalar.get(videoId) || "",
      havola: videoId ? `https://www.youtube.com/watch?v=${videoId}&lc=${id}` : "",
      muallif: String(s.authorDisplayName || ""),
      ozimizmi: String(s.authorChannelId?.value || "") === kanal,
      matn: String(s.textOriginal || s.textDisplay || ""),
      vaqt: String(s.publishedAt || ""),
      yoqtirish: Number(s.likeCount ?? 0),
      javobMumkin: it.snippet?.canReply !== false,
      /**
       * Kanal O'ZI javob berganmi. Bu bazadagi tekshiruvga QO'SHIMCHA:
       * tahririyat YouTube'da qo'lda javob bergan bo'lsa, AI ustiga
       * ikkinchisini yozmasligi kerak.
       */
      javobBerilgan: javoblar.some((c) => String(c.snippet?.authorChannelId?.value || "") === kanal),
    }
  }).filter((x) => x.id)

  return { ok: true, izohlar, xato: "" }
}

/**
 * Izohga javob yuboradi.
 *
 * `parentId` — yuqori darajadagi izohning ID si. YouTube javobning
 * javobini qo'llab-quvvatlamaydi: ip ichidagi har qanday javob
 * baribir yuqori darajadagi izohga ulanadi.
 */
export async function youtubeJavob(parentId: string, matn: string): Promise<{ ok: boolean; xato: string }> {
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
      ? "YouTube: javob yuborish uchun kanalni QAYTA ulang (yangi ruxsat: izohlarni boshqarish)"
      : r.xato
    return { ok: false, xato: aniq }
  }
  return { ok: true, xato: "" }
}
