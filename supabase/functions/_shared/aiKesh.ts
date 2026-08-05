import { supabaseAdmin } from "./supabase.ts"

/**
 * AI NATIJALARI KESHI VA SARF HISOBI.
 *
 * NEGA KESH: bir xil matn qayta-qayta AI ga yuborilardi. Tarjima
 * mantig'i versiyasi o'zgargan sari BUTUN kontent qaytadan tarjima
 * qilinardi — matnning o'zi o'zgarmagan bo'lsa ham. Bitta to'ldirish
 * yuzlab chaqiruvga aylanib, Gemini kvotasi shundan tugagan edi.
 *
 * Endi natija MATN XESHI bo'yicha saqlanadi: matn o'zgarmasa AI
 * umuman chaqirilmaydi.
 *
 * NEGA SARF HISOBI: "AI qancha ishlatilyapti, qaysi provayder
 * yiqilyapti?" degan savolga javob yo'q edi. Endi har chaqiruv
 * yoziladi va uni panelda ko'rish mumkin.
 */

/** Matndan barqaror xesh — SHA-256, 16 lik ko'rinishda */
export async function xeshla(matn: string): Promise<string> {
  const bayt = new TextEncoder().encode(matn)
  const xesh = await crypto.subtle.digest("SHA-256", bayt)
  return [...new Uint8Array(xesh)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Keshdan o'qish. Topilmasa `null`.
 *
 * Kesh xatosi ISH TO'XTATMAYDI: baza javob bermasa AI chaqiriladi,
 * ya'ni eng yomon holatda avvalgidek ishlaydi.
 */
export async function keshdanOl<T>(
  vazifa: string,
  xesh: string,
  /**
   * Eng katta yosh (ms). Berilsa undan eski yozuv YO'Q hisoblanadi.
   *
   * Tarjimaga kerak emas — matn o'zgarmasa tarjima ham eskirmaydi.
   * Lekin yangiliklar va tarmoq raqamlari kabi VAQTGA bog'liq
   * ma'lumot uchun shart: eski kontekstdan tuzilgan reja noto'g'ri
   * bo'lardi.
   */
  engKattaYosh?: number,
): Promise<T | null> {
  try {
    const { data } = await supabaseAdmin
      .from("ai_cache")
      .select("id, natija, hits, created_at")
      .eq("vazifa", vazifa)
      .eq("xesh", xesh)
      .maybeSingle()
    if (!data) return null
    if (engKattaYosh !== undefined) {
      const yosh = Date.now() - new Date(data.created_at as string).getTime()
      if (!(yosh >= 0) || yosh > engKattaYosh) return null
    }
    // Ishlatilgan vaqtni yangilaymiz — eskirganini keyin tozalash uchun.
    // Javobni KUTMAYMIZ: bu yozuv natijaga ta'sir qilmaydi.
    supabaseAdmin.from("ai_cache")
      .update({ used_at: new Date().toISOString(), hits: Number(data.hits || 0) + 1 })
      .eq("id", data.id as string)
      .then(() => {}, () => {})
    return data.natija as T
  } catch {
    return null
  }
}

/** Keshga yozish. Xato bo'lsa jimgina o'tkazib yuboriladi. */
export async function keshgaYoz(
  vazifa: string,
  xesh: string,
  natija: unknown,
  model?: string,
): Promise<void> {
  try {
    const hozir = new Date().toISOString()
    await supabaseAdmin.from("ai_cache").upsert(
      // `created_at` ATAYLAB qo'lda yoziladi: upsert mavjud qatorni
      // yangilaganda default ishlamaydi va yosh eskiligicha qolardi —
      // TTL bilan o'qiydiganlar yangilangan qiymatni ham "eski" deb
      // rad etib yuborardi.
      { vazifa, xesh, natija, model: model ?? null, created_at: hozir, used_at: hozir },
      { onConflict: "vazifa,xesh" },
    )
  } catch { /* kesh ixtiyoriy */ }
}

/**
 * Har bir AI chaqiruvini yozadi.
 *
 * `tokenlar` aniq bo'lmasligi mumkin — hamma provayder ham qaytarmaydi.
 * Bo'lmasa matn uzunligidan chamalanadi: 4 belgi ≈ 1 token. Bu taxmin,
 * lekin nisbatni ko'rsatishga yetadi va yo'qligidan yaxshiroq.
 */
export async function sarfYoz(q: {
  provayder: string
  vazifa: string
  muvaffaqiyat: boolean
  matnUzunligi?: number
  tokenlar?: number
  davomiylik?: number
  xato?: string
}): Promise<void> {
  try {
    const tokenlar = q.tokenlar ?? (q.matnUzunligi ? Math.ceil(q.matnUzunligi / 4) : null)
    await supabaseAdmin.from("ai_usage").insert({
      provayder: q.provayder,
      vazifa: q.vazifa,
      muvaffaqiyat: q.muvaffaqiyat,
      tokenlar,
      davomiylik: q.davomiylik ?? null,
      xato: q.xato ? q.xato.slice(0, 300) : null,
    })
  } catch { /* hisob ixtiyoriy — ish to'xtamasin */ }
}
