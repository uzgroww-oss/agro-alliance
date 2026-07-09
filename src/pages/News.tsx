import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Reveal, Icon, I } from "../lib/ui"
import { cats, newsCatLabel as catLabel, type News as NewsType, loadNews, loadPopularNews, type NewsListResponse, themes, dates, newsImg, type News } from "../lib/news"
import Newsletter from "../components/Newsletter"

const mascot = "/mascot-news.webp"

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
        <img src={newsImg(n.seed)} alt={n.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
          {options.map((o) => <option key={o} value={o}>{o}</option>) }
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
  // UI state
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState("all")
  const [theme, setTheme] = useState("Barchasi")
  const [date, setDate] = useState("Barchasi")
  const [page, setPage] = useState(1)

  // data & status
  const [data, setData] = useState<NewsListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [popularNews, setPopularNews] = useState<{ title: string; date: string; views: string; seed: string; slug: string }[]>([])

  // reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [cat, theme, date, query])

  // load popular news
  useEffect(() => {
    loadPopularNews().then(setPopularNews).catch(() => {})
  }, [])

  // load data
  useEffect(() => {
    setLoading(true)
    setError("")
    loadNews({
      category: cat !== "all" ? cat : undefined,
      search: query.trim() || undefined,
      page,
      per_page: 12,
    })
      .then((res) => setData(res))
      .catch((e) => setError(e?.message || "Xatolik"))
      .finally(() => setLoading(false))
  }, [cat, theme, date, query, page])

  // client‑side extra filters (theme & date) – simple contains check for illustration
  const applyExtraFilters = (list: News[]) => {
    return list.filter((n) => {
      let okTheme = true
      if (theme !== "Barchasi") {
        const t = theme.toLowerCase()
        okTheme = n.title.toLowerCase().includes(t) || n.desc.toLowerCase().includes(t)
      }
      // date filter – naive string match (real implementation would parse dates)
      let okDate = true
      if (date !== "Barchasi") {
        okDate = n.date.includes(date)
      }
      return okTheme && okDate
    })
  }

  const newsList = useMemo(() => {
    if (!data) return []
    const filtered = applyExtraFilters(data.news)
    return filtered
  }, [data, theme, date])

  const pagination = data?.pagination

  // featured / side logic – only on first page when there is enough data
const featured = page === 1 && newsList[0]
const side = page === 1 && newsList.slice(1, 3)

  const reset = () => { setQuery(""); setCat("all"); setTheme("Barchasi"); setDate("Barchasi") }

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
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Yangiliklar ichida qidirish..." className="w-full rounded-xl border border-green/15 bg-white py-3 pl-10 pr-4 text-sm outline-none hover:border-green/40 focus:border-green" />
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
                      <button onClick={() => setCat(c.key)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-green/10 text-green" : "text-ink/70 hover:bg-soft"}`}
>                      <span className="flex items-center gap-2.5"><Icon d={c.icon} className="h-4 w-4" /> {c.label}</span>
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
                {popularNews.length > 0 ? popularNews.map((p, i) => (
                  <li key={p.title}>
                    <Link to={`/yangiliklar/${p.slug}`} className="group flex gap-3">
                      <span className="relative shrink-0">
                        <img src={newsImg(p.seed, 120, 120)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                        <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-green text-[11px] font-bold text-white">{i + 1}</span>
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-green">{p.title}</p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted"><span>{p.date}</span>·<span className="flex items-center gap-0.5"><Icon d={I.eye} className="h-3 w-3" /> {p.views}</span></div>
                      </div>
                    </Link>
                  </li>
                )) : (
                  <li className="py-4 text-center text-sm text-muted">Hozircha mashhur yangiliklar yo'q</li>
                )}
              </ul>
            </div>

            <div className="rounded-2xl border border-green/15 bg-soft p-5">
              <h3 className="font-display font-extrabold leading-tight">Yangiliklardan xabardor bo'ling!</h3>
              <p className="mt-2 text-sm text-muted">Eng so'nggi yangiliklarni email orqali olib boring.</p>
              <input placeholder="Email manzilingiz" className="mt-4 w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
              <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-green px-4 py-3 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-[1.02]">
                OBUNA BO'LISH <Icon d={I.send} className="h-4 w-4" />
              </button>
            </div>
          </aside>

          {/* Main */}
          <div className="min-w-0">
            {loading && <div className="text-center py-12 text-muted">Yuklanmoqda…</div>}
            {error && <div className="text-center py-12 text-red-600">{error}</div>}
            {!loading && !error && (
              <>
                {featured && (
                  <div className="mb-7 grid gap-6 lg:grid-cols-2">
                    {/* Featured */}
                    <Reveal>
                      <Link to={`/yangiliklar/${featured.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-green/10 bg-white shadow-[0_6px_28px_rgba(91,180,32,0.08)]">
                        <div className="relative h-60 overflow-hidden">
                          <img src={newsImg(featured.seed, 800, 500)} alt={featured.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
                      {side && side.map((n) => (
                        <Reveal key={n.title} delay={80}>
                          <Link to={`/yangiliklar/${n.slug}`} className="group flex overflow-hidden rounded-2xl border border-green/10 bg-white shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
                            <div className="h-auto w-2/5 shrink-0 overflow-hidden">
                              <img src={newsImg(n.seed, 400, 400)} alt={n.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
                {newsList.length === 0 ? (
                  <div className="rounded-2xl border border-green/10 bg-white py-20 text-center text-muted">Hech narsa topilmadi.</div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {newsList.map((n, i) => (
                      <Reveal key={n.slug} delay={(i % 3) * 70}><NewsCard n={n} /></Reveal>
                    ))}
                  </div>
                )}
                {/* Pagination */}
                {pagination && pagination.total_pages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}
                      className={`grid h-10 w-10 place-items-center rounded-lg border ${page === 1 ? "border-gray-300 bg-gray-100 text-gray-400" : "border-green/15 bg-white text-muted hover:border-green hover:text-green"}`}
                    >
                      <Icon d={I.chevLeft} className="h-4 w-4" />
                    </button>
                    {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((p) => (
                      <button key={p} onClick={() => setPage(p)} className={`grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-bold transition-colors ${p === page ? "bg-green text-white shadow-lg shadow-green/30" : "border border-green/15 bg-white text-ink/70 hover:border-green hover:text-green"}`}>{p}</button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(p + 1, pagination.total_pages))} disabled={page === pagination.total_pages}
                      className={`grid h-10 w-10 place-items-center rounded-lg border ${page === pagination.total_pages ? "border-gray-300 bg-gray-100 text-gray-400" : "border-green/15 bg-white text-muted hover:border-green hover:text-green"}`}
                    >
                      <Icon d={I.chevRight} className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Bottom newsletter */}
      <Newsletter />
    </>
  )
}
