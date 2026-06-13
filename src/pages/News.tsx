import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Reveal, Icon, I } from "../lib/ui"
import { news, cats, catLabel, popular, themes, dates, newsImg as img, type News } from "../lib/news"

const mascot = "/mascot-news.png"

/* ---------- Small components ---------- */
function CatTag({ k }: { k: string }) {
  return <span className="text-xs font-bold uppercase tracking-wide text-green">{catLabel(k)}</span>
}
function Meta({ date, views }: { date: string; views: string }) {
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-muted">
      <span>{date}</span>
      <span className="flex items-center gap-1"><Icon d={I.eye} className="h-3.5 w-3.5" /> {views}</span>
    </div>
  )
}
function NewsCard({ n }: { n: News }) {
  return (
    <Link to={`/yangiliklar/${n.slug}`} className="group block overflow-hidden rounded-2xl border border-green/10 bg-white shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(91,180,32,0.14)]">
      <div className="h-40 overflow-hidden">
        <img src={img(n.seed)} alt={n.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="p-5">
        <CatTag k={n.cat} />
        <h3 className="mt-2 font-display font-bold leading-snug transition-colors group-hover:text-green">{n.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{n.desc}</p>
        <Meta date={n.date} views={n.views} />
      </div>
    </Link>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none rounded-xl border border-green/15 bg-white px-4 py-3 pr-9 text-sm font-medium outline-none transition-colors hover:border-green/40 focus:border-green">
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <Icon d={I.chevDown} className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </label>
  )
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-soft via-white to-white" />
        <div className="absolute -left-40 top-6 h-80 w-80 rounded-full bg-green/15 blur-3xl" />
      </div>
      <div className="mx-auto max-w-[1320px] px-5 pt-7 lg:px-8">
        <Reveal>
          <nav className="flex items-center gap-2 text-sm text-muted">
            <Link to="/" className="flex items-center gap-1.5 hover:text-green">
              <Icon d="M3 12l9-9 9 9 M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" className="h-4 w-4" /> Bosh sahifa
            </Link>
            <span>/</span><span className="font-semibold text-green">Yangiliklar</span>
          </nav>
        </Reveal>
        <div className="grid items-center gap-6 py-6 lg:grid-cols-[1fr_auto]">
          <div>
            <Reveal>
              <h1 className="font-display text-[clamp(2.6rem,7vw,4.4rem)] font-extrabold leading-[0.95] tracking-[-0.03em]">
                YANGI<span className="text-green">LIKLAR</span>
              </h1>
            </Reveal>
            <Reveal delay={90}>
              <p className="mt-4 max-w-md leading-relaxed text-muted">
                Qishloq xo'jaligi, agro texnologiyalar va sohadagi so'nggi yangiliklar bilan tanishing.
              </p>
            </Reveal>
          </div>
          <img src={mascot} alt="" className="animate-float hidden h-52 object-contain drop-shadow-2xl lg:block" />
        </div>
      </div>
    </section>
  )
}

/* ---------- Page ---------- */
export default function News() {
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState("all")
  const [theme, setTheme] = useState("Barchasi")
  const [date, setDate] = useState("Barchasi")

  const filtered = useMemo(() => {
    return news.filter((n) => {
      const okCat = cat === "all" || n.cat === cat
      const okQuery = !query.trim() || n.title.toLowerCase().includes(query.toLowerCase()) || n.desc.toLowerCase().includes(query.toLowerCase())
      return okCat && okQuery
    })
  }, [query, cat])

  const isFiltered = cat !== "all" || query.trim() !== ""
  const reset = () => { setQuery(""); setCat("all"); setTheme("Barchasi"); setDate("Barchasi") }

  const featured = news[0]
  const side = [news[1], news[2]]
  const rest = news.slice(3)

  return (
    <>
      <Hero />

      {/* Filter bar */}
      <section className="mx-auto max-w-[1320px] px-5 lg:px-8">
        <div className="rounded-3xl border border-green/10 bg-white p-5 shadow-[0_8px_30px_rgba(91,180,32,0.07)]">
          <div className="grid gap-4 lg:grid-cols-[1.6fr_repeat(3,1fr)_auto] lg:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Qidiruv</span>
              <div className="relative">
                <Icon d={I.search} className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Yangiliklar ichida qidirish..." className="w-full rounded-xl border border-green/15 bg-white py-3 pl-10 pr-4 text-sm outline-none transition-colors hover:border-green/40 focus:border-green" />
              </div>
            </label>
            <Select label="Kategoriya" value={catLabel(cat)} onChange={(v) => setCat(cats.find((c) => c.label === v)?.key ?? "all")} options={cats.map((c) => c.label)} />
            <Select label="Mavzu" value={theme} onChange={setTheme} options={themes} />
            <Select label="Sana" value={date} onChange={setDate} options={dates} />
            <button onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-green/30 bg-white px-5 py-3 text-sm font-bold transition-colors hover:border-green hover:text-green">
              FILTRNI TOZALASH
              <Icon d="M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8">
        <div className="grid gap-7 lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <aside className="flex min-w-0 flex-col gap-6">
            <div className="rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
              <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">KATEGORIYALAR</h3>
              <ul className="mt-4 space-y-1">
                {cats.map((c) => {
                  const active = c.key === cat
                  return (
                    <li key={c.key}>
                      <button onClick={() => setCat(c.key)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-green/10 text-green" : "text-ink/70 hover:bg-soft"}`}>
                        <span className="flex items-center gap-2.5"><Icon d={c.icon} className="h-4 w-4" /> {c.label}</span>
                        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${active ? "bg-green text-white" : "bg-soft text-muted"}`}>{c.count}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
              <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">ENG KO'P O'QILGAN</h3>
              <ul className="mt-4 space-y-3">
                {popular.map((p, i) => (
                  <li key={p.title}>
                    <Link to={`/yangiliklar/${p.slug}`} className="group flex gap-3">
                      <span className="relative shrink-0">
                        <img src={img(p.seed, 120, 120)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                        <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-green text-[11px] font-bold text-white">{i + 1}</span>
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-green">{p.title}</p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                          <span>{p.date}</span>·<span className="flex items-center gap-0.5"><Icon d={I.eye} className="h-3 w-3" /> {p.views}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-green/15 bg-soft p-5">
              <h3 className="font-display font-extrabold leading-tight">Yangiliklardan xabardor bo'lib boring!</h3>
              <p className="mt-2 text-sm text-muted">Eng so'nggi yangiliklarni email orqali olib boring.</p>
              <input placeholder="Email manzilingiz" className="mt-4 w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
              <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-green px-4 py-3 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-[1.02]">
                OBUNA BO'LISH <Icon d={I.send} className="h-4 w-4" />
              </button>
            </div>
          </aside>

          {/* Main */}
          <div className="min-w-0">
            {!isFiltered && (
              <div className="mb-7 grid gap-6 lg:grid-cols-2">
                {/* Featured */}
                <Reveal>
                  <Link to={`/yangiliklar/${featured.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-green/10 bg-white shadow-[0_6px_28px_rgba(91,180,32,0.08)]">
                    <div className="relative h-60 overflow-hidden">
                      <img src={img(featured.seed, 800, 500)} alt={featured.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow"><Icon d={I.trophy} className="h-3.5 w-3.5" /> TOP</span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <CatTag k={featured.cat} />
                      <h3 className="mt-2 font-display text-xl font-bold leading-snug transition-colors group-hover:text-green">{featured.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{featured.desc}</p>
                      <div className="mt-auto"><Meta date={featured.date} views={featured.views} /></div>
                    </div>
                  </Link>
                </Reveal>
                {/* Two stacked side cards */}
                <div className="flex flex-col gap-6">
                  {side.map((n) => (
                    <Reveal key={n.title} delay={80}>
                      <Link to={`/yangiliklar/${n.slug}`} className="group flex overflow-hidden rounded-2xl border border-green/10 bg-white shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
                        <div className="h-auto w-2/5 shrink-0 overflow-hidden">
                          <img src={img(n.seed, 400, 400)} alt={n.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        </div>
                        <div className="p-4">
                          <CatTag k={n.cat} />
                          <h3 className="mt-1.5 font-display font-bold leading-snug transition-colors group-hover:text-green">{n.title}</h3>
                          <Meta date={n.date} views={n.views} />
                        </div>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              </div>
            )}

            {/* Grid */}
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-green/10 bg-white py-20 text-center text-muted">Hech narsa topilmadi.</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {(isFiltered ? filtered : rest).map((n, i) => (
                  <Reveal key={n.title} delay={(i % 3) * 70}><NewsCard n={n} /></Reveal>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="mt-10 flex items-center justify-center gap-2">
              <button className="grid h-10 w-10 place-items-center rounded-lg border border-green/15 bg-white text-muted hover:border-green hover:text-green"><Icon d={I.chevLeft} className="h-4 w-4" /></button>
              {["1", "2", "3", "4", "…", "12"].map((p, i) => (
                <button key={i} className={`grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-bold transition-colors ${p === "1" ? "bg-green text-white shadow-lg shadow-green/30" : "border border-green/15 bg-white text-ink/70 hover:border-green hover:text-green"}`}>{p}</button>
              ))}
              <button className="grid h-10 w-10 place-items-center rounded-lg border border-green/15 bg-white text-muted hover:border-green hover:text-green"><Icon d={I.chevRight} className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom newsletter */}
      <section className="mx-auto max-w-[1320px] px-5 pb-16 lg:px-8">
        <Reveal>
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-green/15 bg-soft px-8 py-9 lg:flex-row lg:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-green/15 text-green"><Icon d={I.mail} className="h-7 w-7" /></span>
              <div>
                <h3 className="font-display text-xl font-extrabold leading-tight">Yangiliklardan birinchilardan bo'lib xabardor bo'ling!</h3>
                <p className="mt-1 text-sm text-muted">Eng so'nggi yangiliklar va maqolalarni email orqali oling.</p>
              </div>
            </div>
            <div className="flex w-full gap-3 lg:w-auto">
              <input placeholder="Email manzilingiz" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3.5 text-sm outline-none focus:border-green lg:w-64" />
              <button className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green px-6 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
                OBUNA BO'LISH <Icon d={I.send} className="h-5 w-5" />
              </button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
