import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Reveal, Icon, I, StatsBar } from "../lib/ui"
import { api } from "../lib/api"
import { newsImg } from "../lib/news"
import Newsletter from "../components/Newsletter"

const mascot = "/mascot.webp"

const defaultHeroCards = [
  { icon: I.brain, t: "AI ASSISTANT", d: "Sun'iy intellekt yordamchisi kontent, tahlil va g'oyalar bilan yordam beradi." },
  { icon: I.task, t: "TASK MANAGER", d: "Vazifalarni boshqaring, muddatlar va KPI larni nazorat qiling." },
  { icon: I.doc, t: "CONTRACT CENTER", d: "Elektron shartnomalar, imzo va xavfsiz hamkorlik." },
  { icon: I.trophy, t: "BLOGER REYTINGI", d: "Reyting, baholash va o'sish imkoniyatlari." },
  { icon: I.play, t: "MEDIA MARKETPLACE", d: "Kampaniyalar, reklama va hamkorlik bozori." },
]

const defaultFeatures = [
  { icon: I.robot, t: "AI TEXNOLOGIYALAR", d: "AI yordamida kontent yaratish, tahlil qilish va rivojlantirish." },
  { icon: I.sprout, t: "SMART FARMING", d: "Zamonaviy texnologiyalar va innovatsion yechimlar." },
  { icon: I.book, t: "BILIM VA TA'LIM", d: "Agro bilimlar, kurslar va professional ta'lim." },
  { icon: I.media, t: "MEDIA RESURSLAR", d: "Video, maqola, intervyu va foydali kontentlar." },
  { icon: I.chart, t: "ANALITIKA", d: "Ma'lumotlar tahlili, statistika va samaradorlik o'lchovi." },
  { icon: I.send, t: "O'SISH VA DAROMAD", d: "Reyting, imkoniyat va daromad manbalari." },
]

const iconMap: Record<string, string> = {
  brain: I.brain, task: I.task, doc: I.doc, trophy: I.trophy, play: I.play,
  robot: I.robot, sprout: I.sprout, book: I.book, media: I.media, chart: I.chart, send: I.send,
  building: I.building, shield: I.shield, users: I.users, globe: I.globe, leaf: I.leaf,
}

type SectionItem = { title: string; description: string; icon: string; link: string }
type Section = { section_key: string; title: string; subtitle: string; items: SectionItem[] }

function Hero() {
  const [heroCards, setHeroCards] = useState(defaultHeroCards)
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
        <Link to="/kirish" className="inline-flex items-center gap-2 rounded-xl bg-green px-7 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
          PLATFORMAGA KIRISH
          <Icon d={I.arrow} className="h-5 w-5" />
        </Link>
              <a href="#" className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 bg-white px-7 py-3.5 font-bold text-ink transition-colors hover:border-green hover:text-green">
                HAMKOR BO'LISH
                <Icon d={I.users} className="h-5 w-5" />
              </a>
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
  const [features, setFeatures] = useState(defaultFeatures)
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
            <Icon d={I.leaf} className="h-6 w-6" />
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

function LatestNews() {
  const [news, setNews] = useState<NewsItem[]>([])
  useEffect(() => {
    api<{ news: NewsItem[] }>("/public/news?per_page=6").then((d) => setNews(d.news || [])).catch(() => {})
  }, [])
  if (news.length === 0) return null
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-16 lg:px-8">
      <Reveal>
        <div className="mb-10 flex items-end justify-between">
          <div>
            <span className="text-sm font-bold text-green">YANGILIKLAR</span>
            <h2 className="mt-2 font-display text-[clamp(1.6rem,4vw,2.6rem)] font-extrabold tracking-tight">OXIRGI YANGILIKLAR</h2>
          </div>
          <Link to="/yangiliklar" className="hidden items-center gap-2 rounded-xl border-2 border-green/30 px-5 py-2.5 text-sm font-bold transition-colors hover:border-green hover:text-green sm:inline-flex">
            Barchasi <Icon d={I.arrow} className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {news.map((n, i) => (
          <Reveal key={n.slug} delay={(i % 3) * 80}>
            <Link to={`/yangiliklar/${n.slug}`} className="group block overflow-hidden rounded-2xl border border-green/10 bg-white shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(91,180,32,0.14)]">
              <div className="h-40 overflow-hidden">
                <img src={newsImg(n.seed)} alt={n.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="p-5">
                <span className="text-xs font-bold uppercase tracking-wide text-green">{n.cat}</span>
                <h3 className="mt-2 font-display font-bold leading-snug transition-colors group-hover:text-green">{n.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted line-clamp-2">{n.desc}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>{n.date}</span>
                  <span className="flex items-center gap-1"><Icon d={I.eye} className="h-3.5 w-3.5" /> {n.views}</span>
                </div>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
      <Link to="/yangiliklar" className="mt-8 inline-flex items-center gap-2 rounded-xl border-2 border-green/30 px-6 py-3 text-sm font-bold transition-colors hover:border-green hover:text-green sm:hidden">
        Barcha yangiliklar <Icon d={I.arrow} className="h-4 w-4" />
      </Link>
    </section>
  )
}

function TopBloggers() {
  const [bloggers, setBloggers] = useState<BloggerItem[]>([])
  useEffect(() => {
    api<{ bloggers: BloggerItem[] }>("/public/bloggers?per_page=6").then((d) => setBloggers(d.bloggers || [])).catch(() => {})
  }, [])
  if (bloggers.length === 0) return null
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-16 lg:px-8">
      <Reveal>
        <div className="mb-10 flex items-end justify-between">
          <div>
            <span className="text-sm font-bold text-green">BLOGLERLAR</span>
            <h2 className="mt-2 font-display text-[clamp(1.6rem,4vw,2.6rem)] font-extrabold tracking-tight">ENG YAXSHI BLOGLERLAR</h2>
          </div>
          <Link to="/blogerlar" className="hidden items-center gap-2 rounded-xl border-2 border-green/30 px-5 py-2.5 text-sm font-bold transition-colors hover:border-green hover:text-green sm:inline-flex">
            Barchasi <Icon d={I.arrow} className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {bloggers.map((b, i) => (
          <Reveal key={b.id} delay={(i % 3) * 80}>
            <Link to={`/blogerlar/${b.id}`} className="group flex items-center gap-4 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(91,180,32,0.14)]">
              {b.avatar ? <img src={b.avatar} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-4 ring-soft" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-green/10 font-display text-xl font-bold text-green">{b.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>}
              <div className="min-w-0">
                <h3 className="font-display font-bold transition-colors group-hover:text-green">{b.name}</h3>
                <p className="mt-1 text-sm text-muted">{b.niche || "Bloger"}</p>
                {b.region && <p className="text-xs text-muted">{b.region}</p>}
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-16 lg:px-8">
      <div className="overflow-hidden rounded-3xl bg-green px-8 py-12 text-center text-white lg:px-16 lg:py-16">
        <Reveal>
          <h2 className="font-display text-[clamp(1.6rem,4vw,2.6rem)] font-extrabold tracking-tight">PLATFORMAGA QO'SHILING</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/80">Agro Alliance platformasida o'z o'rningizni toping. Bloger, hamkor yoki oddiy foydalanuvchi — hammamiz uchun joy bor.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/royxatdan-otish" className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 font-bold text-green shadow-lg transition-transform hover:scale-105">
              RO'YXATDAN O'TISH <Icon d={I.arrow} className="h-5 w-5" />
            </Link>
            <Link to="/blogerlar" className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 px-7 py-3.5 font-bold text-white transition-colors hover:bg-white/10">
              BLOGLERLARNI KO'RISH
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <StatsBar />
      <Features />
      <LatestNews />
      <TopBloggers />
      <CTA />
      <Newsletter />
    </>
  )
}
