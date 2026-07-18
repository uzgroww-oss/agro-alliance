import { useEffect, useState } from "react"
import { api } from "./api"

type Section = { section_key: string; title?: string; subtitle?: string; items?: unknown[] }

/*
 * Bir sahifada bu hook bir necha marta chaqiriladi (hero, features, CTA...),
 * ustiga Footer ham xuddi shu endpointni so'raydi. Ilgari har biri alohida
 * so'rov yuborardi. Endi natija modul darajasida keshlanadi va bir vaqtda
 * ketayotgan so'rovlar bitta promise'ga birlashtiriladi.
 */
let cache: Section[] | null = null
let inFlight: Promise<Section[]> | null = null

function loadSections(): Promise<Section[]> {
  if (cache) return Promise.resolve(cache)
  if (inFlight) return inFlight
  inFlight = api<{ sections: Section[] }>("/public/homepage-sections")
    .then((d) => { cache = d.sections || []; return cache })
    .finally(() => { inFlight = null })
  return inFlight
}

/**
 * Barcha bo'limlarni bir marta oladi (kesh bilan). Bo'lim ichidagi `items`
 * kerak bo'lganda ishlating (Home hero kartalari, Footer aloqa qatorlari...).
 */
export function useHomeSections<T extends Section = Section>() {
  const [sections, setSections] = useState<T[]>((cache as T[]) || [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    let alive = true
    loadSections()
      .then((s) => { if (alive) setSections(s as T[]) })
      .catch(() => { /* chaqiruvchi bo'sh ro'yxatni ko'radi */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return { sections, loading }
}

/**
 * useHomeSection — homepage_sections DB'idan bo'lim sarlavha+tavsifini oladi.
 * Editor "Bosh sahifa" bo'limidan tahrirlaydi. fallback — DB bo'sh bo'lsa ishlatiladi.
 *
 * `loading` ni albatta ishlating: usiz fallback matn chizilib, keyin DB matniga
 * ko'z oldida almashadi (sahifa "sakraydi").
 */
export function useHomeSection(key: string, fallback: { title: string; subtitle: string }) {
  const [sec, setSec] = useState(fallback)
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    let alive = true
    loadSections()
      .then((sections) => {
        if (!alive) return
        const s = sections.find((x) => x.section_key === key)
        if (s) setSec({ title: s.title || fallback.title, subtitle: s.subtitle || fallback.subtitle })
      })
      .catch(() => { /* xatoda fallback matn qoladi */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { ...sec, loading }
}
