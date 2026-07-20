import { Link } from "react-router-dom"
import { useMemo } from "react"
import { Reveal, Icon, I, StatsBar, Skeleton } from "../lib/ui"
import { useHomeSections } from "../lib/sections"
import { useStaticSeo } from "../lib/seo"

const mascot = "/mascot.webp"

type HeroCard = { icon: string; t: string; d: string; link?: string }
type FeatureCard = { icon: string; t: string; d: string }

const iconMap: Record<string, string> = {
  brain: I.brain, task: I.task, doc: I.doc, trophy: I.trophy, play: I.play,
  robot: I.robot, sprout: I.sprout, book: I.book, media: I.media, chart: I.chart, send: I.send,
  building: I.building, shield: I.shield, users: I.users, globe: I.globe, leaf: I.leaf,
}

type SectionItem = { title: string; description: string; icon: string; link: string }
type Section = { section_key: string; title: string; subtitle: string; items: SectionItem[] }

function HeroCardBox({ card }: { card: HeroCard }) {
  const base = "group flex items-start gap-3 rounded-2xl border border-green/10 bg-white p-4 shadow-[0_4px_20px_rgba(91,180,32,0.06)] transition-all"
  const hoverable = " hover:-translate-y-0.5 hover:border-green/30 hover:shadow-[0_8px_28px_rgba(91,180,32,0.16)]"
  const inner = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-soft text-green transition-colors group-hover:bg-green group-hover:text-white">
        <Icon d={card.icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[13px] font-bold tracking-wide">{card.t}</h3>
          {card.link && <Icon d={I.arrow} className="h-4 w-4 text-green opacity-0 transition-opacity group-hover:opacity-100" />}
        </div>
        <p className="mt-1 text-xs leading-snug text-muted">{card.d}</p>
      </div>
    </>
  )
  if (!card.link || card.link === "#") return <div className={base}>{inner}</div>
  const external = /^https?:\/\//i.test(card.link)
  return external
    ? <a href={card.link} target="_blank" rel="noreferrer" className={base + hoverable}>{inner}</a>
    : <Link to={card.link} className={base + hoverable}>{inner}</Link>
}

function Hero() {
  const { sections, loading } = useHomeSections<Section>()

  const heroCards: HeroCard[] = useMemo(() => {
    const hc = sections.find((s) => s.section_key === "hero_cards")
    if (!hc?.items?.length) return []
    return hc.items.map((item) => ({ icon: iconMap[item.icon] || I.star, t: item.title, d: item.description, link: item.link }))
  }, [sections])

  const main = useMemo(() => {
    const fallback = {
      tagline: "AGRO KELAJAKNI BIRGA KO'RSATAMIZ", title1: "AGRO", title2: "ALLIANCE",
      subtitle: "Agro blogerlar, fermerlar, kompaniyalar va texnologiyalarni birlashtiruvchi innovatsion media platforma.",
    }
    const hm = sections.find((s) => s.section_key === "hero_main")
    if (!hm) return fallback
    const byKey = (k: string) => hm.items?.find((it) => (it as SectionItem & { item_key?: string }).item_key === k)?.title
    return {
      tagline: byKey("tagline") || fallback.tagline,
      title1: byKey("title_line1") || fallback.title1,
      title2: byKey("title_line2") || fallback.title2,
      subtitle: hm.subtitle || fallback.subtitle,
    }
  }, [sections])

  // Yuklanguncha matnni ko'rinmas qilamiz: joyni egallaydi (sahifa sakramaydi),
  // lekin qattiq yozilgan matn chizilib keyin DB matniga almashmaydi.
  const fade = loading ? "opacity-0" : "opacity-100 transition-opacity duration-300"

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
            <span className={`mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-green/25 bg-white px-4 py-2 text-xs font-bold tracking-wide text-green shadow-sm ${fade}`}>
              <Icon d={I.leaf} className="h-4 w-4" />
              {main.tagline}
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className={`font-display text-[clamp(2.8rem,7vw,5.2rem)] font-extrabold leading-[0.95] tracking-[-0.03em] text-ink ${fade}`}>
              {main.title1} <span className="text-green">{main.title2}</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className={`mt-6 max-w-md text-lg leading-relaxed text-muted ${fade}`}>
              {main.subtitle}
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
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl border border-green/10 bg-white p-4">
              <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
          {!loading && heroCards.map((c, i) => (
            <Reveal key={c.t} delay={i * 70}>
              {/* Ilgari hamma karta href="#" edi — bosilardi, lekin hech narsa
                  qilmasdi. Endi admin panelda havola berilgan bo'lsa haqiqiy
                  havola, berilmagan bo'lsa oddiy karta (bosiladigandek emas). */}
              <HeroCardBox card={c} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  const { sections, loading } = useHomeSections<Section>()
  const fc = sections.find((s) => s.section_key === "features")
  const features: FeatureCard[] = (fc?.items || []).map((item) => ({ icon: iconMap[item.icon] || I.star, t: item.title, d: item.description }))
  const heading = fc?.title || "BARCHASI BIR PLATFORMADA"
  const [h1, ...hrest] = heading.split(" ")
  // Sarlavha ham yuklanguncha ko'rinmas — ilgari faqat kartalar skeleton edi,
  // sarlavha esa qattiq matndan DB matniga sakrardi.
  const fade = loading ? "opacity-0" : "opacity-100 transition-opacity duration-300"

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-16 lg:px-8 lg:py-20">
      <Reveal>
        <div className="mb-12 text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-green">
          </div>
          <h2 className={`font-display text-[clamp(1.8rem,5vw,3rem)] font-extrabold tracking-tight ${fade}`}>
            {h1} <span className="text-green">{hrest.join(" ")}</span>
          </h2>
        </div>
      </Reveal>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading && features.length === 0 && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-full rounded-2xl border border-green/10 bg-white p-7">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <Skeleton className="mt-6 h-5 w-1/2" />
            <Skeleton className="mt-3 h-4 w-full" />
          </div>
        ))}
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

export default function Home() {
  useStaticSeo("/")
  return (
    <>
      <Hero />
      <StatsBar />
      <Features />
    </>
  )
}
