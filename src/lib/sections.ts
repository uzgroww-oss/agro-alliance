import { useEffect, useState } from "react"
import { api } from "./api"

/**
 * useHomeSection — homepage_sections DB'idan bo'lim sarlavha+tavsifini oladi.
 * Editor "Bosh sahifa" bo'limidan tahrirlaydi. fallback — DB bo'sh bo'lsa ishlatiladi.
 */
export function useHomeSection(key: string, fallback: { title: string; subtitle: string }) {
  const [sec, setSec] = useState(fallback)
  useEffect(() => {
    api<{ sections: { section_key: string; title?: string; subtitle?: string }[] }>("/public/homepage-sections")
      .then((d) => {
        const s = d.sections?.find((x) => x.section_key === key)
        if (s) setSec({ title: s.title || fallback.title, subtitle: s.subtitle || fallback.subtitle })
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return sec
}
