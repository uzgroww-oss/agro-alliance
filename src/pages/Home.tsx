import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Reveal, Icon, I, StatsBar } from "../lib/ui"
import { api } from "../lib/api"
import { newsImg } from "../lib/news"
import Newsletter from "../components/Newsletter"

const mascot = "/mascot.webp"

type HeroCard = { icon: string; t: string; d: string }
type FeatureCard = { icon: string; t: string; d: string }

const iconMap: Record<string, string> = {
  brain: I.brain, task: I.task, doc: I.doc, trophy: I.trophy, play: I.play,
  robot: I.robot, sprout: I.sprout, book: I.book, media: I.media, chart: I.chart, send: I.send,
  building: I.building, shield: I.shield, users: I.users, globe: I.globe, leaf: I.leaf,
}

type SectionItem = { title: string; description: string; icon: string; link: string }
type Section = { section_key: string; title: string; subtitle: string; items: SectionItem[] }

function Hero() {
  const [heroCards, setHeroCards] = useState<HeroCard[]>([])
  useEffect(() => {
    api<{ sections: Section[] }>("/public/homepage-sections").then((d) => {
      const hc = d.sections?.find((s) => s.section_key === "hero_cards")
      if (hc?.items?.length) {
        setHeroCards(hc.items.map((item) => ({ icon: iconMap[item.icon] || I.star, t: item.title, d: item.description })))
      }
    }).catch(() => {})
  }, [])

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <img src="/hero-bg.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-white/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/65 to-white/35" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
      </div>

      <div className="mx-auto grid max-w-[1320px] gap-8 px-5 pt-10 pb-8 lg:px-8 lg:pt-14 xl:grid-cols-[1fr_0.85fr_340px]">
        <div className="flex flex-col justify-center">
          <Reveal>
            <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-green/25 bg-white px-4 py-2 text-xs font-bold tracking-wide text-green shadow-sm">
              <Icon d={I.leaf} className="h-4 w-4" />
              AGRO KELAJAKNI BIRGA KO'RSATAMIZ
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display text-[clamp(2.8rem,7vw,5.2rem)] font-extrabold leading-[0.95] tracking-[-0.03em] text-ink">
              AGRO <span className="text-green">ALLIANCE</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              Agro blogerlar, fermerlar, kompaniyalar va texnologiyalarni birlashtiruvchi
              innovatsion media platforma.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap gap-4">
              {/* <a href="#" className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 bg-white px-7 py-3.5 font-bold text-ink transition-colors hover:border-green hover:text-green">
                HAMKOR BO'LISH
                <Icon d={I.users} className="h-5 w-5" />
              </a> */}
            </div>
          </Reveal>
        </div>

        <div className="relative hidden items-center justify-center xl:flex">
          <div className="absolute h-72 w-72 rounded-full bg-white/40 blur-2xl" />
          <img src={mascot} alt="Agro Alliance" className="animate-float relative w-full max-w-[400px] object-contain drop-shadow-2xl" />
        </div>

        <div className="flex flex-col gap-3">
          {heroCards.map((c, i) => (
            <Reveal key={c.t} delay={i * 70}>
              <a href="#" className="group flex items-start gap-3 rounded-2xl border border-green/10 bg-white p-4 shadow-[0_4px_20px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-0.5 hover:border-green/30 hover:shadow-[0_8px_28px_rgba(91,180,32,0.16)]">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-soft text-green transition-colors group-hover:bg-green group-hover:text-white">
                  <Icon d={c.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-[13px] font-bold tracking-wide">{c.t}</h3>
                    <Icon d={I.arrow} className="h-4 w-4 text-green opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-1 text-xs leading-snug text-muted">{c.d}</p>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  const [features, setFeatures] = useState<FeatureCard[]>([])
  useEffect(() => {
    api<{ sections: Section[] }>("/public/homepage-sections").then((d) => {
      const fc = d.sections?.find((s) => s.section_key === "features")
      if (fc?.items?.length) {
        setFeatures(fc.items.map((item) => ({ icon: iconMap[item.icon] || I.star, t: item.title, d: item.description })))
      }
    }).catch(() => {})
  }, [])

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-16 lg:px-8 lg:py-20">
      <Reveal>
        <div className="mb-12 text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-green">
          </div>
          <h2 className="font-display text-[clamp(1.8rem,5vw,3rem)] font-extrabold tracking-tight">
            BARCHASI <span className="text-green">BIR PLATFORMADA</span>
          </h2>
        </div>
      </Reveal>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.t} delay={(i % 3) * 90}>
            <div className="group h-full rounded-2xl border border-green/10 bg-white p-7 shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:border-green/30 hover:shadow-[0_14px_40px_rgba(91,180,32,0.14)]">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-soft text-green transition-colors group-hover:bg-green group-hover:text-white">
                <Icon d={f.icon} className="h-7 w-7" />
              </span>
              <h3 className="mt-6 font-display text-lg font-bold tracking-wide">{f.t}</h3>
              <p className="mt-2 leading-relaxed text-muted">{f.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

type NewsItem = { slug: string; title: string; cat: string; desc: string; date: string; views: string; seed: string }
type BloggerItem = { id: string; name: string; avatar: string; niche: string; region: string }





export default function Home() {
  return (
    <>
      <Hero />
      <StatsBar />
      <Features />
    </>
  )
}
