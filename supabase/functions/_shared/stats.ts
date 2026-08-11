import { supabaseAdmin } from "./supabase.ts"

export interface StatItem {
  key: string
  value: string
  label: string
}

function formatStatValue(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K+`
  return String(count)
}

/**
 * Jonli hisoblanadigan statistika:
 *  - bloggers: faol blogerlar soni
 *  - audience: barcha blogerlarning YouTube/Instagram obunachilari yig'indisi
 *  - views:    OYLIK ko'rishlar yig'indisi
 *  - regions:  blogerlar mavjud viloyatlar soni
 * Manba: blogger_social_summary view (har bir akkauntning eng so'nggi
 * social_statistics snapshotidan oladi).
 *
 * ⚠️ KO'RISHLAR UCHUN `total_monthly_views`, `total_views` EMAS.
 *
 * Bu yerdagi yorliq — "Oylik ko'rishlar", ya'ni raqam faqat
 * `cron-monthly-views` hisoblagan oylik qiymat bo'lishi kerak.
 * `total_views` esa `views_count` ustunidan keladi va unga profil
 * sinxronizatsiyasi yozadi: YouTube uchun kanalning UMRBOD ko'rishi,
 * Instagram uchun layk+izoh yig'indisi.
 *
 * Ilgari shu yerda `total_views` turardi va bloger o'z profilini
 * yangilashi bilan bosh sahifadagi raqam umrbod qiymatga sakrab
 * ketardi — keyingi oyning 1-sanasigacha shunday qolardi.
 * Qarang: 20240708000432 migratsiyasi.
 */
export async function getDynamicStats(): Promise<StatItem[]> {
  // 1. Blogerlar soni
  const { count: bloggerCount } = await supabaseAdmin
    .from("bloggers")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)

  // 2-3. Umumiy auditoriya (obunachilar) va ko'rishlar
  const { data: summary } = await supabaseAdmin
    .from("blogger_social_summary")
    .select("total_subscribers, total_monthly_views")
  let audienceCount = 0
  let viewsCount = 0
  for (const row of summary || []) {
    audienceCount += Number((row as Record<string, unknown>).total_subscribers || 0)
    viewsCount += Number((row as Record<string, unknown>).total_monthly_views || 0)
  }

  // 4. Viloyatlar — O'zbekistonning 12 viloyati bo'ylab qamrov (doimiy).
  // Takror viloyat sonni oshirmaydi, hech qachon 12 dan oshmaydi.
  const REGIONS_COUNT = 12

  return [
    { key: "bloggers", value: formatStatValue(bloggerCount || 0), label: "Agro blogerlar" },
    { key: "audience", value: formatStatValue(audienceCount), label: "Umumiy auditoriya" },
    { key: "views", value: formatStatValue(viewsCount), label: "Oylik ko'rishlar" },
    { key: "regions", value: String(REGIONS_COUNT), label: "Viloyatlar" },
  ]
}
