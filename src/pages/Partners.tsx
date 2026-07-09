import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Reveal, Icon, I } from "../lib/ui"
import { api } from "../lib/api"
import Newsletter from "../components/Newsletter"

type LivePartner = { name: string; slug: string; sphere: string; logo: string | null; direction: string }
type PartnerStats = { total: number; countries: number; strategic: number; coverage: string }

const mascot = "/mascot-partners.webp"

type DirectionItem = { icon: string; t: string; d: string }
type BenefitItem = { icon: string; t: string; d: string }

const iconMap: Record<string, string> = { sprout: I.sprout, shield: I.shield, tractor: I.tractor, cap: I.cap, megaphone: I.megaphone, handshake: I.handshake, globe: I.globe, users: I.users, building: I.building, star: I.star }

function BrandChip({ name }: { name: string }) {
  return (
    <div className="grid h-16 min-w-[150px] place-items-center rounded-2xl border border-green/10 bg-white/90 px-6 font-display text-sm font-extrabold tracking-tight text-ink/65 shadow-[0_4px_20px_rgba(91,180,32,0.07)] backdrop-blur-sm">
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
  const rev = [...livePartners].reverse()
  const mid = Math.ceil(livePartners.length / 2)
  const marqueeRows = [
    { items: livePartners.slice(0, mid), dir: "left" as const, duration: "34s" },
    { items: livePartners.slice(mid), dir: "right" as const, duration: "42s" },
    { items: rev.slice(0, mid), dir: "left" as const, duration: "50s" },
  ]
  return (
    <div className="marquee-track absolute inset-0 flex flex-col justify-center gap-3 py-4">
      {marqueeRows.map((r, i) => (
        <MarqueeRow key={i} items={r.items} dir={r.dir} duration={r.duration} />
      ))}
    </div>
  )
}

function Hero() {
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
              <h1 className="font-display text-[clamp(2.4rem,6vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
                BIRGA <span className="text-green">O'SAYLIK,</span><br />BIRGA YUTAYLIK!
              </h1>
            </Reveal>
            <Reveal delay={90}>
              <p className="mt-5 max-w-md leading-relaxed text-muted">
                Agro Alliance — agro sohadagi innovatsion yechimlar va imkoniyatlarni
                birlashtiruvchi ishonchli hamkor platformasi.
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
  const [liveStats, setLiveStats] = useState(stats)
  useEffect(() => {
    api<{ partners: LivePartner[] }>("/public/partners").then((d) => {
      if (d.partners?.length) {
        const spheres = new Set(d.partners.map((p) => p.sphere))
        setLiveStats([
          { icon: I.users, v: `${d.partners.length}+`, l: "Faol hamkorlar" },
          { icon: I.building, v: `${spheres.size}+`, l: "Yo'nalishlar" },
          { icon: I.handshake, v: `${d.partners.length}+`, l: "Strategik hamkorlar" },
          { icon: I.globe, v: "1M+", l: "Birgalikda qamrov" },
          { icon: I.star, v: "5+", l: "Yillik tajriba" },
        ])
      }
    }).catch(() => {})
  }, [])
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-4 lg:px-8">
      <Reveal>
        <div className="grid grid-cols-2 gap-y-7 rounded-3xl border border-green/10 bg-white px-6 py-8 shadow-[0_10px_40px_rgba(91,180,32,0.08)] sm:grid-cols-3 lg:grid-cols-5">
          {liveStats.map((s) => (
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
  useEffect(() => {
    api<{ sections: { section_key: string; items: { icon: string; title: string; description: string }[] }[] }>("/public/homepage-sections").then((d) => {
      const sec = d.sections?.find((s) => s.section_key === "partner_directions")
      if (sec?.items?.length) {
        setItems(sec.items.map((item) => ({ icon: iconMap[item.icon] || I.star, t: item.title, d: item.description })))
      }
    }).catch(() => {})
  }, [])
  return (
    <section id="yonalishlar" className="mx-auto max-w-[1320px] px-5 py-14 lg:px-8">
      <Reveal>
        <div className="mb-12 text-center">
          <h2 className="font-display text-[clamp(1.8rem,5vw,2.8rem)] font-extrabold tracking-tight">
            HAMKORLIK <span className="text-green">YO'NALISHLARI</span>
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-green/40" />
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Biz turli yo'nalishlarda yetakchi kompaniya va tashkilotlar bilan hamkorlik qilamiz.
            Quyidagi sohalarda o'zaro manfaatli hamkorlikni yo'lga qo'yganmiz.
          </p>
        </div>
      </Reveal>
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
  useEffect(() => {
    api<{ partners: LivePartner[] }>("/public/partners").then((d) => setLivePartners(d.partners)).catch(() => {})
  }, [])
  const list = livePartners.length > 0 ? livePartners : []

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
        {list.map((p, i) => (
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
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-ink p-8 text-white lg:p-12">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-green/20 blur-3xl" />
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight">Hamkorlikka tayyormisiz?</h2>
              <p className="mt-3 max-w-md leading-relaxed text-white/70">
                Biz bilan hamkorlik qilib, agro sohada yangi imkoniyatlarni birga yarating!
              </p>
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
  return (
    <>
      <Hero />
      <StatsRow />
      <Directions />
      <PartnerLogos />
      <CtaBanner />
      <Newsletter />
    </>
  )
}
