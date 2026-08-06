import { useEffect, useRef, useState } from "react"
import { Icon, I } from "../lib/ui"
import { LANGS, LANG_LABEL, LANG_SHORT, useI18n, type Lang } from "../lib/i18n"

/**
 * Til tanlash tugmasi.
 *
 * Ochiladigan ro'yxat: tor ekranda ham joy egallamasin va tillar o'z
 * yozuvida ko'rinsin (Русский, 中文) — foydalanuvchi o'zining tilini
 * tarjimasiz taniydi.
 */
export default function LangSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n()
  const [ochiq, setOchiq] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Tashqariga bosilganda yopiladi
  useEffect(() => {
    if (!ochiq) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOchiq(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [ochiq])

  const tanla = (l: Lang) => { setLang(l); setOchiq(false) }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOchiq((v) => !v)}
        /**
         * Ko'rinadigan matn ("UZ") nomning ICHIDA bo'lishi shart.
         * Ilgari nom "Til / Язык / Language / 语言" edi va ko'rinadigan
         * "UZ" unga kirmasdi — ovoz bilan boshqaradigan foydalanuvchi
         * "UZ tugmasini bos" desa, tizim tugmani topa olmasdi.
         */
        aria-label={`${LANG_SHORT[lang]} — Til / Язык / Language / 语言`}
        aria-expanded={ochiq}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-green/25 font-bold text-ink transition-colors hover:border-green hover:text-green ${
          compact ? "px-2 py-1.5 text-[11px]" : "px-2.5 py-2 text-xs"
        }`}
      >
        <Icon d={I.globe} className="h-3.5 w-3.5" />
        {LANG_SHORT[lang]}
        <Icon d={I.chevDown} className={`h-3 w-3 transition-transform ${ochiq ? "rotate-180" : ""}`} />
      </button>

      {ochiq && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[150px] overflow-hidden rounded-xl border border-green/15 bg-white py-1 shadow-xl">
          {LANGS.map((l) => (
            <button
              key={l}
              onClick={() => tanla(l)}
              className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm transition-colors hover:bg-soft ${
                l === lang ? "font-bold text-green" : "text-ink"
              }`}
            >
              {LANG_LABEL[l]}
              {l === lang && <Icon d={I.check} className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
