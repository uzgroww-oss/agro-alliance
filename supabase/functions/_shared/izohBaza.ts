import { supabaseAdmin } from "./supabase.ts"
import type { Platforma } from "./izohMatn.ts"

/**
 * IZOHLARGA JAVOB — BAZADAGI HISOB.
 *
 * Har bir javob (va javob berilmagani ham) shu yerga yoziladi. Uchta
 * sabab bor:
 *   1. TAKROR JAVOB BO'LMASIN. Tarmoqlarning hech biri "bu izohga
 *      javob berdikmi" degan savolga arzon javob bermaydi. Bu yerda
 *      (platforma, comment_id) juftligi YAGONA, ya'ni ikkinchi javob
 *      fizik jihatdan yozilmaydi.
 *   2. IZ QOLSIN. Avtomatik rejimda matn kanal nomidan ommaviy
 *      chiqadi — kim, qachon, nima yozganini keyin ko'rib bo'lmasa
 *      bu boshqarib bo'lmaydigan tizim.
 *   3. O'TKAZIB YUBORILGANLAR ham yoziladi: aks holda har yurishda AI
 *      o'sha spam izohni qayta ko'rib, bekorga token sarflardi.
 */

export type JavobHolat = "qoralama" | "yuborildi" | "otkazildi" | "xato"

export type JavobYozuv = {
  platform: Platforma
  comment_id: string
  /** Post/video/media identifikatori — ustun nomi tarixiy sabablarga ko'ra video_id */
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
 * `(platform, comment_id)` bo'yicha upsert — yagona indeks aynan shu
 * juftlikda va u bir izohga ikki marta javob yozilishini imkonsiz
 * qiladi.
 */
export async function yozuvSaqla(y: JavobYozuv): Promise<void> {
  await supabaseAdmin
    .from("izoh_javob")
    .upsert({ ...y, updated_at: new Date().toISOString() }, { onConflict: "platform,comment_id" })
}

/**
 * Qaysi izohlarga allaqachon tegilgan.
 *
 * `qoralama` HAM kiradi: tahririyat ko'rib chiqmagan qoralama bor
 * ekan, avtomatik yurish o'sha izohga yangi qoralama yozib, eskisini
 * bekorga almashtirmasligi kerak.
 */
export async function tegilganlar(platform: Platforma, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data } = await supabaseAdmin
    .from("izoh_javob")
    .select("comment_id")
    .eq("platform", platform)
    .in("comment_id", ids.slice(0, 200))
  return new Set((data || []).map((r: { comment_id: string }) => r.comment_id))
}

/** Ro'yxat uchun: shu izohlar bo'yicha bizdagi yozuvlar */
export async function yozuvlarOl(platform: Platforma, ids: string[]) {
  if (ids.length === 0) return new Map<string, Record<string, unknown>>()
  const { data } = await supabaseAdmin
    .from("izoh_javob")
    .select("comment_id, javob, holat, sabab, avto, provayder, yuborilgan_at")
    .eq("platform", platform)
    .in("comment_id", ids.slice(0, 200))
  return new Map(
    (data || []).map((r: Record<string, unknown>) => [String(r.comment_id), r]),
  )
}

/** Bitta izohning holati — takror yuborishga qarshi tekshiruv uchun */
export async function holatOl(platform: Platforma, commentId: string): Promise<JavobHolat | null> {
  const { data } = await supabaseAdmin
    .from("izoh_javob")
    .select("holat")
    .eq("platform", platform)
    .eq("comment_id", commentId)
    .maybeSingle()
  return (data?.holat as JavobHolat) || null
}
