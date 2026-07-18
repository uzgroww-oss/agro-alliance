import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Reveal, Icon, I, Skeleton, SkeletonStatGrid, ErrorState } from "../lib/ui"
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { api } from "../lib/api"

const platIconMap: Record<string, string> = {
  YouTube: I.youtube, Instagram: I.instagram, TikTok: I.tiktok,
  Telegram: I.telegram, Facebook: I.facebook, X: I.link2,
  LinkedIn: I.briefcase,
}
const fullUrl = (l: string) => (/^https?:\/\//i.test(l) ? l : "https://" + l)

type LiveBlogger = {
  ageDistribution: Record<string, number>; // e.g. {"18-24": 22}
  regionDistribution: Record<string, number>; // e.g. {"Toshkent": 40}
  genderDistribution: { male: number; female: number; other?: number };
  slug: string
  name: string
  status: string
  cover: string
  experienceYears: number
  bio: string
  profile: {
    photo: string
    region: string
    tag: string
    about: string
    [key: string]: string
  }
  stats: {
    subscribers: number
    views: number
    engagement: number
    videos: number
    activePlatforms: number
  }
  socials: { id: string; platform: string; link: string; name: string; avatar?: string; subscribers?: string; views?: string; engagement?: number }[]
  services: { id: string; title: string; description: string }[]
  achievements: { id: string; title: string; subtitle: string; icon: string }[]
  specializations: string[]
  regions: string[]
  brands: { id: string; name: string; logoUrl: string }[]
  images: { id: string; url: string; caption?: string }[]
  videos: { id: string; name: string; link: string; views: string; thumbnail?: string; plats?: string[]; date?: string }[]
}

// Reyting (0-5) va TOP % — engagement va obunachi soniga qarab avtomatik hisoblanadi
function bloggerRating(b: LiveBlogger): string {
  const s = b.stats
  if (!s.subscribers && !s.engagement) return "5.0"
  const engBonus = Math.min(0.5, (s.engagement || 0) / 20)  // engagement 10%+ → to'liq bonus
  const subBonus = s.subscribers >= 100000 ? 0.3 : s.subscribers >= 10000 ? 0.2 : s.subscribers >= 1000 ? 0.1 : 0
  return Math.min(5, 4.2 + engBonus + subBonus).toFixed(1)
}
function bloggerTop(b: LiveBlogger): string {
  const n = b.stats.subscribers
  if (n >= 100000) return "TOP 1%"
  if (n >= 50000) return "TOP 3%"
  if (n >= 10000) return "TOP 5%"
  if (n >= 1000) return "TOP 10%"
  if (n > 0) return "TOP 25%"
  return "Yangi"
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M+"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K+"
  return String(n)
}

/** Video nomidan hashteg (#tag) va ortiqcha bo'shliqlarni tozalash */
function cleanTitle(name: string): string {
  return (name || "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/\s+/g, " ")
    .trim() || "Video"
}

/* ---------- Content viewer modal ---------- */
function ContentModal({ item, onClose }: { item: { url: string; name: string; caption?: string }; onClose: () => void }) {
  // YouTube video ID ni olish
  const getYouTubeEmbedUrl = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return match ? `https://www.youtube.com/embed/${match[1]}` : null
  }

  // Instagram post URL'ni embed qilish
  const getInstagramEmbedUrl = (url: string): string | null => {
    if (url.includes("instagram.com")) return url
    return null
  }

  const youtubeEmbed = getYouTubeEmbedUrl(item.url)
  const instagramEmbed = getInstagramEmbedUrl(item.url)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-h-[90vh] max-w-3xl w-full mx-4 overflow-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-black/10 text-ink hover:bg-black/20 z-10"><Icon d="M18 6L6 18 M6 6l12 12" className="h-5 w-5" /></button>
        
        {youtubeEmbed ? (
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={youtubeEmbed}
              className="absolute inset-0 w-full h-full rounded-xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={item.name}
            />
          </div>
        ) : instagramEmbed ? (
          <div className="flex justify-center">
            <iframe
              src={`${instagramEmbed}embed/`}
              className="w-full max-w-md rounded-xl border-0"
              style={{ height: "500px" }}
              title={item.name}
            />
          </div>
        ) : (
          <img src={item.url} alt={item.name} className="max-h-[60vh] w-full rounded-xl object-cover" />
        )}

        <h3 className="mt-4 font-display text-lg font-extrabold">{item.name}</h3>
        {item.caption && <p className="mt-2 text-sm text-muted">{item.caption}</p>}
      </div>
    </div>
  )
}

/* ---------- Header ---------- */
function Header({ b }: { b: LiveBlogger }) {
  const avatar = b.profile.photo || `https://i.pravatar.cc/240?u=${b.slug}`
  return (
    <div className="relative overflow-hidden rounded-3xl border border-green/10 bg-white shadow-[0_12px_44px_rgba(91,180,32,0.10)]">
      {b.cover ? (
        <img src={b.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <img src="/hero-bg.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/92 via-white/55 to-white/15" />
      <img src="/mascot3.webp" alt="" className="animate-float pointer-events-none absolute bottom-0 left-1/2 z-10 hidden h-[12.5rem] -translate-x-1/2 object-contain drop-shadow-2xl xl:block" />
      <div className="absolute right-5 top-5 z-20 hidden w-52 rounded-2xl border border-green/10 bg-white/95 p-5 shadow-[0_10px_30px_rgba(91,180,32,0.18)] backdrop-blur lg:block">
        <div className="flex items-center gap-2 text-green">
          <Icon d={I.trophy} className="h-5 w-5" /><span className="font-display text-sm font-bold tracking-wide">REYTING</span>
        </div>
        <div className="mt-3 flex items-end gap-1">
          <span className="font-display text-4xl font-extrabold text-green leading-none">{bloggerRating(b)}</span>
          <span className="mb-1 text-sm text-muted">/5.0</span>
        </div>
        <div className="mt-1.5 flex gap-0.5 text-green">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg key={i} viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z" />
            </svg>
          ))}
        </div>
        <div className="mt-4 border-t border-green/10 pt-3">
          <div className="font-display text-lg font-extrabold">{bloggerTop(b)}</div>
          <div className="text-xs text-muted">Agro bloggerlar orasida</div>
        </div>
      </div>
      <div className="relative px-6 pb-5 pt-16 lg:px-8 lg:pr-[15rem]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="relative shrink-0">
            <img src={avatar} alt={b.name} className="h-32 w-32 rounded-full object-cover ring-4 ring-white shadow-xl" />
            {b.status === "active" && (
              <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-green text-white ring-2 ring-white">
                <Icon d="M9 12l2 2 4-4" className="h-4 w-4" sw={2.5} />
              </span>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{b.name}</h1>
              <Icon d={I.verified} className="h-6 w-6 shrink-0 text-green" />
            </div>
            <p className="mt-1 text-muted">{b.profile.tag || "Bloger"}</p>
            {b.profile.region && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <Icon d={I.pin} className="h-4 w-4 text-green" /> {b.profile.region}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {b.socials.map((s) => (
                <a key={s.id} href={fullUrl(s.link)} target="_blank" rel="noreferrer" title={s.name || s.platform} className="grid h-9 w-9 place-items-center rounded-lg bg-soft text-green transition-colors hover:bg-green hover:text-white">
                  <Icon d={platIconMap[s.platform] || I.link2} className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Stats Row ---------- */
function StatsRow({ b }: { b: LiveBlogger }) {
  const items = [
    { icon: I.users, v: fmtNum(b.stats.subscribers), l: "Obunachilar" },
    { icon: I.play, v: fmtNum(b.stats.views), l: "Ko'rishlar" },
    { icon: I.chart, v: b.stats.engagement > 0 ? `${b.stats.engagement}%` : "—", l: "Engagement" },
    { icon: I.users, v: String(b.brands.length || 0), l: "Hamkorliklar" },
    { icon: I.star, v: bloggerRating(b), l: "Reyting" },
    { icon: I.trophy, v: `${b.experienceYears || 0} yil`, l: "Faoliyat tajribasi" },
  ]
  return (
    <Reveal>
      <div className="grid grid-cols-2 gap-y-6 rounded-3xl border border-green/10 bg-white px-6 py-7 shadow-[0_10px_40px_rgba(91,180,32,0.08)] sm:grid-cols-3 lg:grid-cols-6">
        {items.map((s) => (
          <div key={s.l} className="flex items-center gap-3 px-2">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-soft text-green">
              <Icon d={s.icon} className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-xl font-extrabold leading-none">{s.v}</div>
              <div className="mt-1 text-[11px] text-muted">{s.l}</div>
            </div>
          </div>
        ))}
      </div>
    </Reveal>
  )
}

/* ---------- Audience Analytics Card ---------- */
function AudienceAnalytics({ b }: { b: LiveBlogger }) {
  const maleColor = '#10b981';
  const femaleColor = '#3b82f6';

  // MUHIM: bu yerda HECH QANDAY o'ylab topilgan demografiya yo'q.
  // Ilgari API bo'sh qaytarsa soxta 68/32 jins, soxta yosh va hudud taqsimoti
  // real analitika sifatida ko'rsatilardi — reklama beruvchi shunga qarab
  // qaror qabul qilishi mumkin edi. Endi ma'lumot yo'q bo'lsa — ochiq aytamiz.
  const male = b.genderDistribution?.male ?? 0;
  const female = b.genderDistribution?.female ?? 0;
  const hasGender = male + female > 0;

  const ageEntries = Object.entries(b.ageDistribution || {});
  const regionEntries = Object.entries(b.regionDistribution || {});

  const genderData = [{ name: 'Erkak', value: male }, { name: 'Ayol', value: female }];

  // Umuman hech qanday analitika yo'q bo'lsa — kartani chizmaymiz.
  if (!hasGender && ageEntries.length === 0 && regionEntries.length === 0) return null;

  return (
    <Reveal>
      <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
        <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">AUDITORIYA ANALITIKASI</h3>

        {/* Gender donut with center text */}
        {hasGender && (
        <div className="mt-5 flex items-center justify-center gap-8">
          <div className="relative shrink-0">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={genderData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={70}
                  strokeWidth={0}
                >
                  <Cell fill={maleColor} />
                  <Cell fill={femaleColor} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-3xl font-extrabold leading-none" style={{ color: maleColor }}>{male}%</span>
              <span className="text-xs text-muted mt-1">Erkaklar</span>
            </div>
          </div>
          <div className="text-center">
            <div className="font-display text-3xl font-extrabold" style={{ color: femaleColor }}>{female}%</div>
            <div className="text-xs text-muted mt-1">Ayollar</div>
          </div>
        </div>
        )}

        {/* Age groups with progress bars */}
        {ageEntries.length > 0 && (
        <div className="mt-6 space-y-3">
          {ageEntries.map(([range, pct]) => (
            <div key={range}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-ink/70">{range}</span>
                <span className="font-bold text-ink/80">{pct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-soft">
                <div className="h-full rounded-full bg-gradient-to-r from-green to-leaf" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Top regions */}
        {regionEntries.length > 0 && (
        <div className="mt-6">
          <h4 className="font-display text-xs font-bold tracking-wide text-ink/60 mb-3">Top hududlar</h4>
          <ul className="space-y-2">
            {regionEntries.map(([region, pct]) => (
              <li key={region} className="flex justify-between text-sm">
                <span className="text-ink/70">{region}</span>
                <span className="font-bold text-ink/80">{pct}%</span>
              </li>
            ))}
          </ul>
        </div>
        )}
      </div>
    </Reveal>
  );
}



function About({ b }: { b: LiveBlogger }) {
  const tags = b.specializations.map((s) => `#${s.charAt(0).toUpperCase() + s.slice(1)}`)
  const youtubeChannel = (b.profile as Record<string, unknown>)?.youtube_channel as string | undefined

  // Ijtimoiy tarmoq linklarini yig'ish
  const socialLinks: { platform: string; url: string; icon: string }[] = []

  // YouTube kanal
  if (youtubeChannel) {
    socialLinks.push({ platform: "YouTube", url: youtubeChannel, icon: I.youtube })
  }

  // Boshqa ijtimoiy tarmoqlar
  if (b.socials && b.socials.length > 0) {
    for (const s of b.socials) {
      if (s.link && !socialLinks.some((sl) => sl.url === s.link)) {
        socialLinks.push({
          platform: s.platform,
          url: fullUrl(s.link),
          icon: platIconMap[s.platform] || I.link2,
        })
      }
    }
  }

  return (
    <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
      <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">HAQIDA</h3>
      {b.profile.region && (
        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex gap-2">
            <dt className="font-semibold text-ink/80">Joylashuv:</dt>
            <dd className="text-muted">{b.profile.region}</dd>
          </div>
          {(b.specializations.length > 0) && (
            <div className="flex gap-2">
              <dt className="font-semibold text-ink/80">Yo'nalish:</dt>
              <dd className="text-muted">{b.specializations.join(", ")}</dd>
            </div>
          )}
          {socialLinks.length > 0 && (
            <div className="flex gap-2">
              <dt className="font-semibold text-ink/80">Ijtimoiy tarmoqlar:</dt>
              <dd className="flex flex-wrap gap-2">
                {socialLinks.map((sl) => (
                  <a
                    key={sl.url}
                    href={sl.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green/10 px-2.5 py-1 text-xs font-semibold text-green transition-colors hover:bg-green hover:text-white"
                  >
                    <Icon d={sl.icon} className="h-3.5 w-3.5" />
                    {sl.platform}
                  </a>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
      {b.profile.about && (
        <p className="mt-4 text-sm leading-relaxed text-muted">{b.profile.about}</p>
      )}
      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="rounded-lg bg-soft px-2.5 py-1 text-xs font-semibold text-green">{t}</span>
          ))}
        </div>
      )}
      {b.bio && (
        <p className="mt-4 text-xs italic text-muted border-t border-green/10 pt-3">{b.bio}</p>
      )}
    </div>
  )
}
/* ---------- Quick Contact ---------- */
function QuickContact({ b }: { b: LiveBlogger }) {
  const items = b.socials.map((s) => ({
    icon: platIconMap[s.platform] || I.link2,
    label: s.platform,
    href: fullUrl(s.link),
  }))
  if (items.length === 0) return null
  return (
    <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
      <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">TEZ ALOQA</h3>
      <div className="mt-4 space-y-2.5">
        {items.map((x) => (
          <a key={x.label} href={x.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-soft px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-green hover:text-white">
            <Icon d={x.icon} className="h-4 w-4 text-green" /> {x.label}
          </a>
        ))}
      </div>
    </div>
  )
}
/* ---------- AI Assistant Card ---------- */
function AiAssistant({ b }: { b: LiveBlogger }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-green to-green-deep p-6 text-white shadow-[0_4px_24px_rgba(91,180,32,0.25)]">
      <div className="flex items-center gap-2">
        <Icon d={I.brain} className="h-5 w-5" />
        <span className="font-display text-sm font-bold tracking-wide">AI ASSISTANT</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/90">
        {b.name} bilan AI orqali bog'laning!
      </p>
      <button className="mt-4 flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-green transition-transform hover:scale-105">
        <Icon d={I.bolt} className="h-4 w-4" /> AI CHAT
      </button>
    </div>
  )
}



/* ---------- Content ---------- */
function Stars({ n, size = "h-4 w-4" }: { n: number; size?: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" fill="currentColor" className={`${size} ${i < n ? "text-green" : "text-slate-200"}`}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z" />
        </svg>
      ))}
    </div>
  )
}

type Review = { id: string; author_name: string; rating: number; comment: string | null; created_at: string }
function Reviews({ slug }: { slug: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [avg, setAvg] = useState(0)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ author_name: "", rating: 5, comment: "" })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState("")

  const load = () => {
    setLoading(true)
    api<{ reviews: Review[]; avg: number }>(`/blogger-reviews?slug=${encodeURIComponent(slug)}`)
      .then((d) => { setReviews(d.reviews || []); setAvg(d.avg || 0) })
      .catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(load, [slug])

  const submit = async () => {
    setErr("")
    if (!form.author_name.trim()) { setErr("Ismingizni kiriting"); return }
    setBusy(true)
    try {
      await api("/blogger-reviews", { method: "POST", body: JSON.stringify({ slug, ...form }) })
      setDone(true); setForm({ author_name: "", rating: 5, comment: "" }); load()
      setTimeout(() => setDone(false), 3000)
    } catch (e) { setErr(e instanceof Error ? e.message : "Xatolik") } finally { setBusy(false) }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Sharhlar ro'yxati */}
      <div>
        {reviews.length > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-green/10 bg-white p-4">
            <div className="font-display text-3xl font-extrabold text-green">{avg.toFixed(1)}</div>
            <div><Stars n={Math.round(avg)} /><div className="mt-1 text-xs text-muted">{reviews.length} ta sharh</div></div>
          </div>
        )}
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-soft" />)}</div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-green/10 bg-white py-12 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-green"><Icon d={I.message} className="h-7 w-7" /></span>
            <h3 className="mt-4 font-display text-lg font-bold">Hali sharhlar yo'q</h3>
            <p className="mt-2 text-sm text-muted">Birinchi bo'lib sharh qoldiring!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-green/8 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-green/10 font-bold text-green">{r.author_name[0]?.toUpperCase()}</div>
                    <div><div className="text-sm font-semibold">{r.author_name}</div><div className="text-xs text-muted">{(r.created_at || "").split("T")[0]}</div></div>
                  </div>
                  <Stars n={r.rating} />
                </div>
                {r.comment && <p className="mt-3 text-sm text-muted">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Sharh yozish */}
      <div className="h-fit rounded-2xl border border-green/10 bg-white p-5">
        <h3 className="font-display text-base font-bold">Sharh qoldiring</h3>
        {done ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-green"><Icon d={I.check} className="h-4 w-4" /> Sharhingiz uchun rahmat!</p>
        ) : (
          <div className="mt-4 space-y-3">
            <input value={form.author_name} onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))} placeholder="Ismingiz" className="w-full rounded-lg border border-green/20 px-3 py-2.5 text-sm outline-none focus:border-green" />
            <div>
              <div className="mb-1 text-xs text-muted">Baho</div>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button key={i} onClick={() => setForm((f) => ({ ...f, rating: i + 1 }))} className="p-0.5">
                    <svg viewBox="0 0 24 24" fill="currentColor" className={`h-7 w-7 ${i < form.rating ? "text-green" : "text-slate-200"}`}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z" /></svg>
                  </button>
                ))}
              </div>
            </div>
            <textarea value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} rows={3} placeholder="Fikringiz (ixtiyoriy)" className="w-full resize-none rounded-lg border border-green/20 px-3 py-2.5 text-sm outline-none focus:border-green" />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-green px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 disabled:opacity-60">{busy ? "Yuborilmoqda..." : "Yuborish"}</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Content({ b }: { b: LiveBlogger }) {
  const [tab, setTab] = useState("KONTENTLAR")
  const [viewer, setViewer] = useState<{ url: string; name: string; caption?: string } | null>(null)
  const tabs = ["KONTENTLAR", "STATISTIKA", "HAMKORLIKLAR", "SHARHLAR"]

  const statsData = [
    { label: "Ko'rishlar", value: b.stats.views, max: 1_000_000 },
    { label: "Engagement", value: b.stats.engagement, max: 100 },
    { label: "Obunachilar o'sishi", value: Math.round(b.stats.subscribers * 0.12), max: b.stats.subscribers },
    { label: "Kontent faolligi", value: b.videos.length * 15, max: 100 },
  ]

  return (
     <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
      {viewer && <ContentModal item={viewer} onClose={() => setViewer(null)} />}
      <div className="flex flex-wrap gap-6 border-b border-green/10">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative pb-3 font-display text-sm font-bold tracking-wide transition-colors ${tab === t ? "text-green" : "text-ink/50 hover:text-ink"}`}>
            {t}
            {tab === t && <span className="absolute -bottom-px left-0 h-0.5 w-full bg-green" />}
          </button>
        ))}
      </div>

      {tab === "KONTENTLAR" && (
        <div className="mt-6">
          {/* Videolar */}
          {b.videos.length > 0 && (
            <div className="mb-6">
              <h4 className="mb-3 font-display text-sm font-bold text-ink/70">Videolar</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {b.videos.map((v) => (
                  <button key={v.id} onClick={() => setViewer({ url: v.link, name: cleanTitle(v.name), caption: v.views ? `${v.views} ko'rish` : undefined })} className="group text-left">
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-soft">
                      {v.thumbnail ? (
                        <img src={v.thumbnail} alt={cleanTitle(v.name)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-green"><Icon d={I.media} className="h-8 w-8" /></div>
                      )}
                      <div className="absolute inset-0 bg-black/15" />
                      <span className="absolute inset-0 grid place-items-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-green"><Icon d={I.play} className="h-5 w-5" /></span></span>
                      {v.plats?.[0] && <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">{v.plats[0]}</span>}
                    </div>
                    <h4 className="mt-2 line-clamp-1 font-semibold text-sm leading-snug transition-colors group-hover:text-green">{cleanTitle(v.name)}</h4>
                    <p className="mt-0.5 text-xs text-muted">{v.views} ko'rish{v.date ? ` · ${v.date}` : ""}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rasmlar */}
          {b.images.length > 0 && (
            <div>
              <h4 className="mb-3 font-display text-sm font-bold text-ink/70">Rasmlar</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {b.images.map((img) => (
                  <button key={img.id} onClick={() => setViewer({ url: img.url, name: img.caption || "Rasm", caption: img.caption })} className="group text-left overflow-hidden rounded-xl">
                    <img src={img.url} alt={img.caption || ""} className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    {img.caption && <p className="mt-1 truncate text-xs text-muted">{img.caption}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {b.videos.length === 0 && b.images.length === 0 && (
            <div className="py-12 text-center text-muted">Hali kontent qo'shilmagan.</div>
          )}
        </div>
      )}

      {tab === "STATISTIKA" && (
        <div className="mt-6 space-y-5">
          {statsData.map((s) => {
            const pct = Math.min(100, Math.round((s.value / s.max) * 100))
            return (
              <div key={s.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-ink/80">{s.label}</span>
                  <span className="font-bold text-green">{fmtNum(s.value)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-soft">
                  <div className="h-full rounded-full bg-gradient-to-r from-green to-leaf transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === "HAMKORLIKLAR" && (
        <div className="mt-6">
          {b.brands.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {b.brands.map((br) => (
                <div key={br.id} className="flex flex-col items-center justify-center gap-2 rounded-xl border border-green/10 bg-soft p-3 text-center">
                  {br.logoUrl ? <img src={br.logoUrl} alt={br.name} className="h-8 w-auto object-contain" /> : null}
                  <span className="font-display text-xs font-bold text-ink/70">{br.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-muted">Hali hamkorlik qo'shilmagan.</p>
          )}
        </div>
      )}

      {tab === "SHARHLAR" && <Reviews slug={b.slug} />}

    </div>
  )
}

/* ---------- Achievements And Services ---------- */
function AchievementsAndServices({ b }: { b: LiveBlogger }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
        <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">YUTUQLARI</h3>
        {b.achievements.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {b.achievements.map((a) => (
              <div key={a.id} className="rounded-xl bg-soft p-3 text-center">
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-gold"><Icon d={I.trophy} className="h-5 w-5" /></span>
                <div className="mt-2 text-xs font-bold leading-tight">{a.title}</div>
                {a.subtitle && <div className="text-[10px] text-muted">{a.subtitle}</div>}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Hali yutuq qo'shilmagan.</p>
        )}
      </div>
      <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
        <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">XIZMATLARI</h3>
        {b.services.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {b.services.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 text-sm">
                <Icon d={I.check} className="h-4 w-4 text-green" sw={2.4} /> {s.title}
                {s.description && <span className="text-xs text-muted">— {s.description}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">Hali xizmat qo'shilmagan.</p>
        )}
      </div>
    </div>
  )
}

/* ---------- Partnership Efficiency Section ---------- */
function PartnershipEfficiency({ b }: { b: LiveBlogger }) {
  const mascotPoint = "/mascot2.webp"
  const engagement = Math.round((b.stats.engagement || 0) * 10) / 10
  const subscribers = b.stats.subscribers || 0

  // Ma'lumot bo'lmasa — blokni ko'rsatmaymiz
  if (engagement <= 0 && subscribers <= 0) return null

  // Soha benchmark'lariga nisbatan taqqoslash (real Instagram/YouTube o'rtachalari)
  const INDUSTRY_AVG = 3 // sohadagi o'rtacha engagement ~3%
  const GOOD_LEVEL = 6 // yaxshi bloger darajasi ~6%
  const rawMultiplier = engagement > 0 ? engagement / INDUSTRY_AVG : 0
  const multiplier = rawMultiplier >= 10 ? "10x+" : `${Math.round(rawMultiplier * 10) / 10}x`
  const bars = [
    { l: `${INDUSTRY_AVG}%`, v: INDUSTRY_AVG, sub: "Soha o'rtachasi", hl: false },
    { l: `${GOOD_LEVEL}%`, v: GOOD_LEVEL, sub: "Yaxshi bloger", hl: false },
    { l: `${engagement}%`, v: engagement, sub: "Bu bloger", hl: true },
  ]
  const maxBar = Math.max(...bars.map((x) => x.v), 1)
  const barPx = (v: number) => Math.max(6, Math.round((v / maxBar) * 128))

  // Kutilayotgan qamrov — real obunachilar soni asosida (organik reach + viral omil)
  const reachLow = Math.round(subscribers * 0.3)
  const reachHigh = Math.round(subscribers * (1 + Math.min(engagement, 100) / 100))

  return (
    <Reveal>
      <div className="relative mt-6 overflow-hidden rounded-3xl bg-ink p-8 text-white">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-green/20 blur-3xl" />
        <img src={mascotPoint} alt="" className="animate-float absolute bottom-0 right-6 hidden h-40 object-contain drop-shadow-2xl lg:block" />
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h3 className="font-display text-sm font-bold tracking-widest text-white/70">HAMKORLIK SAMARADORLIGI</h3>
            <div className="mt-3 font-display text-5xl font-extrabold text-green">{engagement > 0 ? `${engagement}%` : "—"}</div>
            <div className="text-white/70">O'rtacha Engagement</div>
            {rawMultiplier > 1 && (
              <p className="mt-3 text-sm text-white/50">Soha o'rtachasidan <span className="font-bold text-green">{multiplier} yuqori</span></p>
            )}

            <div className="mt-6 max-w-md">
              <div className="flex items-end gap-4" style={{ height: '160px' }}>
                {bars.map((p, i) => (
                  <div key={i} className="group flex flex-1 flex-col items-center justify-end h-full">
                    <div className={`mb-1.5 font-display text-sm font-bold ${p.hl ? "text-green" : "text-white/50"}`}>{p.l}</div>
                    <div
                      className={`w-full rounded-t-xl transition-all duration-500 ease-out ${p.hl ? "bg-gradient-to-t from-green/25 via-green/60 to-green shadow-[0_0_24px_rgba(91,180,32,0.35)] group-hover:to-leaf" : "bg-white/15"}`}
                      style={{ height: `${barPx(p.v)}px` }}
                    />
                    <div className="mt-2 text-[10px] text-white/40">{p.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="self-center rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-white/60">Kutilayotgan qamrov</div>
            <div className="mt-1 font-display text-3xl font-extrabold text-green">
              {subscribers > 0 ? `${fmtNum(reachLow)} – ${fmtNum(reachHigh)}` : "—"}
            </div>
            <div className="text-white/70">Har bir post uchun</div>
            <div className="mt-3 text-xs text-white/40">{subscribers > 0 ? `${fmtNum(subscribers)} obunachi asosida` : "Ma'lumot yig'ilmoqda"}</div>
          </div>
        </div>
      </div>
    </Reveal>
  )
}

/* ---------- Brands Section ---------- */
function Brands({ b }: { b: LiveBlogger }) {
  if (b.brands.length === 0) return null
  return (
    <div className="rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
      <h3 className="font-display text-sm font-bold tracking-widest text-ink/80">HAMKOR BO'LGAN BRENDLAR</h3>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {b.brands.map((br) => (
          <div key={br.id} className="flex flex-col items-center justify-center gap-2 rounded-xl border border-green/10 bg-soft p-3 text-center">
            {br.logoUrl ? <img src={br.logoUrl} alt={br.name} className="h-8 w-auto object-contain" /> : null}
            <span className="font-display text-xs font-bold text-ink/70">{br.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BloggerProfile() {
  const { slug } = useParams()
  const [b, setB] = useState<LiveBlogger | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!slug) return
    setLoading(true)
    const cacheBust = Date.now()
    api<{ blogger: LiveBlogger }>(`/public/bloggers/${slug}?t=${cacheBust}`)
      .then((d) => { setB(d.blogger ?? null); setFailed(false) })
      // Tarmoq/server xatosi "bunday bloger yo'q" degani EMAS — alohida holat.
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="mx-auto max-w-[1320px] px-5 pt-7 pb-12 lg:px-8">
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <SkeletonStatGrid />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )

  if (failed) return (
    <div className="mx-auto max-w-[1320px] px-5 pt-7 pb-12 lg:px-8">
      <ErrorState onRetry={() => window.location.reload()} message="Bloger ma'lumotini yuklab bo'lmadi. Internet aloqasini tekshiring." />
    </div>
  )

  if (!b) return (
    <div className="mx-auto max-w-[1320px] px-5 pt-7 pb-12 lg:px-8">
      <div className="grid min-h-[60vh] place-items-center text-muted">Bloger topilmadi</div>
    </div>
  )

  return (
    <div className="mx-auto max-w-[1320px] px-5 pt-7 pb-12 lg:px-8">
      <Reveal>
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
          <Link to="/" className="hover:text-green">Bosh sahifa</Link>
          <span>/</span>
          <Link to="/blogerlar" className="hover:text-green">Blogerlar</Link>
          <span>/</span>
          <span className="font-semibold text-green">{b.name}</span>
        </nav>
      </Reveal>

      <Reveal><Header b={b} /></Reveal>
      <div className="mt-6"><StatsRow b={b} /></div>

       <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr_300px]">
         {/* Chap ustun */}
         <div className="flex flex-col gap-6">
           <Reveal><About b={b} /></Reveal>
           <Reveal delay={80}><QuickContact b={b} /></Reveal>
           <Reveal delay={160}><AiAssistant b={b} /></Reveal>
         </div>
         {/* O'rtacha ustun */}
         <div className="flex flex-col gap-6">
           <Reveal><Content b={b} /></Reveal>
           <Reveal delay={80}><AchievementsAndServices b={b} /></Reveal>
         </div>
         {/* O'ng ustun */}
         <div className="flex flex-col gap-6">
           <Reveal><AudienceAnalytics b={b} /></Reveal>
           <Reveal delay={80}><Brands b={b} /></Reveal>
         </div>
       </div>

       {/* Partnership Efficiency - Full width at bottom */}
       <div className="mt-8">
         <PartnershipEfficiency b={b} />
       </div>
    </div>
  )
}
