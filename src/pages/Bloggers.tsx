import { useEffect, useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { Reveal, Icon, I, Skeleton, ErrorState } from "../lib/ui"
import { api } from "../lib/api"
import { categories, catLabel, regions, sorts, platforms, cover, loadBloggers, loadTopBlogger, type Blogger } from "../lib/bloggers"
import { useStaticSeo } from "../lib/seo"


const mascot = "/mascot3.webp"

type HeroStat = { icon: string; v: string; l: string }

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-green/15 bg-white px-4 py-3 pr-9 text-sm font-medium text-ink outline-none transition-colors hover:border-green/40 focus:border-green"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <Icon d={I.chevDown} className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </label>
  )
}

function Socials() {
  return (
    <div className="flex gap-1.5">
      {[I.youtube, I.instagram, I.tiktok].map((d, i) => (
        <span key={i} className="grid h-7 w-7 place-items-center rounded-md bg-soft text-green">
          <Icon d={d} className="h-3.5 w-3.5" />
        </span>
      ))}
    </div>
  )
}

function Hero({ topBlogger, topLoading }: { topBlogger: Blogger | null; topLoading: boolean }) {
  // "0+" o'rniga "…" — nol real raqamdek ko'rinib qolmasin.
  const [heroStats, setHeroStats] = useState<HeroStat[]>([
    { icon: I.users, v: "…", l: "Faol blogerlar" },
    { icon: I.sprout, v: "20+", l: "Yo'nalishlar" },
    { icon: I.building, v: "5M+", l: "Jami auditoriya" },
    { icon: I.play, v: "50M+", l: "Oylik ko'rishlar" },
  ])

  useEffect(() => {
    api<{ pagination: { total: number } }>("/public/bloggers?per_page=1&page=1")
      .then((res) => {
        const total = res?.pagination?.total ?? 0
        setHeroStats((prev) =>
          prev.map((s) =>
            s.l === "Faol blogerlar" ? { ...s, v: `${total}+` } : s
          )
        )
      })
      .catch(() => {})
  }, [])
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
            <span className="font-semibold text-green">Blogerlar</span>
          </nav>
        </Reveal>

        <div className="grid gap-8 pt-8 pb-8 xl:grid-cols-[1fr_0.7fr_330px]">
          <div className="flex flex-col justify-center">
            <Reveal>
              <h1 className="font-display text-[clamp(2.8rem,7vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.03em]">
                BLOGER<span className="text-green">LAR</span>
              </h1>
            </Reveal>
            <Reveal delay={90}>
              <p className="mt-5 max-w-md leading-relaxed text-muted">
                Agro sohada faoliyat yuritayotgan eng yaxshi blogerlarimiz bilan tanishing.
                Kerakli blogerni toping va hamkorlikni boshlang.
              </p>
            </Reveal>
            <Reveal delay={160}>
              <div className="mt-8 grid max-w-lg grid-cols-2 gap-5 sm:grid-cols-4">
                {heroStats.map((s) => (
                  <div key={s.l} className="flex items-center gap-2.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-green/20 text-green">
                      <Icon d={s.icon} className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-display text-lg font-extrabold leading-none">{s.v}</div>
                      <div className="mt-0.5 text-[11px] text-muted">{s.l}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="relative hidden items-center justify-center xl:flex">
            <img src={mascot} alt="Agro Alliance" className="animate-float relative w-full max-w-[380px] object-contain drop-shadow-2xl" />
          </div>

          {/* Yuklab bo'lgach bloger topilmasa kartani umuman chizmaymiz:
              aks holda "—" / "0" / "0" real ma'lumotdek ko'rinardi. */}
          {(topLoading || topBlogger) && (
          <Reveal delay={160}>
            <div className="rounded-3xl border border-green/10 bg-white p-6 shadow-[0_12px_44px_rgba(91,180,32,0.12)]">
              <div className="flex items-center gap-2 text-green">
                <Icon d={I.trophy} className="h-5 w-5" />
                <span className="font-display text-sm font-bold tracking-wide">TOP BLOGER</span>
              </div>
              <div className="mt-5 flex flex-col items-center text-center">
                <div className="relative">
                  {topLoading ? (
                    <Skeleton className="h-20 w-20 rounded-full" />
                  ) : topBlogger ? (
                    <>
                      <img
                        src={topBlogger.avatar || cover(topBlogger.seed)}
                        alt=""
                        className="h-20 w-20 rounded-full object-cover ring-4 ring-soft"
                        onError={(e) => { (e.target as HTMLImageElement).src = cover(topBlogger.seed) }}
                      />
                      <span className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-green text-xs font-bold text-white ring-2 ring-white">1</span>
                    </>
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-soft ring-4 ring-soft" />
                  )}
                </div>
                {topLoading
                  ? <Skeleton className="mt-3 h-5 w-32" />
                  : <h3 className="mt-3 font-display font-bold">{topBlogger?.name || "—"}</h3>}
                <p className="text-xs text-muted">{topBlogger?.tag || ""}</p>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                {[
                  // Yuklanayotganda "0" emas "…": ilgari bo'sh karta real
                  // bloger ma'lumotidek ko'rinardi.
                  { icon: I.users, v: topLoading ? "…" : topBlogger?.subs || "0", l: "Obunachilar" },
                  { icon: I.play, v: topLoading ? "…" : topBlogger?.views || "0", l: "Ko'rishlar" },
                  { icon: I.star, v: topLoading ? "…" : topBlogger?.rating?.toString() || "0", l: "Reyting" },
                ].map((x) => (
                  <div key={x.l}>
                    <Icon d={x.icon} className="mx-auto h-4 w-4 text-green" />
                    <div className="mt-1 font-display text-sm font-extrabold">{x.v}</div>
                    <div className="text-[10px] text-muted">{x.l}</div>
                  </div>
                ))}
              </div>
              {topBlogger && (
                <Link to={`/blogerlar/${topBlogger.slug}`} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-green px-4 py-3 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
                  PROFILNI KO'RISH
                  <Icon d={I.arrow} className="h-4 w-4" />
                </Link>
              )}
            </div>
          </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}

export default function Bloggers() {
  useStaticSeo("/blogerlar")
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState("all")
  const [region, setRegion] = useState("Barchasi")
  const [platform, setPlatform] = useState("Barchasi")
  const [sort, setSort] = useState("Barchasi")
  const [page, setPage] = useState(1)
  const [bloggersList, setBloggersList] = useState<Blogger[]>([])
  const [pagination, setPagination] = useState({ page: 1, per_page: 12, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [topBlogger, setTopBlogger] = useState<Blogger | null>(null)
  const [topLoading, setTopLoading] = useState(true)

  useEffect(() => {
    loadTopBlogger().then(setTopBlogger).catch(() => {}).finally(() => setTopLoading(false))
  }, [])

  const load = useCallback((p: number) => {
    // MUHIM: har qayta yuklashda (filtr/sahifa o'zgarganda ham) loading yoqiladi.
    // Ilgari faqat birinchi yuklash ko'rinardi: filtrni o'zgartirganda eski
    // ro'yxat hech qanday belgisiz turib, keyin birdan almashardi.
    setLoading(true)
    setFailed(false)
    loadBloggers({
      category: cat !== "all" ? cat : undefined,
      region: region !== "Barchasi" ? region : undefined,
      search: query.trim() || undefined,
      sort: sort !== "Barchasi" ? sort : undefined,
      platform: platform !== "Barchasi" ? platform : undefined,
      page: p,
      per_page: 12,
    })
      .then((res) => { setBloggersList(res.bloggers); setPagination(res.pagination) })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [cat, region, query, sort, platform])

  useEffect(() => {
    load(page)
  }, [load, page])

  const reset = () => {
    setQuery(""); setCat("all"); setRegion("Barchasi"); setPlatform("Barchasi"); setSort("Barchasi"); setPage(1)
  }

  return (
    <>
      <Hero topBlogger={topBlogger} topLoading={topLoading} />

      <section className="mx-auto max-w-[1320px] px-5 lg:px-8">
        <div className="rounded-3xl border border-green/10 bg-white p-5 shadow-[0_8px_30px_rgba(91,180,32,0.07)]">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_repeat(4,1fr)_auto] lg:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Qidiruv</span>
              <div className="relative">
                <Icon d={I.search} className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1) }}
                  placeholder="Ism yoki Instagram username (@...)"
                  className="w-full rounded-xl border border-green/15 bg-white py-3 pl-10 pr-4 text-sm outline-none transition-colors hover:border-green/40 focus:border-green"
                />
              </div>
            </label>
            <Select label="Yo'nalish" value={catLabel(cat)} onChange={(v) => { setCat(categories.find((c) => c.label === v)?.key ?? "all"); setPage(1) }} options={categories.map((c) => c.label)} />
            <Select label="Platforma" value={platform} onChange={(v) => { setPlatform(v); setPage(1) }} options={platforms} />
            <Select label="Hudud" value={region} onChange={(v) => { setRegion(v); setPage(1) }} options={regions} />
            <Select label="Saralash" value={sort} onChange={(v) => { setSort(v); setPage(1) }} options={sorts} />
            <button onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-green/30 bg-white px-5 py-3 text-sm font-bold text-ink transition-colors hover:border-green hover:text-green">
              FILTRNI TOZALASH
              <Icon d="M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-6 lg:px-8">
        <div className="flex flex-wrap gap-2.5">
          {categories.map((c) => {
            const active = c.key === cat
            return (
              <button
                key={c.key}
                onClick={() => { setCat(c.key); setPage(1) }}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                  active ? "border-green bg-green/10 text-green" : "border-green/15 bg-white text-ink/70 hover:border-green/40 hover:text-green"
                }`}
              >
                <Icon d={c.icon} className="h-4 w-4" />
                {c.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-10 lg:px-8">
        {/* Uch holat bir-birini istisno qiladi: yuklanmoqda / xato / natija.
            Ilgari yuklanayotganda skeleton bilan birga bo'sh grid ham chizilardi. */}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-green/10 bg-white">
                <Skeleton className="h-32 w-full" />
                <div className="space-y-3 p-5"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-9 w-full rounded-lg" /></div>
              </div>
            ))}
          </div>
        ) : failed ? (
          <ErrorState onRetry={() => load(page)} message="Blogerlar ro'yxatini yuklab bo'lmadi." />
        ) : bloggersList.length === 0 ? (
          <div className="rounded-3xl border border-green/10 bg-white py-20 text-center text-muted">
            Hech narsa topilmadi. Filtrlarni tozalab ko'ring.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {bloggersList.map((b, i) => (
              <Reveal key={b.slug} delay={(i % 3) * 80}>
                <div className="group overflow-hidden rounded-2xl border border-green/10 bg-white shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(91,180,32,0.14)]">
                  <div className="relative h-44 overflow-hidden">
                    {b.cover ? (
                      <img src={b.cover} alt={b.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green/20 to-green/5">
                        <span className="font-display text-4xl font-extrabold text-green/40">{b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                    {b.top && (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow">
                        <Icon d={I.trophy} className="h-3.5 w-3.5" /> TOP
                      </span>
                    )}
                    <span className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-green">
                      <Icon d={I.play} className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-display text-lg font-bold">{b.name}</h3>
                      <Icon d={I.verified} className="h-4 w-4 text-green" />
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{b.tag}</p>
                    <div className="mt-3"><Socials /></div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-green/10 pt-4 text-center">
                      <div>
                        <div className="font-display text-base font-extrabold">{b.subs}</div>
                        <div className="text-[10px] text-muted">Obunachilar</div>
                      </div>
                      <div>
                        <div className="font-display text-base font-extrabold">{b.eng}</div>
                        <div className="text-[10px] text-muted">Engagement</div>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1 font-display text-base font-extrabold">
                          <Icon d={I.star} className="h-3.5 w-3.5 text-green" /> {b.rating}
                        </div>
                        <div className="text-[10px] text-muted">Reyting</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 text-sm text-muted">
                      <Icon d={I.pin} className="h-4 w-4 text-green" /> {b.region}
                    </div>
                    <Link to={`/blogerlar/${b.slug}`} className="mt-4 flex items-center justify-center gap-2 rounded-xl border-2 border-green/25 bg-white px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:border-green hover:bg-green hover:text-white">
                      PROFILNI KO'RISH
                      <Icon d={I.arrow} className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {pagination.total_pages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className={`grid h-10 w-10 place-items-center rounded-lg border ${page === 1 ? "border-gray-200 bg-gray-100 text-gray-400" : "border-green/15 bg-white text-muted hover:border-green hover:text-green"}`}
            >
              <Icon d={I.chevLeft} className="h-4 w-4" />
            </button>
            {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-bold transition-colors ${p === page ? "bg-green text-white shadow-lg shadow-green/30" : "border border-green/15 bg-white text-ink/70 hover:border-green hover:text-green"}`}
              >
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))} disabled={page === pagination.total_pages}
              className={`grid h-10 w-10 place-items-center rounded-lg border ${page === pagination.total_pages ? "border-gray-200 bg-gray-100 text-gray-400" : "border-green/15 bg-white text-muted hover:border-green hover:text-green"}`}
            >
              <Icon d={I.chevRight} className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>
    </>
  )
}
