import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Reveal, Icon, I } from "../lib/ui"
import { bloggers, categories, catLabel, regions, sorts, platforms, cover } from "../lib/bloggers"

const mascot = "/mascot3.webp"

const heroStats = [
  { icon: I.users, v: "120+", l: "Faol blogerlar" },
  { icon: I.sprout, v: "20+", l: "Yo'nalishlar" },
  { icon: I.building, v: "5M+", l: "Jami auditoriya" },
  { icon: I.play, v: "50M+", l: "Oylik ko'rishlar" },
]

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

          <Reveal delay={160}>
            <div className="rounded-3xl border border-green/10 bg-white p-6 shadow-[0_12px_44px_rgba(91,180,32,0.12)]">
              <div className="flex items-center gap-2 text-green">
                <Icon d={I.trophy} className="h-5 w-5" />
                <span className="font-display text-sm font-bold tracking-wide">TOP BLOGER</span>
              </div>
              <div className="mt-5 flex flex-col items-center text-center">
                <div className="relative">
                  <img src={cover("elyor")} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-soft" />
                  <span className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-green text-xs font-bold text-white ring-2 ring-white">1</span>
                </div>
                <h3 className="mt-3 font-display font-bold">Fermer Elyor</h3>
                <p className="text-xs text-muted">Issiqxona вЂў Fermerlik</p>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: I.play, v: "1.2M+", l: "Obunachilar" },
                  { icon: I.chart, v: "8.7%", l: "Engagement" },
                  { icon: I.star, v: "4.9", l: "Reyting" },
                ].map((x) => (
                  <div key={x.l}>
                    <Icon d={x.icon} className="mx-auto h-4 w-4 text-green" />
                    <div className="mt-1 font-display text-sm font-extrabold">{x.v}</div>
                    <div className="text-[10px] text-muted">{x.l}</div>
                  </div>
                ))}
              </div>
              <Link to="/blogerlar/elyor" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-green px-4 py-3 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
                PROFILNI KO'RISH
                <Icon d={I.arrow} className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export default function Bloggers() {
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState("all")
  const [region, setRegion] = useState("Barchasi")
  const [platform, setPlatform] = useState("Barchasi")
  const [sort, setSort] = useState("Barchasi")

  const list = useMemo(() => {
    let r = bloggers.filter((b) => {
      const okCat = cat === "all" || b.cat === cat
      const okRegion = region === "Barchasi" || b.region === region
      const okQuery =
        !query.trim() ||
        b.name.toLowerCase().includes(query.toLowerCase()) ||
        b.tag.toLowerCase().includes(query.toLowerCase())
      return okCat && okRegion && okQuery
    })
    if (sort === "Reyting bo'yicha") r = [...r].sort((a, b) => b.rating - a.rating)
    if (sort === "Obunachilar bo'yicha") r = [...r].sort((a, b) => b.subsNum - a.subsNum)
    return r
  }, [query, cat, region, sort])

  const reset = () => {
    setQuery(""); setCat("all"); setRegion("Barchasi"); setPlatform("Barchasi"); setSort("Barchasi")
  }

  return (
    <>
      <Hero />

      <section className="mx-auto max-w-[1320px] px-5 lg:px-8">
        <div className="rounded-3xl border border-green/10 bg-white p-5 shadow-[0_8px_30px_rgba(91,180,32,0.07)]">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_repeat(4,1fr)_auto] lg:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Qidiruv</span>
              <div className="relative">
                <Icon d={I.search} className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Bloger nomi yoki yo'nalishi..."
                  className="w-full rounded-xl border border-green/15 bg-white py-3 pl-10 pr-4 text-sm outline-none transition-colors hover:border-green/40 focus:border-green"
                />
              </div>
            </label>
            <Select label="Yo'nalish" value={catLabel(cat)} onChange={(v) => setCat(categories.find((c) => c.label === v)?.key ?? "all")} options={categories.map((c) => c.label)} />
            <Select label="Platforma" value={platform} onChange={setPlatform} options={platforms} />
            <Select label="Hudud" value={region} onChange={setRegion} options={regions} />
            <Select label="Saralash" value={sort} onChange={setSort} options={sorts} />
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
                onClick={() => setCat(c.key)}
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
        {list.length === 0 ? (
          <div className="rounded-3xl border border-green/10 bg-white py-20 text-center text-muted">
            Hech narsa topilmadi. Filtrlarni tozalab ko'ring.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((b, i) => (
              <Reveal key={b.slug} delay={(i % 3) * 80}>
                <div className="group overflow-hidden rounded-2xl border border-green/10 bg-white shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(91,180,32,0.14)]">
                  <div className="relative h-44 overflow-hidden">
                    <img src={cover(b.seed)} alt={b.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                    {b.top && (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow">
                        <Icon d={I.trophy} className="h-3.5 w-3.5" /> TOP
                      </span>
                    )}
                    <button className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-white/90 text-ink/70 transition-colors hover:text-green" aria-label="Saqlash">
                      <Icon d={I.bookmark} className="h-4 w-4" />
                    </button>
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

        <div className="mt-12 flex items-center justify-center gap-2">
          <button className="grid h-10 w-10 place-items-center rounded-lg border border-green/15 bg-white text-muted transition-colors hover:border-green hover:text-green">
            <Icon d={I.chevLeft} className="h-4 w-4" />
          </button>
          {["1", "2", "3", "4", "вЂ¦", "10"].map((p, i) => (
            <button
              key={i}
              className={`grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-bold transition-colors ${
                p === "1" ? "bg-green text-white shadow-lg shadow-green/30" : "border border-green/15 bg-white text-ink/70 hover:border-green hover:text-green"
              }`}
            >
              {p}
            </button>
          ))}
          <button className="grid h-10 w-10 place-items-center rounded-lg border border-green/15 bg-white text-muted transition-colors hover:border-green hover:text-green">
            <Icon d={I.chevRight} className="h-4 w-4" />
          </button>
        </div>
      </section>
    </>
  )
}
