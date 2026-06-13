import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Reveal, Icon, I } from "../lib/ui"

const mascotCam = "/mascot3.png"
const mascotPoint = "/mascot.png"
import { findBlogger, cover } from "../lib/bloggers"
import { api } from "../lib/api"

type Live = {
  slug: string; name: string; status: string
  profile?: Record<string, string>
  socials?: { id: number; platform: string; link: string; name?: string; avatar?: string; subscribers?: string }[]
  videos?: { id: number; name: string; link: string; views: string; plats?: string[]; date: string; thumbnail?: string; author?: string }[]
}

const platIconMap: Record<string, string> = { YouTube: I.youtube, Instagram: I.instagram, TikTok: I.tiktok, Telegram: I.telegram, Facebook: I.facebook }
const fullUrl = (l: string) => (/^https?:\/\//i.test(l) ? l : "https://" + l)

/* ---------- Template content (demo) ---------- */
const videos = [
  { t: "Issiqxonada pomidor yetishtirish sirlari", views: "125K ko'rish", when: "2 kun oldin", dur: "10:45", seed: "elyor-v1" },
  { t: "Bodring hosildorligini oshirishning 5 usuli", views: "98K ko'rish", when: "5 kun oldin", dur: "10:32", seed: "elyor-v2" },
  { t: "Qalampir parvarishi va oziqlantirish usullari", views: "76K ko'rish", when: "1 hafta oldin", dur: "14:20", seed: "elyor-v3" },
]
const achievements = [
  { icon: I.trophy, t: "TOP Bloger", s: "2024" },
  { icon: I.shield, t: "Eng faol fermer", s: "bloger 2023" },
  { icon: I.trophy, t: "Agro Expo", s: "ishtirokchisi" },
  { icon: I.shield, t: "10+ brend", s: "hamkorlik" },
]
const services = ["Reklama integratsiya", "Mahsulot review", "Brend bilan kollaboratsiya", "Farm tur va vlog"]
const ageBars = [
  { l: "18-24", v: 18 },
  { l: "25-34", v: 42 },
  { l: "35-44", v: 25 },
  { l: "45+", v: 15 },
]
const topRegions = [
  { l: "Toshkent", v: 38 },
  { l: "Toshkent viloyati", v: 22 },
  { l: "Farg'ona viloyati", v: 12 },
  { l: "Namangan viloyati", v: 8 },
  { l: "Boshqalar", v: 20 },
]
const brands = ["UZ-GROW", "Biokit", "Syngenta", "Green House", "Avgust", "Yara"]
const tabs = ["KONTENTLAR", "STATISTIKA", "HAMKORLIKLAR", "SHARHLAR"]

/* ---------- Donut ---------- */
function Donut({ pct }: { pct: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const green = (pct / 100) * c
  return (
    <svg viewBox="0 0 130 130" className="h-36 w-36 -rotate-90">
      <circle cx="65" cy="65" r={r} fill="none" stroke="#3b82f6" strokeWidth="16" />
      <circle cx="65" cy="65" r={r} fill="none" stroke="#5bb420" strokeWidth="16" strokeDasharray={`${green} ${c - green}`} strokeLinecap="round" />
    </svg>
  )
}

/* ---------- Sections ---------- */
function Header({ b, live }: { b: ReturnType<typeof findBlogger>; live: Live | null }) {
  const name = live?.name || b.name
  const region = live?.profile?.region || b.region
  const subtitle = live?.profile?.tag || "Issiqxona va fermerlik blogeri"
  const avatar = live?.profile?.photo || `https://i.pravatar.cc/240?img=13`
  const liveSocials = live?.socials || []
  return (
    <div className="relative overflow-hidden rounded-3xl border border-green/10 bg-white shadow-[0_12px_44px_rgba(91,180,32,0.10)]">
      {/* greenhouse fills the whole card */}
      <img src="/hero-bg.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-tr from-white/92 via-white/55 to-white/15" />

      {/* mascot — inside the card, centered */}
      <img src={mascotCam} alt="" className="animate-float pointer-events-none absolute bottom-0 left-1/2 z-10 hidden h-[12.5rem] -translate-x-1/2 object-contain drop-shadow-2xl xl:block" />

      {/* REYTING card — far right */}
      <div className="absolute right-5 top-5 z-20 hidden w-52 rounded-2xl border border-green/10 bg-white/95 p-5 shadow-[0_10px_30px_rgba(91,180,32,0.18)] backdrop-blur lg:block">
        <div className="flex items-center gap-2 text-green">
          <Icon d={I.trophy} className="h-5 w-5" /><span className="font-display text-sm font-bold tracking-wide">REYTING</span>
        </div>
        <div className="mt-3 flex items-end gap-1">
          <span className="font-display text-4xl font-extrabold text-green leading-none">4.9</span>
          <span className="mb-1 text-sm text-muted">/5.0</span>
        </div>
        <div className="mt-1.5 flex gap-0.5 text-green">{Array.from({ length: 5 }).map((_, i) => <svg key={i} viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z" /></svg>)}</div>
        <div className="mt-4 border-t border-green/10 pt-3">
          <div className="font-display text-lg font-extrabold">TOP 1%</div>
          <div className="text-xs text-muted">Agro bloggerlar orasida</div>
        </div>
      </div>

      {/* content */}
      <div className="relative px-6 pb-5 pt-16 lg:px-8 lg:pr-[15rem]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="relative shrink-0">
            <img src={avatar} alt={name} className="h-32 w-32 rounded-full object-cover ring-4 ring-white shadow-xl" />
            <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-green text-white ring-2 ring-white">
              <Icon d="M9 12l2 2 4-4" className="h-4 w-4" sw={2.5} />
            </span>
          </div>
          <div className="min-w-0 pb-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
              <Icon d={I.verified} className="h-6 w-6 shrink-0 text-green" />
            </div>
            <p className="mt-1 text-muted">{subtitle}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Icon d={I.pin} className="h-4 w-4 text-green" /> {region}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(liveSocials.length > 0
                ? liveSocials.map((s) => ({ key: s.id, href: fullUrl(s.link), d: platIconMap[s.platform] || I.link2, title: s.name || s.platform }))
                : [I.youtube, I.instagram, I.tiktok, I.telegram].map((d, i) => ({ key: i, href: "#", d, title: "" }))
              ).map((s) => (
                <a key={s.key} href={s.href} target="_blank" rel="noreferrer" title={s.title} className="grid h-9 w-9 place-items-center rounded-lg bg-soft text-green transition-colors hover:bg-green hover:text-white">
                  <Icon d={s.d} className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function StatsRow({ b }: { b: ReturnType<typeof findBlogger> }) {
  const items = [
    { icon: I.users, v: b.subs, l: "Obunachilar" },
    { icon: I.play, v: "870K+", l: "Oylik ko'rishlar" },
    { icon: I.chart, v: b.eng, l: "Engagement" },
    { icon: I.users, v: "320+", l: "Hamkorliklar" },
    { icon: I.star, v: String(b.rating), l: "Reyting" },
    { icon: I.trophy, v: "3 yil+", l: "Faoliyat tajribasi" },
  ]
  return (
    <Reveal>
      <div className="grid grid-cols-2 gap-y-6 rounded-3xl border border-green/10 bg-white px-6 py-7 shadow-[0_10px_40px_rgba(91,180,32,0.08)] sm:grid-cols-3 lg:grid-cols-6">
        {items.map((s) => (
          <div key={s.l} className="flex items-center gap-3 px-2">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-soft text-green">
              <Icon d={s.icon} className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-xl font-extrabold leading-none">{s.v}</div>
              <div className="mt-1 text-[11px] text-muted">{s.l}</div>
            </div>
          </div>
        ))}
      </div>
    </Reveal>
  )
}

function About() {
  const meta = [
    ["Nish", "Issiqxona, Sabzavotchilik"],
    ["Yo'nalish", "Fermerlik"],
    ["Joylashuv", "Toshkent viloyati"],
    ["Tillar", "O'zbek, Rus"],
  ]
  const tags = ["#Issiqxona", "#Fermerlik", "#Sabzavot", "#AgroTex"]
  return (
    <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
      <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">HAQIDA</h3>
      <dl className="mt-4 space-y-2.5 text-sm">
        {meta.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="font-semibold text-ink/80">{k}:</dt>
            <dd className="text-muted">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        3 yildan beri issiqxona va fermerlik sohasida kontent yarataman. Maqsadim —
        fermerlarga foydali va amaliy bilimlarni soddalashtirib yetkazish.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="rounded-lg bg-soft px-2.5 py-1 text-xs font-semibold text-green">{t}</span>
        ))}
      </div>
    </div>
  )
}

function AiCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white shadow-lg">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-green/30 blur-2xl" />
      <div className="flex items-center gap-2 text-green">
        <Icon d={I.brain} className="h-5 w-5" />
        <span className="font-display text-sm font-bold tracking-wide">AI ASSISTANT</span>
      </div>
      <p className="mt-2 text-sm text-white/70">Elyor bilan AI orqali bog'laning!</p>
      <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105">
        <Icon d={I.bolt} className="h-4 w-4" /> AI CHAT
      </button>
    </div>
  )
}

function QuickContact() {
  const items = [
    { icon: I.telegram, l: "Telegram" },
    { icon: I.whatsapp, l: "WhatsApp" },
    { icon: I.instagram, l: "Instagram" },
    { icon: I.mail, l: "Email yuborish" },
  ]
  return (
    <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
      <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">TEZ ALOQA</h3>
      <div className="mt-4 space-y-2.5">
        {items.map((x) => (
          <a key={x.l} href="#" className="flex items-center gap-3 rounded-xl bg-soft px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-green hover:text-white">
            <Icon d={x.icon} className="h-4 w-4 text-green group-hover:text-white" /> {x.l}
          </a>
        ))}
      </div>
    </div>
  )
}

function Content({ live }: { live: Live | null }) {
  const [tab, setTab] = useState("KONTENTLAR")
  const liveVids = live?.videos || []
  return (
    <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
      <div className="flex flex-wrap gap-6 border-b border-green/10">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative pb-3 font-display text-sm font-bold tracking-wide transition-colors ${tab === t ? "text-green" : "text-ink/50 hover:text-ink"}`}
          >
            {t}
            {tab === t && <span className="absolute -bottom-px left-0 h-0.5 w-full bg-green" />}
          </button>
        ))}
      </div>

      {tab === "KONTENTLAR" && (
        liveVids.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {liveVids.map((v) => (
              <a key={v.id} href={fullUrl(v.link)} target="_blank" rel="noreferrer" className="group block">
                <div className="relative overflow-hidden rounded-xl">
                  <img src={v.thumbnail || cover("v" + v.id)} alt={v.name} className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/15" />
                  <span className="absolute inset-0 grid place-items-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-green"><Icon d={I.play} className="h-5 w-5" /></span></span>
                  {v.plats?.[0] && <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">{v.plats[0]}</span>}
                </div>
                <h4 className="mt-3 font-semibold leading-snug transition-colors group-hover:text-green">{v.name}</h4>
                <p className="mt-1 text-xs text-muted">{v.views} ko'rish · {v.date}</p>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {videos.map((v) => (
              <div key={v.t} className="group">
                <div className="relative overflow-hidden rounded-xl">
                  <img src={cover(v.seed)} alt={v.t} className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/15" />
                  <span className="absolute inset-0 grid place-items-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-green"><Icon d={I.play} className="h-5 w-5" /></span></span>
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">{v.dur}</span>
                </div>
                <h4 className="mt-3 font-semibold leading-snug">{v.t}</h4>
                <p className="mt-1 text-xs text-muted">{v.views} · {v.when}</p>
              </div>
            ))}
          </div>
        )
      )}
      {tab === "STATISTIKA" && (
        <div className="mt-6 space-y-3">
          {[["O'rtacha ko'rishlar", 85], ["Engagement darajasi", 87], ["Obunachi o'sishi", 72], ["Kontent faolligi", 90]].map(([l, v]) => (
            <div key={l as string}>
              <div className="mb-1 flex justify-between text-sm"><span className="text-muted">{l}</span><span className="font-bold text-green">{v}%</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-green" style={{ width: `${v}%` }} /></div>
            </div>
          ))}
        </div>
      )}
      {tab === "HAMKORLIKLAR" && (
        <div className="mt-6 flex flex-wrap gap-3">
          {brands.map((br) => (
            <span key={br} className="rounded-xl border border-green/15 bg-soft px-4 py-3 font-display text-sm font-bold">{br}</span>
          ))}
        </div>
      )}
      {tab === "SHARHLAR" && (
        <div className="mt-6 space-y-4">
          {[["Sardor Y.", "Juda foydali kontent, fermerligimga katta yordam berdi!"], ["Madina R.", "Issiqxona bo'yicha eng yaxshi bloger. Tavsiya qilaman."]].map(([n, t]) => (
            <div key={n} className="rounded-xl bg-soft p-4">
              <div className="flex items-center gap-1 text-green">{Array.from({ length: 5 }).map((_, i) => <Icon key={i} d={I.star} className="h-3.5 w-3.5" />)}</div>
              <p className="mt-2 text-sm text-ink/80">"{t}"</p>
              <p className="mt-1 text-xs font-semibold text-muted">— {n}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AchievementsAndServices() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
        <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">YUTUQLARI</h3>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {achievements.map((a) => (
            <div key={a.t} className="rounded-xl bg-soft p-3 text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-gold"><Icon d={a.icon} className="h-5 w-5" /></span>
              <div className="mt-2 text-xs font-bold leading-tight">{a.t}</div>
              <div className="text-[10px] text-muted">{a.s}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
        <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">XIZMATLARI</h3>
        <ul className="mt-4 space-y-3">
          {services.map((s) => (
            <li key={s} className="flex items-center gap-2.5 text-sm">
              <Icon d={I.check} className="h-4 w-4 text-green" sw={2.4} /> {s}
            </li>
          ))}
        </ul>
        <a href="#" className="mt-5 flex items-center justify-center gap-2 rounded-xl border-2 border-green/25 bg-white px-4 py-2.5 text-sm font-bold transition-colors hover:border-green hover:text-green">
          BATAFSIL KO'RISH <Icon d={I.arrow} className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}

function Analytics() {
  return (
    <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
      <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">AUDITORIYA ANALITIKASI</h3>
      <div className="mt-5 flex items-center justify-center gap-6">
        <div className="relative grid place-items-center">
          <Donut pct={68} />
          <div className="absolute text-center">
            <div className="font-display text-2xl font-extrabold text-green">68%</div>
            <div className="text-[10px] text-muted">Erkaklar</div>
          </div>
        </div>
        <div className="text-center">
          <div className="font-display text-2xl font-extrabold text-blue-500">32%</div>
          <div className="text-xs text-muted">Ayollar</div>
        </div>
      </div>

      <div className="mt-6 space-y-2.5">
        {ageBars.map((a) => (
          <div key={a.l} className="flex items-center gap-3 text-sm">
            <span className="w-12 text-muted">{a.l}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-green" style={{ width: `${a.v / 42 * 100}%` }} /></div>
            <span className="w-9 text-right font-semibold">{a.v}%</span>
          </div>
        ))}
      </div>

      <h4 className="mt-6 font-display text-sm font-bold tracking-wide text-ink/80">Top hududlar</h4>
      <ul className="mt-3 space-y-2 text-sm">
        {topRegions.map((r) => (
          <li key={r.l} className="flex justify-between"><span className="text-muted">{r.l}</span><span className="font-semibold">{r.v}%</span></li>
        ))}
      </ul>
    </div>
  )
}

function Brands() {
  return (
    <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
      <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">HAMKOR BO'LGAN BRENDLAR</h3>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {brands.map((b) => (
          <div key={b} className="grid h-16 place-items-center rounded-xl border border-green/10 bg-soft text-center font-display text-xs font-bold text-ink/70">{b}</div>
        ))}
      </div>
    </div>
  )
}

function Efficiency() {
  // line chart points (x,y) in a 0..100 box; y inverted
  const pts = [
    { x: 12, y: 70, l: "6.1%", sub: "Avg 3 oy" },
    { x: 50, y: 45, l: "7.8%", sub: "Avg 6 oy" },
    { x: 88, y: 22, l: "8.7%", sub: "" },
  ]
  const poly = pts.map((p) => `${p.x},${p.y}`).join(" ")
  return (
    <Reveal>
      <div className="relative mt-6 overflow-hidden rounded-3xl bg-ink p-8 text-white">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-green/20 blur-3xl" />
        <img src={mascotPoint} alt="" className="animate-float absolute bottom-0 right-6 hidden h-40 object-contain drop-shadow-2xl lg:block" />
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h3 className="font-display text-sm font-bold tracking-widest text-white/70">HAMKORLIK SAMARADORLIGI</h3>
            <div className="mt-3 font-display text-5xl font-extrabold text-green">8.7%</div>
            <div className="text-white/70">Yuqori Engagement</div>
            <p className="mt-3 text-sm text-white/50">O'rtacha ko'rsatkichdan <span className="font-bold text-green">2.3x yuqori</span></p>

            <div className="relative mt-6 h-28 max-w-md">
              <svg viewBox="0 0 100 90" preserveAspectRatio="none" className="h-full w-full">
                <polyline points={poly} fill="none" stroke="#5bb420" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="2.6" fill="#5bb420" stroke="#0a0a0a" strokeWidth="1" />
                ))}
              </svg>
              {pts.map((p, i) => (
                <div key={i} className="absolute -translate-x-1/2 text-center" style={{ left: `${p.x}%`, top: `${p.y - 18}%` }}>
                  <div className="font-display text-sm font-bold text-green">{p.l}</div>
                  {p.sub && <div className="text-[10px] text-white/40">{p.sub}</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="self-center rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-white/60">Kutilayotgan natija</div>
            <div className="mt-1 font-display text-3xl font-extrabold text-green">100K – 300K+</div>
            <div className="text-white/70">Ko'rishlar</div>
            <div className="mt-3 text-xs text-white/40">Kampaniyaga qarab</div>
          </div>
        </div>
      </div>
    </Reveal>
  )
}

export default function BloggerProfile() {
  const { slug } = useParams()
  const b = findBlogger(slug)
  const [live, setLive] = useState<Live | null>(null)
  useEffect(() => {
    let on = true
    api<{ blogger: Live }>(`/public/bloggers/${slug}`).then((d) => on && setLive(d.blogger)).catch(() => on && setLive(null))
    return () => { on = false }
  }, [slug])
  return (
    <div className="mx-auto max-w-[1320px] px-5 pt-7 pb-12 lg:px-8">
      <Reveal>
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
          <Link to="/" className="hover:text-green">Bosh sahifa</Link>
          <span>/</span>
          <Link to="/blogerlar" className="hover:text-green">Blogerlar</Link>
          <span>/</span>
          <span className="font-semibold text-green">{live?.name || b.name}</span>
        </nav>
      </Reveal>

      <Reveal><Header b={b} live={live} /></Reveal>
      <div className="mt-6"><StatsRow b={b} /></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_320px]">
        {/* Left */}
        <div className="flex flex-col gap-6">
          <Reveal><About /></Reveal>
          <Reveal delay={80}><AiCard /></Reveal>
          <Reveal delay={140}><QuickContact /></Reveal>
        </div>
        {/* Center */}
        <div className="flex flex-col gap-6">
          <Reveal><Content live={live} /></Reveal>
          <Reveal delay={80}><AchievementsAndServices /></Reveal>
        </div>
        {/* Right */}
        <div className="flex flex-col gap-6">
          <Reveal><Analytics /></Reveal>
          <Reveal delay={80}><Brands /></Reveal>
        </div>
      </div>

      <Efficiency />
    </div>
  )
}
