/**
 * TZ HISOBOTI UCHUN UMUMIY YORDAMCHILAR.
 *
 * Videolar alohida jadvalda emas — ular `profiles.metadata.videos`
 * ichida JSON massiv sifatida yotadi. Bir nechta endpoint shu
 * massivdan raqam olishi kerak, shuning uchun mantiq bir joyda.
 */

/** `profiles.metadata.videos` ichidagi bitta yozuv */
export type TirikVideo = {
  id: string
  name: string
  link: string
  views: string
  likes: string
  comments: string
  plats: string[]
  date: string
  thumbnail: string | null
  partner_id: string | null
  blogger_id: string
}

/**
 * Ko'rishlar MATN sifatida saqlanadi va manbaga qarab har xil
 * ko'rinishda bo'ladi: "12500", "12.5K", "1,2M". Hisoblashdan oldin
 * songa keltiriladi.
 */
export function sonGa(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  if (typeof v !== "string") return 0
  const s = v.trim().replace(/\s/g, "").replace(",", ".")
  const m = s.match(/^([\d.]+)\s*([KkMmBb])?$/)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return 0
  const k = (m[2] || "").toLowerCase()
  return Math.round(n * (k === "k" ? 1e3 : k === "m" ? 1e6 : k === "b" ? 1e9 : 1))
}

/**
 * Profillardan barcha videolarni `id` bo'yicha xaritaga yig'adi.
 *
 * MUHIM: video `id` si GLOBAL YAGONA EMAS — ikki bloger bir xil
 * YouTube havolasini qo'shsa ikkalasida ham bir xil id bo'ladi.
 * Shuning uchun bu xarita faqat TIRIK RAQAMNI topish uchun: kim
 * bajargani `blogger_task_videos.blogger_id` dan olinadi, bu yerdan
 * emas.
 */
export function tirikVideolar(profillar: Record<string, unknown>[]): Map<string, TirikVideo> {
  const xarita = new Map<string, TirikVideo>()
  for (const p of profillar) {
    const meta = (p.metadata as Record<string, unknown>) || {}
    for (const v of ((meta.videos as Record<string, unknown>[]) || [])) {
      const id = String(v.id || "")
      if (!id) continue
      xarita.set(id, {
        id,
        name: String(v.name || ""),
        link: String(v.link || ""),
        views: String(v.views ?? "0"),
        likes: String(v.likes ?? "0"),
        comments: String(v.comments ?? "0"),
        plats: (v.plats as string[]) || [],
        date: String(v.date || ""),
        thumbnail: (v.thumbnail as string) || null,
        partner_id: (v.partner_id as string) || null,
        blogger_id: String(p.id || ""),
      })
    }
  }
  return xarita
}

/**
 * KO'RISH SONI ISHONCHLIMI?
 *
 * Faqat YouTube raqamlari API orqali yangilanadi (me-partner ichida,
 * soatiga bir marta). Instagram postlari ATAYLAB "0" bilan saqlanadi,
 * TikTok/Telegram/Facebook uchun esa hech kim raqam yozmaydi.
 *
 * Bunday videoni jami ko'rishga qo'shish hisobotni YOLG'ON qiladi:
 * hamkor "reklama ishlamadi" degan xulosaga keladi, holbuki raqam
 * shunchaki noma'lum. Shuning uchun ular alohida sanaladi va
 * interfeysda "ma'lumot yo'q" deb belgilanadi.
 */
export function raqamIshonchlimi(plats: string[], views: unknown): boolean {
  const yt = (plats || []).some((p) => String(p).toLowerCase().includes("youtube"))
  if (yt) return true
  // YouTube bo'lmasa faqat noldan katta qo'lda kiritilgan raqamga ishonamiz
  return sonGa(views) > 0
}
