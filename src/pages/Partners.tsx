import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Reveal, Icon, I, Skeleton } from "../lib/ui"
import { useHomeSection } from "../lib/sections"
import { api } from "../lib/api"
import { useStaticSeo } from "../lib/seo"

type LivePartner = { name: string; slug: string; sphere: string; logo: string | null; direction: string }

const mascot = "/mascot-partners.webp"

type DirectionItem = { icon: string; t: string; d: string }
type BenefitItem = { icon: string; t: string; d: string }

const benefits: BenefitItem[] = [
  { icon: I.handshake, t: "O'zaro manfaatli", d: "Win-win strategiyasiga asoslangan hamkorlik." },
  { icon: I.shield, t: "Ishonch va sifat", d: "Yuqori standartlar va ishonchli aloqalar." },
  { icon: I.globe, t: "Keng qamrov", d: "Katta auditoriya va keng imkoniyatlar." },
  { icon: I.sprout, t: "Innovatsion yondashuv", d: "Yangi g'oyalar va zamonaviy yechimlar bilan ishlash." },
]

const iconMap: Record<string, string> = { sprout: I.sprout, shield: I.shield, tractor: I.tractor, cap: I.cap, megaphone: I.megaphone, handshake: I.handshake, globe: I.globe, users: I.users, building: I.building, star: I.star }

function BrandChip({ name }: { name: string }) {
  // backdrop-blur ataylab olib tashlangan: qatorlar 3 tadan 7 taga oshgach
  // 126 ta backdrop-filter qatlami hosil bo'lardi. Chip orqasida tekis fon
  // (bg-soft) turgani uchun blur ko'rinmasdi ham — faqat GPU yuki edi.
  return (
    <div className="grid h-16 min-w-[150px] place-items-center rounded-2xl border border-green/10 bg-white/90 px-6 font-display text-sm font-extrabold tracking-tight text-ink/65 shadow-[0_4px_20px_rgba(91,180,32,0.07)]">
      {name}
    </div>
  )
}

function MarqueeRow({ items, dir, duration }: { items: string[]; dir: "left" | "right"; duration: string }) {
  const loop = [...items, ...items]
  return (
    <div className="flex overflow-hidden">
      <div
        className={`flex w-max gap-4 ${dir === "left" ? "marquee-left" : "marquee-right"}`}
        style={{ animationDuration: duration }}
      >
        {loop.map((p, i) => (
          <BrandChip key={`${p}-${i}`} name={p} />
        ))}
      </div>
    </div>
  )
}

function BrandCarousel() {
  const [livePartners, setLivePartners] = useState<string[]>([])
  useEffect(() => {
    api<{ partners: LivePartner[] }>("/public/partners").then((d) => {
      if (d.partners?.length) setLivePartners(d.partners.map((p) => p.name))
    }).catch(() => {})
  }, [])
  const marqueeRows = useMemo(() => {
    if (!livePartners.length) return []
    const half = Math.ceil(livePartners.length / 2)
    return Array.from({ length: 7 }, (_, i) => {
      // Har qator ro'yxatning boshqa joyidan boshlanadi, aks holda qatorlar
      // bir-birini takrorlab, bir xil ko'rinib qolardi.
      const offset = (i * 3) % livePartners.length
      const rotated = [...livePartners.slice(offset), ...livePartners.slice(0, offset)]
      const items = i % 2 ? [...rotated].reverse() : rotated
      return {
        items: items.slice(0, half),
        dir: (i % 2 ? "right" : "left") as "left" | "right",
        duration: `${30 + i * 4}s`, // har qator boshqa tezlikda
      }
    })
  }, [livePartners])
  return (
    <div className="marquee-track absolute inset-0 flex flex-col justify-center gap-3 py-4">
      {marqueeRows.map((r, i) => (
        <MarqueeRow key={i} items={r.items} dir={r.dir} duration={r.duration} />
      ))}
    </div>
  )
}

function Hero() {
  const hero = useHomeSection("partners_hero", {
    title: "BIRGA O'SAYLIK, BIRGA YUTAYLIK!",
    subtitle: "Agro Alliance — agro sohadagi innovatsion yechimlar va imkoniyatlarni birlashtiruvchi ishonchli hamkor platformasi.",
  })
  // Sarlavhani "so'z1 so'z2, so'z3 so'z4" formatida ikki rangда ko'rsatish uchun bo'lamiz
  const parts = hero.title.split(" ")
  const fade = hero.loading ? "opacity-0" : "opacity-100 transition-opacity duration-300"
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-soft" />
        <BrandCarousel />
        <div className="absolute inset-0 bg-white/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/75 to-white/40" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
      </div>
      <div className="mx-auto max-w-[1320px] px-5 pt-7 lg:px-8">
        <Reveal>
          <nav className="flex items-center gap-2 text-sm text-muted">
            <Link to="/" className="flex items-center gap-1.5 hover:text-green">
              <Icon d="M3 12l9-9 9 9 M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" className="h-4 w-4" /> Bosh sahifa
            </Link>
            <span>/</span><span className="font-semibold text-green">Hamkorlar</span>
          </nav>
        </Reveal>
        <div className="grid items-center gap-8 py-8 lg:grid-cols-2">
          <div>
            <Reveal>
              <h1 className={`font-display text-[clamp(2.4rem,6vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.03em] ${fade}`}>
                {parts[0]} <span className="text-green">{parts[1]}</span> {parts.slice(2).join(" ")}
              </h1>
            </Reveal>
            <Reveal delay={90}>
              <p className={`mt-5 max-w-md leading-relaxed text-muted ${fade}`}>
                {hero.subtitle}
              </p>
            </Reveal>
            <Reveal delay={160}>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="#" className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
                  <Icon d={I.handshake} className="h-5 w-5" /> HAMKOR BO'LISH
                </a>
                <a href="#yonalishlar" className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 bg-white px-6 py-3.5 font-bold text-ink transition-colors hover:border-green hover:text-green">
                  <Icon d={I.play} className="h-5 w-5" /> HAMKORLIK HAQIDA
                </a>
              </div>
            </Reveal>
          </div>
          <div className="relative hidden items-center justify-center lg:flex">
            <img src={mascot} alt="Agro Alliance" className="animate-float relative w-full max-w-[360px] object-contain drop-shadow-2xl" />
          </div>
        </div>
      </div>
    </section>
  )
}

function StatsRow() {
  const [liveStats, setLiveStats] = useState<Array<{ icon: string; v: string; l: string }>>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([
      api<{ sections: { section_key: string; items: { item_key?: string; icon: string; title: string; description: string }[] }[] }>("/public/homepage-sections"),
      api<{ partners: LivePartner[] }>("/public/partners"),
    ]).then(([secs, pd]) => {
      const partners = pd.partners || []
      const spheres = new Set(partners.map((p) => p.sphere)).size
      const sub = (v: string) => (v || "")
        .replace(/\{\{partners\}\}/g, String(partners.length))
        .replace(/\{\{spheres\}\}/g, String(spheres))
      const sec = secs.sections?.find((s) => s.section_key === "partner_stats")
      if (sec?.items?.length) {
        setLiveStats(sec.items.map((it) => ({ icon: iconMap[it.icon] || I.star, v: sub(it.title), l: it.description })))
      } else {
        // fallback (DB bo'limi bo'lmasa)
        setLiveStats([
          { icon: I.users, v: `${partners.length}+`, l: "Faol hamkorlar" },
          { icon: I.building, v: `${spheres}+`, l: "Yo'nalishlar" },
          { icon: I.handshake, v: `${partners.length}+`, l: "Strategik hamkorlar" },
          { icon: I.globe, v: "1M+", l: "Birgalikda qamrov" },
          { icon: I.star, v: "5+", l: "Yillik tajriba" },
        ])
      }
    }).catch(() => { /* xatoda pastda blok butunlay chizilmaydi */ }).finally(() => setLoading(false))
  }, [])
  // Yuklanib bo'lgach ham hech narsa yo'q bo'lsa — bo'sh oq qutini ko'rsatmaymiz.
  if (!loading && liveStats.length === 0) return null
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-4 lg:px-8">
      <Reveal>
        <div className="grid grid-cols-2 gap-y-7 rounded-3xl border border-green/10 bg-white px-6 py-8 shadow-[0_10px_40px_rgba(91,180,32,0.08)] sm:grid-cols-3 lg:grid-cols-5">
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2">
              <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-6 w-14" /><Skeleton className="h-3 w-20" /></div>
            </div>
          ))}
          {!loading && liveStats.map((s) => (
            <div key={s.l} className="flex items-center gap-3 px-2">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-green/20 text-green"><Icon d={s.icon} className="h-5 w-5" /></span>
              <div>
                <div className="font-display text-2xl font-extrabold leading-none">{s.v}</div>
                <div className="mt-1 text-xs font-medium text-muted">{s.l}</div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  )
}

function Directions() {
  const [items, setItems] = useState<DirectionItem[]>([])
  const [dirLoading, setDirLoading] = useState(true)
  const [head, setHead] = useState<{ title: string; subtitle: string }>({
    title: "HAMKORLIK YO'NALISHLARI",
    subtitle: "Biz turli yo'nalishlarda yetakchi kompaniya va tashkilotlar bilan hamkorlik qilamiz. Quyidagi sohalarda o'zaro manfaatli hamkorlikni yo'lga qo'yganmiz.",
  })
  useEffect(() => {
    api<{ sections: { section_key: string; title?: string; subtitle?: string; items: { icon: string; title: string; description: string }[] }[] }>("/public/homepage-sections").then((d) => {
      const sec = d.sections?.find((s) => s.section_key === "partner_directions")
      if (sec?.items?.length) {
        setItems(sec.items.map((item) => ({ icon: iconMap[item.icon] || I.star, t: item.title, d: item.description })))
      }
      if (sec?.title || sec?.subtitle) setHead((h) => ({ title: sec.title || h.title, subtitle: sec.subtitle || h.subtitle }))
    }).catch(() => {}).finally(() => setDirLoading(false))
  }, [])
  const [dh1, ...dhrest] = head.title.split(" ")
  // Ma'lumot yo'q bo'lsa sarlavha ostida bo'sh joy qolmasin.
  if (!dirLoading && items.length === 0) return null
  return (
    <section id="yonalishlar" className="mx-auto max-w-[1320px] px-5 py-14 lg:px-8">
      <Reveal>
        <div className="mb-12 text-center">
          <h2 className="font-display text-[clamp(1.8rem,5vw,2.8rem)] font-extrabold tracking-tight">
            {dh1} <span className="text-green">{dhrest.join(" ")}</span>
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-green/40" />
          <p className="mx-auto mt-4 max-w-xl text-muted">
            {head.subtitle}
          </p>
        </div>
      </Reveal>
      {dirLoading && items.length === 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-full rounded-2xl border border-green/10 bg-white p-6 text-center">
              <Skeleton className="mx-auto h-16 w-16 rounded-2xl" /><Skeleton className="mx-auto mt-5 h-5 w-2/3" /><Skeleton className="mx-auto mt-2 h-4 w-full" />
            </div>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.map((c, i) => (
            <Reveal key={c.t} delay={(i % 5) * 70}>
              <div className="group h-full rounded-2xl border border-green/10 bg-white p-6 text-center shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:border-green/30 hover:shadow-[0_16px_44px_rgba(91,180,32,0.14)]">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-soft text-green transition-colors group-hover:bg-green group-hover:text-white">
                  <Icon d={c.icon} className="h-8 w-8" />
                </span>
                <h3 className="mt-5 font-display font-bold">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </section>
  )
}

function PartnerLogos() {
  const [livePartners, setLivePartners] = useState<LivePartner[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api<{ partners: LivePartner[] }>("/public/partners")
      .then((d) => setLivePartners(d.partners || []))
      .catch(() => { /* xatoda bo'lim chizilmaydi */ })
      .finally(() => setLoading(false))
  }, [])
  const list = livePartners

  // Ilgari sarlavha chizilib, ostida butunlay bo'sh grid turardi.
  if (!loading && list.length === 0) return null

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8">
      <Reveal>
        <div className="mb-10 text-center">
          <h2 className="font-display text-[clamp(1.8rem,5vw,2.8rem)] font-extrabold tracking-tight">
            BIZNING <span className="text-green">HAMKORLARIMIZ</span>
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-green/40" />
          <p className="mx-auto mt-4 max-w-xl text-muted">Biz bilan birga ishlayotgan ba'zi hamkorlarimiz.</p>
        </div>
      </Reveal>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {loading && Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
        {!loading && list.map((p, i) => (
          <Reveal key={p.name} delay={(i % 5) * 50}>
            <div className="grid h-24 place-items-center rounded-2xl border border-green/10 bg-white px-4 text-center font-display text-base font-extrabold tracking-tight text-ink/75 shadow-[0_4px_20px_rgba(91,180,32,0.05)] transition-all hover:-translate-y-1 hover:text-green hover:shadow-[0_12px_32px_rgba(91,180,32,0.12)]">
              {p.logo ? <img src={p.logo} alt={p.name} className="max-h-12 max-w-full object-contain" /> : p.name}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function CtaBanner() {
  const cta = useHomeSection("partners_cta", { title: "Hamkorlikka tayyormisiz?", subtitle: "Biz bilan hamkorlik qilib, agro sohada yangi imkoniyatlarni birga yarating!" })
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-ink p-8 text-white lg:p-12">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-green/20 blur-3xl" />
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className={`font-display text-3xl font-extrabold leading-tight tracking-tight ${cta.loading ? "opacity-0" : "opacity-100 transition-opacity duration-300"}`}>{cta.title}</h2>
              <p className={`mt-3 max-w-md leading-relaxed text-white/70 ${cta.loading ? "opacity-0" : "opacity-100 transition-opacity duration-300"}`}>{cta.subtitle}</p>
              <a href="#" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-green px-7 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
                HAMKOR BO'LISH <Icon d={I.send} className="h-5 w-5" />
              </a>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {benefits.map((b) => (
                <div key={b.t} className="flex gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-green"><Icon d={b.icon} className="h-5 w-5" /></span>
                  <div>
                    <h4 className="font-display font-bold">{b.t}</h4>
                    <p className="mt-1 text-sm leading-snug text-white/60">{b.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

export default function Partners() {
  useStaticSeo("/hamkorlar")
  return (
    <>
      <Hero />
      <StatsRow />
      <Directions />
      <PartnerLogos />
      <CtaBanner />
    </>
  )
}
