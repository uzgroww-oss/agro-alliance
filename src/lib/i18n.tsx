/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import ru from "../locales/ru.json"
import en from "../locales/en.json"
import zh from "../locales/zh.json"
import { LANGS, LANG_STORAGE_KEY, currentLang, type Lang } from "./lang"
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
const DICTS: Record<Lang, Dict> = {
  uz: {},            // o'zbekcha — manba til, tarjima kerak emas
  ru: ru as Dict,
  en: en as Dict,
  zh: zh as Dict,
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
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ahamiyatsiz */ }
    // MUHIM: keshlangan javoblar ESKI tilda. Tozalamasak, til
    // almashtirilgach yangiliklar 30 soniya davomida eski tilda turadi.
    clearApiCache()
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
