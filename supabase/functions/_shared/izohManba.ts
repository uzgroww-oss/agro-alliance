import type { Platforma } from "./izohMatn.ts"
import type { UmumIzoh } from "./izohTur.ts"
import { youtubeIzohlar, youtubeJavob } from "./ytIzoh.ts"
import { facebookIzohlar, facebookJavob, instagramIzohlar, instagramJavob } from "./metaIzoh.ts"
import { telegramIzohlar, telegramJavob, telegramOffsetSaqla } from "./tgIzoh.ts"

/**
 * TARMOQ ADAPTERLARI — YAGONA KIRISH NUQTASI.
 *
 * Har tarmoq izohni butunlay boshqacha qaytaradi va javobni boshqacha
 * qabul qiladi. Panel va avtomatik yurish esa hammasi bilan BIR XIL
 * ishlashi kerak, aks holda bir xil mantiq to'rt marta yozilardi.
 *
 * Shuning uchun bu yerda faqat ikkita amal bor: izohlarni olish va
 * javob yuborish. Qolgan hamma narsa — AI, tekshiruvlar, baza,
 * takrorga qarshi himoya — platformaga bog'liq emas va bir joyda.
 */

export type Manba = {
  izohlar: (limit: number) => Promise<{ ok: boolean; izohlar: UmumIzoh[]; xato: string }>
  javob: (id: string, matn: string) => Promise<{ ok: boolean; xato: string }>
  /**
   * Yurish OXIRIDA chaqiriladi (bo'lsa). Hozircha faqat Telegram uchun:
   * u o'qilgan yangilanishlarni yopadi. Boshqalarda kerak emas —
   * ularda izohlar hech qayerga yo'qolmaydi.
   */
  yakunla?: () => Promise<void>
}

const MANBALAR: Record<Platforma, Manba> = {
  youtube: { izohlar: youtubeIzohlar, javob: youtubeJavob },
  instagram: { izohlar: instagramIzohlar, javob: instagramJavob },
  facebook: { izohlar: facebookIzohlar, javob: facebookJavob },
  telegram: { izohlar: telegramIzohlar, javob: telegramJavob, yakunla: telegramOffsetSaqla },
}

export function manbaOl(p: Platforma): Manba {
  return MANBALAR[p]
}
