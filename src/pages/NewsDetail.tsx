import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import DOMPurify from "dompurify"
import { Reveal, Icon, I, Skeleton } from "../lib/ui"
import { newsCatLabel as catLabel, loadNewsDetail, loadRelatedNews, newsImg, type News } from "../lib/news"
import { useSeo, newsSeo, SITE_URL } from "../lib/seo"

export default function NewsDetail() {
  const { slug } = useParams()
  const [article, setArticle] = useState<News | null>(null)
  const [related, setRelated] = useState<News[]>([])
  const [relatedLoading, setRelatedLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const shareUrl = `${SITE_URL}/yangiliklar/${slug ?? ""}`

  useEffect(() => {
    if (!slug) return
    let alive = true
    loadNewsDetail(slug)
      .then((a) => { if (alive) setArticle(a) })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Yuklashda xatolik") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [slug])

  useEffect(() => {
    if (!slug) return
    let alive = true
    setRelatedLoading(true)
    loadRelatedNews(slug).then((list) => { if (alive) setRelated(list) }).finally(() => { if (alive) setRelatedLoading(false) })
    return () => { alive = false }
  }, [slug])

  useEffect(() => { window.scrollTo(0, 0) }, [slug])

  // Maqola yuklangach sarlavha/meta uning nomiga o'zgaradi (ijtimoiy
  // tarmoqda ulashilganda to'g'ri ko'rinsin)
  useSeo(article ? newsSeo({
    title: article.title,
    desc: article.desc,
    image: newsImg(article.seed, 1200, 630),
  }) : null)

  if (loading) {
    return (
      <div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="mt-6 h-10 w-full max-w-2xl" />
        <Skeleton className="mt-3 h-10 w-2/3 max-w-xl" />
        <Skeleton className="mt-6 h-72 w-full rounded-2xl" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />)}
        </div>
      </div>
    )
  }

  if (error || !article) {
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

  const more = related

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
            <img src={newsImg(article.seed || article.slug, 1000, 560)} alt={article.title} className="h-auto w-full object-cover" />
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-7 space-y-5 text-[17px] leading-relaxed text-ink/80">
            <p className="text-lg font-medium text-ink">{article.desc}</p>
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.body.join("")) }} />
          </div>
        </Reveal>

        {/* Share */}
        <Reveal delay={160}>
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-green/10 pt-6">
            <span className="text-sm font-semibold text-muted">Ulashish:</span>
            {/* Ilgari to'rttasi ham href="#" edi — hech narsa qilmasdi.
                Instagram havola orqali ulashishni qo'llab-quvvatlamaydi,
                shuning uchun uning o'rniga "havolani nusxalash" qo'yildi. */}
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(article.title)}`}
              target="_blank" rel="noreferrer" title="Telegram orqali ulashish"
              className="grid h-10 w-10 place-items-center rounded-lg bg-soft text-green transition-colors hover:bg-green hover:text-white"
            ><Icon d={I.telegram} className="h-4 w-4" /></a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank" rel="noreferrer" title="Facebook orqali ulashish"
              className="grid h-10 w-10 place-items-center rounded-lg bg-soft text-green transition-colors hover:bg-green hover:text-white"
            ><Icon d={I.facebook} className="h-4 w-4" /></a>
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(shareUrl).then(() => setCopied(true)); setTimeout(() => setCopied(false), 2000) }}
              title="Havolani nusxalash"
              className="grid h-10 w-10 place-items-center rounded-lg bg-soft text-green transition-colors hover:bg-green hover:text-white"
            ><Icon d={copied ? I.check : I.link2} className="h-4 w-4" /></button>
            {copied && <span className="text-xs font-semibold text-green">Nusxalandi</span>}
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
        {relatedLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-green/10 bg-white">
                <Skeleton className="h-40 w-full" />
                <div className="space-y-3 p-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-full" /></div>
              </div>
            ))}
          </div>
        ) : more.length === 0 ? (
          <div className="rounded-2xl border border-green/10 bg-white py-12 text-center text-muted">O'xshash yangiliklar topilmadi.</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((n, i) => (
              <Reveal key={n.slug} delay={(i % 3) * 80}>
                <Link to={`/yangiliklar/${n.slug}`} className="group block overflow-hidden rounded-2xl border border-green/10 bg-white shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(91,180,32,0.14)]">
                  <div className="h-40 overflow-hidden">
                    <img src={newsImg(n.seed || n.slug, 400, 260)} alt={n.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
        )}
      </section>
    </div>
  )
}
