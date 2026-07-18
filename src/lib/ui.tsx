/* eslint-disable react-refresh/only-export-components */

import { useEffect, useRef, useState, type ReactNode } from "react"
import { api } from "./api"

/* ---------- Skeleton loader ---------- */
const shimmer = "animate-shimmer bg-gradient-to-r from-gray-100 via-gray-200/60 to-gray-100 bg-[length:200%_100%]"

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`${shimmer} rounded-lg ${className}`} />
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)] ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={`h-5 ${j === 0 ? "w-48" : j === cols - 1 ? "w-24" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonStatGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export const logo = "/logo.webp"
/** Oq (shaffof fonli) logo — to'q fon uchun, masalan footer */
export const logoWhite = "/logo-white.webp"

/* ---------- Shared helpers ---------- */
export const fmtSom = (n: number | null | undefined) => {
  if (n == null) return "0"
  if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + " mlrd"
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + " mln"
  return n.toLocaleString("ru-RU")
}

/* ---------- Scroll reveal ---------- */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (el.classList.add("in"), io.unobserve(el)),
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/* ---------- Inline icon paths ---------- */
export const I = {
  brain: "M9.5 2a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3 3 0 0 0 6 15a3 3 0 0 0 3.5 3V2zM14.5 2a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2A3 3 0 0 1 18 15a3 3 0 0 1-3.5 3V2z",
  task: "M9 11l3 3 8-8M3 7h6M3 12h4M3 17h6",
  doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h4",
  trophy: "M8 21h8 M12 17v4 M7 4h10v4a5 5 0 0 1-10 0V4z M5 6H3v1a3 3 0 0 0 3 3 M19 6h2v1a3 3 0 0 0-3 3",
  play: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M10 8l6 4-6 4V8z",
  robot: "M12 2v4 M5 10h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z M9 15h.01 M15 15h.01 M2 14h1 M21 14h1",
  sprout: "M7 20h10 M12 20v-8 M12 12C12 8 9 6 5 6c0 4 3 6 7 6z M12 12c0-3 2-5 6-5 0 3-2 5-6 5z",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  media: "M2 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z M10 9l4 3-4 3V9z",
  chart: "M3 3v18h18 M7 14l3-4 4 3 4-6",
  send: "M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7z",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8",
  building: "M3 21h18 M5 21V7l8-4v18 M19 21V11l-6-3 M9 9v.01 M9 12v.01 M9 15v.01 M9 18v.01",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z",
  leaf: "M11 20A7 7 0 0 1 4 13c0-6 7-11 16-11 0 9-5 16-9 18z M11 20c0-4 2-7 6-9",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  gem: "M6 3h12l4 6-10 12L2 9z M11 3 8 9l4 12 4-12-3-6 M2 9h20",
  check: "M20 6 9 17l-5-5",
  login: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z",
  chevDown: "M6 9l6 6 6-6",
  chevLeft: "M15 18l-6-6 6-6",
  chevRight: "M9 18l6-6-6-6",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  cow: "M5 8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z M9 14v3a3 3 0 0 0 6 0v-3 M5 8L3 6 M19 8l2-2 M9 9h.01 M15 9h.01",
  cpu: "M9 3v2 M15 3v2 M9 19v2 M15 19v2 M3 9h2 M3 15h2 M19 9h2 M19 15h2 M5 5h14v14H5z M9 9h6v6H9z",
  shield: "M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z M9 12l2 2 4-4",
  briefcase: "M3 7h18v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 13h18",
  dots: "M5 12h.01 M12 12h.01 M19 12h.01",
  tree: "M12 22v-6 M9 16h6 M12 2l4 6h-3l3 5H8l3-5H8z",
  verified: "M12 2l2.4 2.4 3.3-.6.6 3.3L22 12l-2.4 2.4.6 3.3-3.3.6L12 22l-2.4-2.4-3.3.6-.6-3.3L2 12l2.4-2.4-.6-3.3 3.3.6z M9 12l2 2 4-4",
  pin: "M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  youtube: "M22 8a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3z M10 9l5 3-5 3V9z",
  instagram: "M2 6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z M16 11.4a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M17.5 6.5h.01",
  tiktok: "M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5",
  telegram: "M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7z",
  whatsapp: "M3 21l1.6-5A8 8 0 1 1 8 19.3z M9 9c0 4 2 6 6 6 M9 9c0-1 .5-2 1.5-1.5L12 9l-1 1 M15 15c1 0 2-.5 1.5-1.5L15 11l-1 1",
  mail: "M3 5h18v14H3z M3 6l9 7 9-7",
  bolt: "M13 2 3 14h7l-1 8 10-12h-7z",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  cap: "M22 10 12 5 2 10l10 5 10-5z M6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5 M22 10v6",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z M10 6l8-4v18l-8-4 M19 9a3 3 0 0 1 0 6",
  wallet: "M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3 M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3 M21 11h-5a2 2 0 0 0 0 4h5z",
  quote: "M7 7H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v-2H5V9h2z M17 7h-2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v-2h-2V9h2z",
  flask: "M9 2h6 M10 2v6L5 18a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V2 M7 14h10",
  tractor: "M4 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0z M17 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0z M7 17h7 M4 14V8h6l2 4h3 M10 8V5h4l3 7 M7 14V8",
  handshake: "M11 17l2 2a1 1 0 0 0 1.5-.2 M13 19l1.5 1.5a1 1 0 0 0 1.5-.2 M14.8 18.3l1 1a1 1 0 0 0 1.5-1.4l-3.5-3.5 M2 9l3-3 5 1 4 4-1.5 1.5a2 2 0 0 1-2.8 0L11 12l-3 3a1.4 1.4 0 0 1-2-2l1-1 M22 9l-3-3-4 1",
  globe2: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
  headset: "M3 18v-6a9 9 0 0 1 18 0v6 M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z",
  paperclip: "M21 8l-9.6 9.6a4 4 0 0 1-5.7-5.7L13.5 4a3 3 0 0 1 4.2 4.2l-7.8 7.8a1.5 1.5 0 0 1-2.1-2.1l7.1-7.1",
  facebook: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
  plus: "M12 5v14 M5 12h14",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  lock: "M5 11h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4",
  eyeOff: "M9.9 5a10 10 0 0 1 2.1-.2c6.5 0 10 7 10 7a13 13 0 0 1-2 3 M6.6 6.6A13 13 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6 M1 1l22 22 M9.5 9.5a3 3 0 0 0 4.2 4.2",
  question: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01",
  home: "M3 11l9-8 9 8 M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5 M9 21v-7h6v7",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 18.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0",
  external: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  link2: "M9 17H7A5 5 0 0 1 7 7h2 M15 7h2a5 5 0 0 1 0 10h-2 M8 12h8",
  dashboard: "M3 3h8v8H3z M13 3h8v5h-8z M13 11h8v10h-8z M3 13h8v8H3z",
  image: "M15 3h6v6 M9 21h-4a2 2 0 0 1-2-2v-4 M21 9v10a2 2 0 0 1-2 2h-10 M3 15l4-4 2 2 4-4 2 2",
  fileText: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  refresh: "M3 12a9 9 0 0 1 15-6.7L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15 6.7L3 16 M3 21v-5h5",
}

export function Icon({ d, className = "h-6 w-6", sw = 1.8 }: { d: string; className?: string; sw?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {d.split(" M").map((seg, i) => (
        <path key={i} d={i === 0 ? seg : "M" + seg} />
      ))}
    </svg>
  )
}

/* ---------- Shared data ---------- */
// stat key -> icon (qiymat va label backenddan keladi)
export const statIcon: Record<string, string> = {
  bloggers: I.users,
  audience: I.globe,
  views: I.play,
  regions: I.pin,
}
export type StatItem = { key: string; value: string; label: string }

// default (backend yuklanmaguncha / xato bo'lsa ko'rsatiladi)
export const defaultStats: StatItem[] = [
  { key: "bloggers", value: "0", label: "Agro blogerlar" },
  { key: "audience", value: "0", label: "Umumiy auditoriya" },
  { key: "views", value: "0", label: "Oylik ko'rishlar" },
  { key: "regions", value: "0", label: "Viloyatlar" },
]

export const navLinks: { label: string; to: string }[] = [
  { label: "BOSH SAHIFA", to: "/" },
  { label: "BIZ HAQIMIZDA", to: "/about" },
  { label: "BLOGERLAR", to: "/blogerlar" },
  // { label: "PLATFORMA", to: "/platforma" }, // vaqtincha berkitilgan (sahifa /platforma'da qoladi)
  { label: "YANGILIKLAR", to: "/yangiliklar" },
  { label: "HAMKORLAR", to: "/hamkorlar" },
  { label: "ALOQA", to: "/aloqa" },
]

/* ---------- Shared Stats bar (qiymatlar admin panel yoki default) ---------- */
function StatsBarSkeleton() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-4 lg:px-8">
      <div className="grid grid-cols-2 gap-y-7 rounded-3xl border border-green/10 bg-white px-6 py-8 shadow-[0_10px_40px_rgba(91,180,32,0.08)] lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 px-2">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-green/10 bg-gray-100">
              <div className="h-5 w-5 rounded bg-gray-200" />
            </span>
            <div className="flex-1">
              <div className="mb-1 h-6 w-16 rounded bg-gray-200" />
              <div className="h-3 w-20 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function StatsBar() {
  const [items, setItems] = useState<StatItem[] | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    api<{ stats: StatItem[] }>("/public/stats")
      .then((d) => { if (alive && Array.isArray(d.stats) && d.stats.length) { setItems(d.stats); setLoaded(true) } })
      .catch(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [])

  if (!loaded) return <StatsBarSkeleton />
  const display = items ?? defaultStats

  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-4 lg:px-8">
      <Reveal>
        <div className="grid grid-cols-2 gap-y-7 rounded-3xl border border-green/10 bg-white px-6 py-8 shadow-[0_10px_40px_rgba(91,180,32,0.08)] lg:grid-cols-4">
          {display.map((s) => (
            <div key={s.key} className="flex items-center gap-3 px-2">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-green/20 text-green">
                <Icon d={statIcon[s.key] || I.star} className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-2xl font-extrabold leading-none">{s.value}</div>
                <div className="mt-1 text-xs font-medium text-muted">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  )
}
