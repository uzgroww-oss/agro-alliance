import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Reveal, Icon, I, StatsBar, Skeleton } from "../lib/ui"
import { useHomeSection } from "../lib/sections"
import { api } from "../lib/api"

const mascot = "/mascot2.webp"

type Pillar = { icon: string; t: string; type: "text" | "list"; body?: string; items?: string[] }
type TeamMember = { name: string; role: string; img: number }

const iconMap: Record<string, string> = { target: I.target, eye: I.eye, gem: I.gem, check: I.check, brain: I.brain, task: I.task, doc: I.doc, trophy: I.trophy, play: I.play, robot: I.robot, sprout: I.sprout, book: I.book, media: I.media, chart: I.chart, send: I.send, building: I.building, shield: I.shield, users: I.users, globe: I.globe, leaf: I.leaf }

type SectionItem = { title: string; description: string; icon: string; link: string }
type Section = { section_key: string; title: string; subtitle: string; items: SectionItem[] }

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <img src="/hero-bg.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-white/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/65 to-white/35" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
      </div>

      <div className="mx-auto max-w-[1320px] px-5 pt-7 lg:px-8">
        <Reveal>
          <nav className="flex items-center gap-2 text-sm text-muted">
            <Link to="/" className="flex items-center gap-1.5 hover:text-green">
              <Icon d="M3 12l9-9 9 9 M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" className="h-4 w-4" />
              Bosh sahifa
            </Link>
            <span>/</span>
            <span className="font-semibold text-green">Biz haqimizda</span>
          </nav>
        </Reveal>

        <div className="grid gap-8 pt-8 pb-10 xl:grid-cols-[1fr_0.8fr_320px]">
          <div className="flex flex-col justify-center">
            <Reveal>
              <h1 className="font-display text-[clamp(2.6rem,6.5vw,4.6rem)] font-extrabold leading-[0.95] tracking-[-0.03em]">
                BIZ <span className="text-green">HAQIMIZDA</span>
              </h1>
            </Reveal>
            <Reveal delay={90}>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
                Agro Alliance — agro blogerlar, fermerlar, kompaniyalar va texnologiyalarni
                birlashtiruvchi innovatsion media platforma.
              </p>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-4 max-w-md leading-relaxed text-muted">
                Bizning maqsadimiz — zamonaviy media va texnologiyalar orqali qishloq
                xo'jaligini rivojlantirish va agro kelajakni birgalikda yaratish.
              </p>
            </Reveal>

          </div>

          <div className="relative hidden items-center justify-center xl:flex">
            <div className="absolute h-72 w-72 rounded-full bg-white/40 blur-2xl" />
            <img src={mascot} alt="Agro Alliance" className="animate-float relative w-full max-w-[380px] object-contain drop-shadow-2xl" />
          </div>

          <Reveal delay={160}>
            <div className="relative flex h-full flex-col justify-center rounded-3xl border border-green/10 bg-white p-7 shadow-[0_12px_44px_rgba(91,180,32,0.10)]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green">
                <Icon d="M12 2a4 4 0 0 0-4 4 4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0 4-4 4 4 0 0 0-4-4z" className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-xl font-extrabold leading-snug tracking-tight">
                AGRO KELAJAKNI<br />BIRGA YARATAMIZ
              </h3>
              <p className="mt-4 leading-relaxed text-muted">
                Media, texnologiya va bilim — agro sohaning yangi imkoniyatlarini ochadi.
                Agro Alliance ana shu imkoniyatlarni hamma uchun kengaytiradi.
              </p>
              <span className="mt-4 self-end font-display text-6xl leading-none text-green/20">"</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Pillars() {
  const [pillars, setPillars] = useState<Pillar[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api<{ sections: Section[] }>("/public/homepage-sections").then((d) => {
      const pc = d.sections?.find((s) => s.section_key === "about_pillars")
      if (pc?.items?.length) {
        setPillars(pc.items.map((item, i) => ({
          icon: iconMap[item.icon] || I.star,
          t: item.title,
          type: (i === 2 ? "list" : "text") as "text" | "list",
          body: item.description,
          items: i === 2 ? item.description.split(",").map((s) => s.trim()) : undefined,
        })))
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading && pillars.length === 0) return (
    <section className="mx-auto max-w-[1320px] px-5 pb-4 lg:px-8">
      <div className="grid gap-px overflow-hidden rounded-3xl border border-green/10 bg-green/10 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white p-8"><Skeleton className="h-14 w-14 rounded-full" /><Skeleton className="mt-4 h-5 w-1/2" /><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="mt-2 h-4 w-2/3" /></div>
        ))}
      </div>
    </section>
  )

  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-4 lg:px-8">
      <Reveal>
        <div className="grid gap-px overflow-hidden rounded-3xl border border-green/10 bg-green/10 shadow-[0_10px_40px_rgba(91,180,32,0.08)] md:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.t} className="bg-white p-8">
              <div className="flex items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-soft text-green">
                  <Icon d={p.icon} className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold tracking-wide text-green">{p.t}</h3>
                  {p.type === "text" ? (
                    <p className="mt-3 leading-relaxed text-muted">{p.body}</p>
                  ) : (
                    <ul className="mt-3 space-y-2.5">
                      {p.items!.map((it) => (
                        <li key={it} className="flex items-center gap-2.5 text-ink/80">
                          <Icon d={I.check} className="h-4 w-4 text-green" sw={2.4} />
                          {it}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  )
}

function Team() {
  const [team, setTeam] = useState<TeamMember[]>([])
  useEffect(() => {
    api<{ sections: Section[] }>("/public/homepage-sections").then((d) => {
      const tc = d.sections?.find((s) => s.section_key === "team")
      if (tc?.items?.length) {
        setTeam(tc.items.map((item, i) => ({ name: item.title, role: item.description, img: (i + 1) * 12 })))
      }
    }).catch(() => {})
  }, [])

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-16 lg:px-8">
      <Reveal>
        <h2 className="mb-12 text-center font-display text-[clamp(1.8rem,5vw,2.8rem)] font-extrabold tracking-tight">
          BIZNING <span className="text-green">JAMOA</span>
        </h2>
      </Reveal>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {team.map((m, i) => (
          <Reveal key={m.name} delay={(i % 5) * 70}>
            <div className="group rounded-2xl border border-green/10 bg-white p-6 text-center shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:border-green/30 hover:shadow-[0_14px_40px_rgba(91,180,32,0.14)]">
              <img src={`https://i.pravatar.cc/160?img=${m.img}`} alt={m.name} className="mx-auto h-20 w-20 rounded-full object-cover ring-4 ring-soft" />
              <h3 className="mt-4 font-display font-bold">{m.name}</h3>
              <p className="mt-0.5 text-sm text-muted">{m.role}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}



export default function About() {
  return (
    <>
      <Hero />
      <Pillars />
      <StatsBar />
      <Team />
      <CtaBanner />
    </>
  )
}
