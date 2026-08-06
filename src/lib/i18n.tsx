/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { LANGS, LANG_STORAGE_KEY, currentLang, barchaKeshniTozala, type Lang } from "./lang"
import { clearApiCache } from "./api"

/**
 * KO'P TILLILIK
 *
 * Yondashuv: KALIT — o'zbekcha matnning O'ZI.
 *   t("Blogerlar")  ->  ru: "Блогеры"  en: "Bloggers"  zh: "博主"
 *
 * Nega kalit o'ylab topilmaydi (masalan "nav.bloggers"):
 *   - kodni o'qiganda matn ko'rinib turadi, kalitni izlash shart emas
 *   - tarjima topilmasa o'zbekcha matn chiqadi, ya'ni sayt HECH QACHON
 *     bo'sh yoki "nav.bloggers" kabi ko'rinmaydi
 *   - yangi matn qo'shilganda sayt buzilmaydi, shunchaki tarjimasiz qoladi
 *
 * Til localStorage'da saqlanadi va <html lang> ga yoziladi (SEO va
 * ekran o'quvchilar uchun).
 */

export { LANGS }
export type { Lang }

/** Tanlash menyusida ko'rinadigan nomlar — har biri O'Z tilida */
export const LANG_LABEL: Record<Lang, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
  zh: "中文",
}

export const LANG_SHORT: Record<Lang, string> = {
  uz: "UZ", ru: "RU", en: "EN", zh: "ZH",
}

type Dict = Record<string, string>

/**
 * LUG'ATLAR TALAB BO'YICHA YUKLANADI.
 *
 * MUAMMO EDI: uchala tilning lug'ati (jami 239 KB, siqilganda 81 KB)
 * HAR bir tashrifchiga yuklanardi — hatto o'zbek tilida kirgan odamga
 * ham, garchi unga lug'at UMUMAN kerak bo'lmasa ham. O'zbekcha manba
 * til: kalitning o'zi tarjima.
 *
 * Endi faqat JORIY til yuklanadi. O'zbek tilida kirgan foydalanuvchi
 * hech narsa yuklamaydi, boshqalar esa bittasini oladi.
 *
 * `tr()` va `t()` SINXRON bo'lib qoladi — bu shart, chunki ular
 * komponent tashqarisida ham chaqiriladi. Sinxronlikni saqlash uchun
 * lug'at ILOVA ISHGA TUSHISHIDAN OLDIN yuklanadi (qarang: main.tsx
 * va `lugatniTayyorla`).
 */
const DICTS: Record<Lang, Dict> = {
  uz: {},            // o'zbekcha — manba til, tarjima kerak emas
  ru: {},
  en: {},
  zh: {},
}

/** Qaysi tillar allaqachon yuklangan */
const yuklangan = new Set<Lang>(["uz"])
/** Ayni paytda yuklanayotganlar — bir xil so'rov ikki marta ketmasin */
const yuklanmoqda = new Map<Lang, Promise<void>>()

/**
 * Tilning lug'atini yuklaydi. O'zbekcha uchun darhol tugaydi.
 *
 * Yuklab bo'lmasa (tarmoq uzilgan) XATO OTMAYDI: lug'at bo'sh qoladi
 * va sayt o'zbekcha matn bilan ishlayveradi. Bu "hech narsa
 * ko'rinmaydi" dan ancha yaxshi.
 */
export async function lugatniTayyorla(lang: Lang): Promise<void> {
  if (yuklangan.has(lang)) return
  const bor = yuklanmoqda.get(lang)
  if (bor) return bor

  const ish = (async () => {
    try {
      /**
       * Vite dinamik importni tahlil qila olishi uchun yo'l ANIQ
       * yozilgan. `import(\`../locales/${lang}.json\`)` deb yozilsa
       * u BARCHA json fayllarni bitta bo'lakka yig'ib qo'yardi va
       * butun foyda yo'qolardi.
       */
      const mod = lang === "ru" ? await import("../locales/ru.json")
        : lang === "en" ? await import("../locales/en.json")
        : lang === "zh" ? await import("../locales/zh.json")
        : null
      if (mod) DICTS[lang] = (mod.default || mod) as Dict
    } catch {
      // Lug'atsiz qolamiz — o'zbekcha matn chiqadi
    } finally {
      yuklangan.add(lang)
      yuklanmoqda.delete(lang)
    }
  })()

  yuklanmoqda.set(lang, ish)
  return ish
}

const STORAGE_KEY = LANG_STORAGE_KEY

function boshlangichTil(): Lang {
  try {
    const saqlangan = currentLang()
    if (localStorage.getItem(STORAGE_KEY)) return saqlangan
    // Brauzer tili — faqat BIRINCHI tashrifda
    const brauzer = navigator.language.slice(0, 2).toLowerCase()
    if (brauzer === "ru") return "ru"
    if (brauzer === "en") return "en"
    if (brauzer === "zh") return "zh"
  } catch { /* localStorage yopiq bo'lishi mumkin */ }
  return "uz"
}

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  /** Tarjima. Topilmasa o'zbekcha matnning o'zi qaytadi. */
  t: (uz: string) => string
}

const I18nCtx = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => boshlangichTil())

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    /**
     * LUG'AT AVVAL YUKLANADI, KEYIN TIL ALMASHADI.
     *
     * Tartib muhim: `setLangState` daraxtni qayta mount qiladi va
     * shu zahoti `tr()` chaqiriladi. Lug'at hali yetib kelmagan
     * bo'lsa, barcha matn o'zbekcha chiqib, keyin ikkinchi marta
     * almashardi — ekranda ko'rinadigan "sakrash" bo'lardi.
     *
     * Lug'at odatda keshdan keladi (bir marta yuklangach), shuning
     * uchun kutish sezilmaydi.
     */
    void lugatniTayyorla(l).then(() => setLangState(l))
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ahamiyatsiz */ }
    // MUHIM: keshlangan javoblar ESKI tilda. Tozalamasak, til
    // almashtirilgach yangiliklar 30 soniya davomida eski tilda turadi.
    clearApiCache()
    // Modullarning O'Z keshlari ham (sections, settings) — ular til
    // haqida bilmaydi va tozalanmasa eski tilni qaytaraverardi.
    // Aynan shu sabab foydalanuvchi sahifani qo'lda yangilashga
    // majbur bo'lardi.
    barchaKeshniTozala()
  }, [])

  const t = useCallback(
    (uz: string): string => {
      if (lang === "uz") return uz
      return DICTS[lang][uz] ?? uz
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

/**
 * Provayder yetib bormasa ham sayt ishlashda davom etsin — o'zbekcha
 * matn qaytariladi. (auth.tsx dagi bilan bir xil ehtiyot chorasi.)
 */
const ZAXIRA: Ctx = { lang: "uz", setLang: () => {}, t: (uz) => uz }

export function useI18n(): Ctx {
  return useContext(I18nCtx) ?? ZAXIRA
}

/** Qisqa yozuv: const t = useT() */
export function useT(): (uz: string) => string {
  return useI18n().t
}

/**
 * HOOKSIZ tarjima.
 *
 * NEGA KERAK: panellarda (admin, bloger, hamkor) 500 dan ortiq matn bor
 * va ular 40 dan ortiq komponentga tarqalgan. Har biriga `useT()` hook
 * qo'shish — 40 ta alohida o'zgarish va har birida xato qilish ehtimoli.
 *
 * `tr()` tilni to'g'ridan-to'g'ri localStorage'dan o'qiydi, shuning
 * uchun uni istalgan joyda — komponent tashqarisida, massiv e'lonida,
 * shartli ifodada — chaqirsa bo'ladi.
 *
 * SHARTI: til o'zgarganda daraxt QAYTA MOUNT bo'lishi kerak, aks holda
 * eski matn ekranda qolib ketadi. Buni App.tsx dagi `key={lang}` hal
 * qiladi.
 */
export function tr(uz: string): string {
  const l = currentLang()
  if (l === "uz") return uz
  return DICTS[l][uz] ?? uz
}
