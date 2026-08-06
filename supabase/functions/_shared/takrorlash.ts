/**
 * TZ TAKRORLANISHI.
 *
 * Hamkor "har kuni", "har hafta" yoki "har oy" bajariladigan TZ bera
 * oladi. Har davr uchun ALOHIDA topshiriq yaratiladi — shusiz bloger
 * bir marta "bajarildi" bosib qo'ysa, u abadiy bajarilgan bo'lib
 * turaverardi va takrorlanishning ma'nosi qolmasdi.
 */

export type Takror = "bir_marta" | "kunlik" | "haftalik" | "oylik"

export const TAKRORLAR: readonly Takror[] = ["bir_marta", "kunlik", "haftalik", "oylik"]

export function takrorYaroqli(v: unknown): v is Takror {
  return typeof v === "string" && (TAKRORLAR as readonly string[]).includes(v)
}

/**
 * Keyingi takror vaqtini hisoblaydi.
 *
 * OYLIK uchun `setUTCMonth` ishlatiladi va u qisqa oylarda kunni
 * o'zi to'g'rilaydi: 31-yanvardan keyingisi 3-mart emas, 28/29-fevral
 * bo'lishi kerak. Shuning uchun kun alohida cheklab qo'yiladi —
 * aks holda fevralda ikki marta o'tkazib yuborilardi.
 */
export function keyingiVaqt(dan: Date, takror: Takror): Date | null {
  if (takror === "bir_marta") return null
  const d = new Date(dan.getTime())
  if (takror === "kunlik") {
    d.setUTCDate(d.getUTCDate() + 1)
    return d
  }
  if (takror === "haftalik") {
    d.setUTCDate(d.getUTCDate() + 7)
    return d
  }
  // oylik
  const kun = d.getUTCDate()
  d.setUTCDate(1)                       // avval 1-kunga tushamiz
  d.setUTCMonth(d.getUTCMonth() + 1)    // keyin oyni oshiramiz
  // Keyingi oyning oxirgi kuni
  const oxirgi = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(kun, oxirgi))
  return d
}

/** Kechikish variantlari — hamkor shulardan tanlaydi */
export const KECHIKISHLAR: Record<string, number> = {
  darhol: 0,
  "2soat": 2 * 3600_000,
  "6soat": 6 * 3600_000,
  "1kun": 24 * 3600_000,
  "3kun": 3 * 24 * 3600_000,
}

/**
 * Boshlanish vaqtini aniqlaydi.
 *
 * Ikki yo'l bor: tayyor kechikish ("2 soatdan keyin") yoki aniq
 * sana-vaqt. Ikkalasi ham bo'lmasa — darhol.
 */
export function boshlanishVaqti(kechikish: unknown, aniqVaqt: unknown): Date {
  const s = String(aniqVaqt || "").trim()
  if (s) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d
  }
  const ms = KECHIKISHLAR[String(kechikish || "darhol")] ?? 0
  return new Date(Date.now() + ms)
}

export function takrorNomi(t: Takror): string {
  if (t === "kunlik") return "Har kuni"
  if (t === "haftalik") return "Har hafta"
  if (t === "oylik") return "Har oy"
  return "Bir marta"
}
