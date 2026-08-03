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
