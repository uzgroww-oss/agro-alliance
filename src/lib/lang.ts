/**
 * Til kodining YAGONA manbasi.
 *
 * Alohida kichik modul, chunki uni ikki tomon ishlatadi:
 *   - i18n.tsx (React konteksti, tarjima lug'ati)
 *   - api.ts   (React'dan tashqarida, so'rovga ?lang= qo'shadi)
 * Bittasi ikkinchisini import qilsa aylanma bog'liqlik hosil bo'lardi.
 */

export const LANGS = ["uz", "ru", "en", "zh"] as const
export type Lang = (typeof LANGS)[number]

export const LANG_STORAGE_KEY = "aa_lang"

/** Hozirgi til. React'dan tashqarida ham chaqirса bo'ladi. */
export function currentLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY)
    if (v && (LANGS as readonly string[]).includes(v)) return v as Lang
  } catch { /* localStorage yopiq bo'lishi mumkin */ }
  return "uz"
}

/* ==========================================================================
   TIL O'ZGARGANDA KESHLARNI TOZALASH
   ==========================================================================
   MUAMMO EDI: ba'zi modullar (sections.ts, settings.ts) o'z modul
   darajasidagi keshini saqlaydi. Ular til haqida bilmasdi, shuning uchun
   til almashtirilganda ESKI TILDAGI ma'lumotni qaytaraverardi —
   foydalanuvchi sahifani qo'lda yangilashga majbur bo'lardi.

   Endi har bir kesh o'zini shu yerga ro'yxatdan o'tkazadi va til
   almashganda hammasi birdan tozalanadi. Yangi kesh qo'shilganda uni
   ham shu yerga ulash kifoya — bitta joyni eslab qolish yetarli.
   ========================================================================== */

type Tozalovchi = () => void
const tozalovchilar = new Set<Tozalovchi>()

/** Modul o'z keshini tozalash funksiyasini ro'yxatdan o'tkazadi */
export function keshTozalovchiQosh(fn: Tozalovchi): void {
  tozalovchilar.add(fn)
}

/** Til almashganda chaqiriladi */
export function barchaKeshniTozala(): void {
  for (const fn of tozalovchilar) {
    try { fn() } catch { /* bittasi yiqilsa qolganlari tozalansin */ }
  }
}
