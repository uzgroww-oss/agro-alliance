import { useEffect } from "react"

/**
 * SEO — sahifa sarlavhasi, tavsifi va ijtimoiy tarmoq (Open Graph) teglari.
 *
 * MUHIM: bu fayl IKKI joyda ishlatiladi —
 *   1) brauzerda `useSeo()` orqali (sahifadan sahifaga o'tganda yangilanadi)
 *   2) build vaqtida scripts/generate-seo.mjs orqali (har marshrut uchun
 *      alohida HTML yoziladi, shunda Google/Yandex va Telegram ko'rish
 *      uchun JS ishlatishi shart emas)
 * Shuning uchun statik ma'lumot shu yerda saqlanadi — ikkalasi bir xil bo'lsin.
 */

import seoData from "./seo-data.json"

export const SITE_URL = seoData.site.url
export const SITE_NAME = seoData.site.name
export const DEFAULT_IMAGE = seoData.site.image

export type SeoData = {
  title: string
  description: string
  /** Sahifaga xos rasm (bloger avatari, yangilik rasmi). Bo'lmasa logo. */
  image?: string
  /** "website" yoki "article" */
  type?: string
  /** Indekslanmasin (login, kabinet sahifalari) */
  noindex?: boolean
}

/**
 * Statik marshrutlar meta ma'lumoti — seo-data.json da.
 * MUHIM: bu JSON ni build skripti (scripts/generate-seo.mjs) ham o'qiydi,
 * shuning uchun brauzerdagi va HTML dagi meta teglar hech qachon ajralmaydi.
 */
export const STATIC_SEO: Record<string, SeoData> = seoData.routes

/** Bloger profili uchun meta (build skripti ham shu funksiyani takrorlaydi) */
export function bloggerSeo(b: { name: string; tag?: string; region?: string; cat?: string; subs?: string; avatar?: string }): SeoData {
  const parts = [b.tag, b.region].filter(Boolean).join(", ")
  return {
    title: `${b.name} — agro bloger${b.region ? `, ${b.region}` : ""} | Agro Alliance`,
    description: `${b.name} — O'zbekistondagi agro bloger.${parts ? ` ${parts}.` : ""}${b.subs ? ` ${b.subs} obunachi.` : ""} Statistika, ijtimoiy tarmoqlar va hamkorlik uchun ma'lumot.`,
    image: b.avatar || DEFAULT_IMAGE,
    type: "profile",
  }
}

/** Yangilik sahifasi uchun meta */
export function newsSeo(n: { title: string; desc?: string; image?: string }): SeoData {
  return {
    title: `${n.title} | Agro Alliance`,
    description: n.desc || "Agro Alliance — qishloq xo'jaligi yangiliklari.",
    image: n.image || DEFAULT_IMAGE,
    type: "article",
  }
}

/* ---------------- Brauzerda meta teglarni yangilash ---------------- */

function setMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement("link")
    el.setAttribute("rel", rel)
    document.head.appendChild(el)
  }
  el.setAttribute("href", href)
}

/** Statik sahifalar uchun qisqartma: useStaticSeo("/blogerlar") */
export function useStaticSeo(path: string) {
  useSeo(STATIC_SEO[path] ?? null, path)
}

/**
 * Sahifa meta teglarini yangilaydi. Har bir ommaviy sahifada chaqiriladi.
 * `data` null bo'lsa (ma'lumot hali yuklanmagan) hech narsa qilinmaydi —
 * shunda oldingi sahifaning sarlavhasi qolmaydi, statik HTML niki turadi.
 */
export function useSeo(data: SeoData | null, path?: string) {
  useEffect(() => {
    if (!data) return
    const url = `${SITE_URL}${path ?? window.location.pathname}`
    const image = data.image || DEFAULT_IMAGE

    document.title = data.title
    setMeta('meta[name="description"]', "name", "description", data.description)
    setLink("canonical", url)
    setMeta('meta[name="robots"]', "name", "robots", data.noindex ? "noindex, nofollow" : "index, follow")

    setMeta('meta[property="og:title"]', "property", "og:title", data.title)
    setMeta('meta[property="og:description"]', "property", "og:description", data.description)
    setMeta('meta[property="og:url"]', "property", "og:url", url)
    setMeta('meta[property="og:image"]', "property", "og:image", image)
    setMeta('meta[property="og:type"]', "property", "og:type", data.type || "website")
    setMeta('meta[property="og:site_name"]', "property", "og:site_name", SITE_NAME)

    setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image")
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", data.title)
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", data.description)
    setMeta('meta[name="twitter:image"]', "name", "twitter:image", image)
  }, [data, path])
}
