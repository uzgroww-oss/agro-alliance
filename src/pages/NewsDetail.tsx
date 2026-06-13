import { useEffect } from "react"
import { Link, useParams } from "react-router-dom"
import { Reveal, Icon, I } from "../lib/ui"
import { findNews, news, catLabel, newsImg as img } from "../lib/news"

export default function NewsDetail() {
  const { slug } = useParams()
  const article = findNews(slug)

  useEffect(() => window.scrollTo(0, 0), [slug])

  if (!article) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-[1320px] place-items-center px-5 text-center">
        <div>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-soft text-green"><Icon d={I.doc} className="h-8 w-8" /></span>
          <h1 className="mt-4 font-display text-2xl font-extrabold">Yangilik topilmadi</h1>
          <p className="mt-2 text-muted">Bu yangilik mavjud emas yoki o'chirilgan.</p>
          <Link to="/yangiliklar" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3 font-bold text-white shadow-lg shadow-green/30">
            <Icon d={I.chevLeft} className="h-4 w-4" /> Yangiliklarga qaytish
          </Link>
        </div>
      </div>
    )
  }

  const sameCat = news.filter((n) => n.cat === article.cat && n.slug !== article.slug)
  const others = news.filter((n) => n.slug !== article.slug && n.cat !== article.cat)
  const more = [...sameCat, ...others].slice(0, 3)

  return (
    <div className="mx-auto max-w-[1320px] px-5 pt-7 pb-16 lg:px-8">
      {/* Breadcrumb */}
      <Reveal>
        <nav className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link to="/" className="hover:text-green">Bosh sahifa</Link>
          <span>/</span>
          <Link to="/yangiliklar" className="hover:text-green">Yangiliklar</Link>
          <span>/</span>
          <span className="line-clamp-1 font-semibold text-green">{article.title}</span>
        </nav>
      </Reveal>

      <article className="mx-auto mt-6 max-w-[820px]">
        <Reveal>
          <span className="inline-block rounded-lg bg-green/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-green">{catLabel(article.cat)}</span>
          <h1 className="mt-4 font-display text-[clamp(1.9rem,4vw,3rem)] font-extrabold leading-tight tracking-[-0.02em]">{article.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span className="flex items-center gap-1.5"><Icon d="M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" className="h-4 w-4 text-green" /> {article.date}</span>
            <span className="flex items-center gap-1.5"><Icon d={I.eye} className="h-4 w-4 text-green" /> {article.views} ko'rish</span>
            {article.author && <span className="flex items-center gap-1.5"><Icon d={I.user} className="h-4 w-4 text-green" /> {article.author}</span>}
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-6 overflow-hidden rounded-3xl">
            <img src={img(article.seed, 1000, 560)} alt={article.title} className="h-auto w-full object-cover" />
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-7 space-y-5 text-[17px] leading-relaxed text-ink/80">
            <p className="text-lg font-medium text-ink">{article.desc}</p>
            {article.body.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </Reveal>

        {/* Share */}
        <Reveal delay={160}>
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-green/10 pt-6">
            <span className="text-sm font-semibold text-muted">Ulashish:</span>
            {[I.telegram, I.facebook, I.instagram, I.link2].map((d, i) => (
              <a key={i} href="#" className="grid h-10 w-10 place-items-center rounded-lg bg-soft text-green transition-colors hover:bg-green hover:text-white"><Icon d={d} className="h-4 w-4" /></a>
            ))}
            <Link to="/yangiliklar" className="ml-auto inline-flex items-center gap-2 rounded-xl border-2 border-green/25 px-5 py-2.5 text-sm font-bold transition-colors hover:border-green hover:text-green">
              <Icon d={I.chevLeft} className="h-4 w-4" /> Barcha yangiliklar
            </Link>
          </div>
        </Reveal>
      </article>

      {/* Related */}
      <section className="mt-14">
        <Reveal>
          <h2 className="mb-6 font-display text-2xl font-extrabold tracking-tight">O'xshash <span className="text-green">yangiliklar</span></h2>
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {more.map((n, i) => (
            <Reveal key={n.slug} delay={(i % 3) * 80}>
              <Link to={`/yangiliklar/${n.slug}`} className="group block overflow-hidden rounded-2xl border border-green/10 bg-white shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(91,180,32,0.14)]">
                <div className="h-40 overflow-hidden">
                  <img src={img(n.seed)} alt={n.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-5">
                  <span className="text-xs font-bold uppercase tracking-wide text-green">{catLabel(n.cat)}</span>
                  <h3 className="mt-2 font-display font-bold leading-snug transition-colors group-hover:text-green">{n.title}</h3>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted">
                    <span>{n.date}</span>
                    <span className="flex items-center gap-1"><Icon d={I.eye} className="h-3.5 w-3.5" /> {n.views}</span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  )
}
