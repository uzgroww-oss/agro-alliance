import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import DashboardLayout from "../../components/DashboardLayout"
import { Icon, I, fmtSom, Skeleton, SkeletonStatGrid, ErrorState } from "../../lib/ui"
import { api } from "../../lib/api"
import { useAuth } from "../../lib/auth"
import { supabase } from "../../lib/supabase"
import { tr } from "../../lib/i18n"

/**
 * "Blogerlar" va "Bildirishnomalar" bo'limlari OLIB TASHLANDI —
 * kompaniyaga ular kerak emas edi. O'rniga "Videolar": blogerlar shu
 * kompaniya uchun tayyorlagan va belgilagan videolar statistikasi.
 */
const nav = [
  { label: "Umumiy", icon: I.dashboard },
  { label: "Kompaniya profili", icon: I.building },
  { label: "Shartnoma", icon: I.doc },
  { label: "Videolar", icon: I.media },
  { label: "Topshiriqlar", icon: I.task },
  { label: "Hisobot", icon: I.fileText },
  { label: "Sozlamalar", icon: I.gear },
]

type Task = { id: number; title: string; status: "done" | "progress" | "pending" }
type Partner = {
  id: number; name: string; sphere: string; contractNo: string
  amount: number; signedDate: string; status: string; tasks: Task[]
}
type CompanyExtra = { description?: string; website?: string; phone?: string; address?: string; instagram?: string; telegram?: string }
type PartnerVideo = {
  id: string; name: string; link: string; views: string; likes: string; comments: string
  duration: string; description: string; channel: string
  plats: string[]; date: string; thumbnail: string | null
  blogger: { id: string; name: string; slug: string | null; avatar: string | null }
}
type TopBlogger = {
  id: string; name: string; slug: string | null; avatar: string | null
  videos: number; views: number; likes: number; comments: number
}
type VideoStats = {
  total: number; views: number; likes: number; comments: number
  bloggers: number; platforms: Record<string, number>
  platformViews: Record<string, number>
  monthly: { oy: string; views: number; videos: number }[]
  topBloggers: TopBlogger[]
  lastDate: string
}

/* ==========================================================================
   DIAGRAMMA RANGLARI
   ==========================================================================
   Ranglar KO'ZDAN emas, tekshiruvdan o'tkazib tanlangan: har juftlik
   rangni ajrata olmaydigan odam uchun ham (deutan/protan/tritan), oddiy
   ko'rish uchun ham yetarlicha farq qiladi.

   Tarmoqlarning O'Z brend ranglari ishlatilmadi: Telegram va Facebook
   ikkalasi ham ko'k, YouTube va Instagram esa qizil-pushti — donut
   bo'laklari bir-biriga qo'shilib ketardi. Shuning uchun rang faqat
   yordamchi belgi, ASOSIY belgi — yozuv: har bo'lak nomi va foizi
   bilan birga ko'rsatiladi.
   ========================================================================== */
const PLATFORMA_RANG: Record<string, string> = {
  YouTube: "#e34948",
  Telegram: "#2a78d6",
  Instagram: "#eda100",
  Facebook: "#4a3aa7",
}
/** Ro'yxatda yo'q tarmoq uchun — kulrang, "boshqa" ma'nosida */
const BOSHQA_RANG = "#6b7280"
const rangOl = (nom: string) => PLATFORMA_RANG[nom] || BOSHQA_RANG

/** Ustunlar rangi — bitta qator, shuning uchun bitta rang */
const USTUN_RANG = "#2f7d1f"

/**
 * Katta sonni qisqartiradi: 1 250 -> "1.3K", 12 500 -> "13K".
 *
 * Chegara YAXLITLANGAN qiymat bo'yicha tekshiriladi, xom son bo'yicha
 * emas. Ilgari 999 999 "1000K" bo'lib chiqardi (999.999 yaxlitlanib
 * 1000 bo'lardi, prefiks esa "K" bo'lib qolardi), 1 000 000 esa
 * "1.0M" — ya'ni bitta ko'rish farqda yozuv sakrab ketardi. Xuddi
 * shunday 9 999 "10.0K", 10 000 esa "10K" bo'lardi.
 */
const qisqaSon = (n: number): string => {
  const birlik = (v: number, belgi: string) => {
    const r = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10
    return `${r >= 10 ? r.toFixed(0) : r.toFixed(1)}${belgi}`
  }
  if (n >= 999_500_000) return birlik(n / 1_000_000_000, "B")
  if (n >= 999_500) return birlik(n / 1_000_000, "M")
  if (n >= 999.5) return birlik(n / 1_000, "K")
  return String(Math.round(n))
}

/**
 * Foizlarni yig'indisi ANIQ 100 bo'ladigan qilib yaxlitlaydi.
 *
 * Oddiy `Math.round` da 56 + 28 + 14 + 3 = 101 chiqardi va bu
 * diagrammada darrov ko'zga tashlanadi. Eng katta qoldiqli
 * bo'laklarga bittadan qo'shib, farq yopiladi.
 */
function foizlar(qiymatlar: number[]): number[] {
  const jami = qiymatlar.reduce((s, n) => s + n, 0)
  if (jami <= 0) return qiymatlar.map(() => 0)
  const aniq = qiymatlar.map((n) => (n / jami) * 100)
  const past = aniq.map(Math.floor)
  let qoldiq = 100 - past.reduce((s, n) => s + n, 0)
  const tartib = aniq
    .map((n, i) => ({ i, kasr: n - Math.floor(n) }))
    .sort((a, b) => b.kasr - a.kasr)
  for (const { i } of tartib) {
    if (qoldiq <= 0) break
    past[i] += 1
    qoldiq -= 1
  }
  return past
}

/**
 * Ko'rishlar matn sifatida saqlanadi va manbaga qarab har xil
 * ko'rinishda bo'ladi: "12500", "12.5K", "1,2M". Hisoblashdan oldin
 * songa keltiriladi (serverdagi `sonGa` bilan bir xil qoida).
 */
function songa(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  if (typeof v !== "string") return 0
  const s = v.trim().replace(/\s/g, "").replace(",", ".")
  const m = s.match(/^([\d.]+)\s*([KkMmBb])?$/)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return 0
  const k = (m[2] || "").toLowerCase()
  return Math.round(n * (k === "k" ? 1e3 : k === "m" ? 1e6 : k === "b" ? 1e9 : 1))
}

type Korsatkich = {
  total: number; views: number; likes: number; comments: number; bloggers: number
  platforms: Record<string, number>
  platformViews: Record<string, number>
  topBloggers: TopBlogger[]
}

/**
 * Ko'rsatkichlarni BERILGAN videolar to'plamidan hisoblaydi.
 *
 * Oy tanlanganda hammasi qaytadan hisoblanishi kerak — serverdan
 * yangi so'rov yubormaymiz, chunki videolar allaqachon qo'lda.
 */
function hisobla(list: PartnerVideo[]): Korsatkich {
  const platforms: Record<string, number> = {}
  const platformViews: Record<string, number> = {}
  const blogerlar = new Map<string, TopBlogger>()
  let views = 0, likes = 0, comments = 0

  for (const v of list) {
    const k = songa(v.views), y = songa(v.likes), i = songa(v.comments)
    views += k; likes += y; comments += i
    // Bir video bir nechta tarmoqda bo'lsa BIRINCHISIGA yoziladi —
    // aks holda ulushlar yig'indisi 100% dan oshib ketardi
    const asosiy = v.plats[0] || "Boshqa"
    platforms[asosiy] = (platforms[asosiy] || 0) + 1
    platformViews[asosiy] = (platformViews[asosiy] || 0) + k

    const b = v.blogger
    const bor = blogerlar.get(b.id) || {
      id: b.id, name: b.name, slug: b.slug, avatar: b.avatar,
      videos: 0, views: 0, likes: 0, comments: 0,
    }
    bor.videos += 1; bor.views += k; bor.likes += y; bor.comments += i
    blogerlar.set(b.id, bor)
  }

  return {
    total: list.length, views, likes, comments,
    bloggers: blogerlar.size,
    platforms, platformViews,
    topBloggers: [...blogerlar.values()].sort((a, b) => b.views - a.views),
  }
}

const OY_NOMI = [tr("Yan"), tr("Fev"), tr("Mar"), tr("Apr"), tr("May"), tr("Iyn"), tr("Iyl"), tr("Avg"), tr("Sen"), tr("Okt"), tr("Noy"), tr("Dek")]
const oyYorlig = (oy: string) => {
  const [y, m] = oy.split("-")
  return { nom: OY_NOMI[Number(m) - 1] || m, yil: y }
}

const partnerStatusMeta: Record<string, { label: string; cls: string }> = {
  active: { label: tr("Faol"), cls: "bg-green/10 text-green" },
  pending: { label: tr("Kutilmoqda"), cls: "bg-orange-100 text-orange-600" },
  completed: { label: tr("Yakunlangan"), cls: "bg-blue-100 text-blue-600" },
}
const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold">{tr("Umumiy bajarilish")}<span className="text-muted">({done}/{total})</span></span>
        <span className="font-bold text-green">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-green transition-all" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export default function PartnerDashboard() {
  const [active, setActive] = useState("Umumiy")
  const [partner, setPartner] = useState<Partner | null>(null)
  const [extra, setExtra] = useState<CompanyExtra>({})
  const [loading, setLoading] = useState(true)
  // Ikkinchi so'rov (/client/partner) ham kuzatiladi: ilgari u kuzatilmagani
  // uchun kompaniya profili formasi BO'SH ochilib, saqlanganda serverdagi
  // ma'lumotni o'chirib yuborishi mumkin edi.
  const [extraLoading, setExtraLoading] = useState(true)
  const [extraFailed, setExtraFailed] = useState(false)
  const [err, setErr] = useState("")
  const { user, logout } = useAuth()
  const nav2 = useNavigate()

  const reload = () => {
    // Qayta urinishda eski xato va skeleton to'g'ri tiklanishi kerak
    setLoading(true)
    setErr("")
    api<{ partner: Partner }>("/me/partner")
      .then((d) => setPartner(d.partner))
      .catch((e) => setErr(e?.message || "Ma'lumotni yuklab bo'lmadi"))
      .finally(() => setLoading(false))
    setExtraLoading(true)
    setExtraFailed(false)
    api<{ settings: CompanyExtra }>("/client/partner")
      .then((d) => setExtra(d.settings || {}))
      .catch(() => setExtraFailed(true))
      .finally(() => setExtraLoading(false))
  }
  useEffect(() => { reload() }, [])

  const counts = useMemo(() => {
    const ts = partner?.tasks || []
    return {
      total: ts.length,
      done: ts.filter((t) => t.status === "done").length,
      progress: ts.filter((t) => t.status === "progress").length,
      pending: ts.filter((t) => t.status === "pending").length,
    }
  }, [partner])
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0

  const initials = (user?.name || "HK").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const doLogout = () => { logout(); nav2("/kirish") }
  const ps = partner ? (partnerStatusMeta[partner.status] || partnerStatusMeta.active) : null

  return (
    <DashboardLayout
      nav={nav}
      active={active}
      onNav={setActive}
      onLogout={doLogout}
      user={{ name: user?.name || tr("Hamkor"), role: tr("Hamkor kompaniya"), initials }}
    >
      {loading && (
        <div className="space-y-6">
          <SkeletonStatGrid />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      )}
      {/* Ilgari bu yerda faqat xato matni turardi — sabab ham, qayta
          urinish tugmasi ham yo'q edi. */}
      {err && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-600">{err}</p>
          <p className="mt-1 text-sm text-red-500">{tr("Internet aloqasini tekshiring yoki qaytadan kiring.")}</p>
          <button onClick={reload}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white">
            <Icon d={I.refresh} className="h-4 w-4" /> Qayta urinish
          </button>
        </div>
      )}
      {!loading && !err && !partner && (
        <div className="grid min-h-[50vh] place-items-center text-center">
          <div>
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-soft text-green"><Icon d={I.building} className="h-8 w-8" /></span>
            <h2 className="mt-4 font-display text-xl font-bold">{tr("Kompaniya topilmadi")}</h2>
            <p className="mt-2 text-muted">{tr("Hisobingizga biriktirilgan hamkor kompaniya topilmadi. Administrator bilan bog'laning.")}</p>
          </div>
        </div>
      )}

      {partner && (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-green/10 text-green"><Icon d={I.building} className="h-7 w-7" /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-extrabold tracking-tight">{partner.name}</h1>
                  {ps && <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${ps.cls}`}>{ps.label}</span>}
                </div>
                <p className="mt-0.5 text-sm text-muted">{partner.sphere || tr("Hamkor kompaniya")} • {tr("Hamkorlik kabineti")}</p>
              </div>
            </div>
          </div>

          {active === "Umumiy" && <Overview partner={partner} counts={counts} pct={pct} onNav={setActive} />}
          {active === "Kompaniya profili" && (
            extraLoading
              ? <Skeleton className="h-96 w-full rounded-2xl" />
              : extraFailed
                ? <ErrorState onRetry={reload} message={tr("Kompaniya profilini yuklab bo'lmadi. Saqlash ma'lumotni o'chirib yuborishi mumkin — avval qayta yuklang.")} />
                : <CompanyProfile partner={partner} extra={extra} onSaved={reload} />
          )}
          {active === "Shartnoma" && <Contract partner={partner} counts={counts} />}
          {active === "Videolar" && <PartnerVideos partnerId={String(partner.id)} />}
          {active === "Topshiriqlar" && <Briefs />}
          {active === "Hisobot" && <Report partner={partner} counts={counts} pct={pct} extra={extra} />}
          {active === "Sozlamalar" && <Settings />}
        </>
      )}
    </DashboardLayout>
  )
}

/* ---------- Umumiy ---------- */
function Overview({ partner, counts, pct, onNav }: { partner: Partner; counts: { total: number; done: number; progress: number; pending: number }; pct: number; onNav: (t: string) => void }) {
  const [vs, setVs] = useState<VideoStats | null>(null)
  useEffect(() => {
    api<{ stats: VideoStats }>("/me/partner?action=videos")
      .then((d) => setVs(d.stats))
      .catch(() => setVs(null))
  }, [])

  const statCards = [
    { icon: I.wallet, t: tr("Shartnoma summasi"), v: `${fmtSom(partner.amount)}`, sub: tr("so'm") },
    { icon: I.task, t: tr("Jami ishlar"), v: String(counts.total), sub: `${counts.done} ${tr("bajarilgan")}` },
    { icon: I.target, t: tr("Bajarilish"), v: `${pct}%`, sub: `${counts.progress} ${tr("jarayonda")}` },
    // Yuklanayotganda "0" emas, "…" — nol real raqamdek ko'rinib qolmasin.
    { icon: I.media, t: tr("Videolar"), v: vs ? String(vs.total) : "…", sub: vs ? `${vs.bloggers} ${tr("bloger")}` : tr("yuklanmoqda") },
  ]
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.t} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green"><Icon d={s.icon} className="h-5 w-5" /></span>
            <div className="mt-3 text-xs text-muted">{tr(s.t)}</div>
            <div className="mt-1 font-display text-2xl font-extrabold truncate">{s.v}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-green">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className={`mt-6 ${card}`}>
        <h3 className="font-display text-lg font-bold">{tr("Shartnoma qisqacha")}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{tr("Shartnoma raqami")}</div><div className="mt-0.5 font-display font-bold">{partner.contractNo || "—"}</div></div>
          <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{tr("Summa")}</div><div className="mt-0.5 font-display font-bold text-green">{fmtSom(partner.amount)} {tr("so'm")}</div></div>
          <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{tr("Imzolangan")}</div><div className="mt-0.5 font-display font-bold">{partner.signedDate || "—"}</div></div>
          <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{tr("Yo'nalish")}</div><div className="mt-0.5 font-display font-bold truncate">{partner.sphere || "—"}</div></div>
        </div>
        <div className="mt-5"><ProgressBar done={counts.done} total={counts.total} /></div>
      </div>

      <div className={`mt-6 ${card}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{tr("Blogerlar videolari")}</h3>
          <button onClick={() => onNav("Videolar")} className="text-sm font-semibold text-green hover:underline">{tr("Batafsil →")}</button>
        </div>
        {!vs ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        ) : vs.total === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{tr("Hali blogerlar sizning kompaniyangizga video belgilamagan.")}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{tr("Jami video")}</div><div className="mt-0.5 font-display text-xl font-extrabold">{vs.total}</div></div>
            <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{tr("Jami ko'rishlar")}</div><div className="mt-0.5 font-display text-xl font-extrabold text-green">{vs.views.toLocaleString("ru-RU")}</div></div>
            <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{tr("So'nggi video")}</div><div className="mt-0.5 font-display text-xl font-extrabold">{vs.lastDate || "—"}</div></div>
          </div>
        )}
      </div>
    </>
  )
}

/* ---------- Kompaniya profili ---------- */
function CompanyProfile({ partner, extra, onSaved }: { partner: Partner; extra: CompanyExtra; onSaved: () => void }) {
  const [form, setForm] = useState({ name: partner.name, sphere: partner.sphere, description: extra.description || "", website: extra.website || "", phone: extra.phone || "", address: extra.address || "", instagram: extra.instagram || "", telegram: extra.telegram || "" })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const save = async () => {
    setSaving(true); setError(""); setSaved(false)
    try {
      await api("/client/partner", { method: "PUT", body: JSON.stringify({ name: form.name, sphere: form.sphere, description: form.description, website: form.website, phone: form.phone, address: form.address, instagram: form.instagram, telegram: form.telegram }) })
      setSaved(true); setTimeout(() => setSaved(false), 2500); onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : "Xatolik") } finally { setSaving(false) }
  }

  const field = (label: string, key: keyof typeof form, placeholder = "", type = "text") => (
    <div>
      <label className="text-xs font-semibold text-muted">{label}</label>
      <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} type={type} className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
    </div>
  )

  return (
    <div className={`mt-6 ${card}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">{tr("Kompaniya ma'lumotlari")}</h3>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60">
          {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon d={I.check} className="h-4 w-4" />} {tr("Saqlash")}
        </button>
      </div>
      {saved && <div className="mt-3 flex items-center gap-2 rounded-xl bg-green/10 px-4 py-3 text-sm font-semibold text-green"><Icon d={I.check} className="h-4 w-4" />{tr("Saqlandi!")}</div>}
      {error && <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {field(tr("Kompaniya nomi"), "name", tr("Kompaniya nomi"))}
        {field(tr("Yo'nalish / soha"), "sphere", tr("masalan: O'g'itlar"))}
        {field(tr("Veb-sayt"), "website", "https://...")}
        {field(tr("Telefon"), "phone", "+998 ...")}
        {field(tr("Instagram"), "instagram", tr("@username yoki link"))}
        {field("Telegram", "telegram", tr("@username yoki link"))}
      </div>
      <div className="mt-4">
        <label className="text-xs font-semibold text-muted">{tr("Manzil")}</label>
        <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder={tr("Shahar, ko'cha...")} className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
      </div>
      <div className="mt-4">
        <label className="text-xs font-semibold text-muted">{tr("Kompaniya haqida")}</label>
        <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} placeholder={tr("Kompaniyangiz faoliyati haqida qisqacha...")} className="mt-1 w-full resize-none rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
      </div>
    </div>
  )
}

/* ---------- Shartnoma ---------- */
function Contract({ partner, counts }: { partner: Partner; counts: { total: number; done: number; progress: number; pending: number } }) {
  const ps = partnerStatusMeta[partner.status] || partnerStatusMeta.active
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className={card}>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-soft text-green"><Icon d={I.doc} className="h-6 w-6" /></span>
          <div>
            <h3 className="font-display text-lg font-bold">{tr("Shartnoma №")} {partner.contractNo || "—"}</h3>
            <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${ps.cls}`}>{ps.label}</span>
          </div>
        </div>
        <div className="mt-5 space-y-3 text-sm">
          {[[tr("Kompaniya"), partner.name], [tr("Yo'nalish"), partner.sphere || "—"], [tr("Shartnoma summasi"), fmtSom(partner.amount) + " " + tr("so'm")], [tr("Imzolangan sana"), partner.signedDate || "—"]].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between border-b border-green/8 pb-3 last:border-0">
              <span className="text-muted">{l}</span><span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={card}>
        <h3 className="font-display text-lg font-bold">{tr("Bajarilish darajasi")}</h3>
        <div className="mt-5"><ProgressBar done={counts.done} total={counts.total} /></div>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[[tr("Bajarilgan"), counts.done, "text-green"], [tr("Jarayonda"), counts.progress, "text-orange-600"], [tr("Kutilayotgan"), counts.pending, "text-slate-500"]].map(([l, v, c]) => (
            <div key={l as string} className="rounded-xl bg-[#fafdf7] p-4">
              <div className={`font-display text-2xl font-extrabold ${c}`}>{v}</div>
              <div className="mt-1 text-xs text-muted">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Bitta video kartochkasi — rasm, sarlavha, bloger va TO'LIQ raqamlar.
 *
 * Ko'rish/yoqtirish/izoh uchtasi ham ko'rsatiladi. Ba'zi manbalarda
 * ular yo'q (qo'lda qo'yilgan link, Instagram ko'rishlar bermaydi) —
 * o'shanda "0" emas, "—" chiqadi: nol real o'lchov, "—" esa
 * "ma'lumot yo'q" degani va ikkovi bir xil ko'rinmasligi kerak.
 */
const raqam = (s: string) => {
  const n = Number(String(s).replace(/[^\d]/g, ""))
  return Number.isFinite(n) && n > 0 ? n.toLocaleString("ru-RU") : (String(s).trim() && String(s) !== "0" ? String(s) : "—")
}

/**
 * JALB QILISH DARAJASI = (yoqtirish + izoh) / ko'rish.
 *
 * Kompaniya uchun yalpi ko'rishlar sonidan ko'ra muhimroq: ko'p
 * ko'rilgan, lekin hech kim javob bermagan video reklama sifatida
 * kuchsiz. Ko'rishlar noma'lum bo'lsa hisoblanmaydi.
 */
function jalbDarajasi(v: PartnerVideo): string {
  const son = (s: string) => Number(String(s).replace(/[^\d]/g, "")) || 0
  const k = son(v.views)
  if (!k) return "—"
  return `${(((son(v.likes) + son(v.comments)) / k) * 100).toFixed(1)}%`
}

function VideoCard({ v, onOpen }: { v: PartnerVideo; onOpen: () => void }) {
  const olcham = [
    { icon: I.eye, label: "Ko'rishlar", value: raqam(v.views) },
    { icon: I.star, label: tr("Yoqtirishlar"), value: raqam(v.likes) },
    { icon: I.message, label: "Izohlar", value: raqam(v.comments) },
  ]
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-green/12 bg-white shadow-[0_4px_20px_rgba(91,180,32,0.06)] transition-shadow hover:shadow-[0_8px_28px_rgba(91,180,32,0.12)]">
      <button onClick={onOpen} className="relative block aspect-video w-full bg-soft" title={tr("To'liq ma'lumot")}>
        {v.thumbnail ? (
          <img loading="lazy" decoding="async" src={v.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-green"><Icon d={I.play} className="h-9 w-9" /></span>
        )}
        <span className="absolute left-2 top-2 flex flex-wrap gap-1">
          {v.plats.map((p) => (
            <span key={p} className="rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">{p}</span>
          ))}
        </span>
        {v.duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">{v.duration}</span>
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col p-2.5">
        <button onClick={onOpen} className="line-clamp-2 text-left font-display text-[12px] font-bold leading-snug hover:text-green">
          {v.name}
        </button>

        <div className="mt-1.5 flex items-center gap-1.5">
          {v.blogger.avatar ? (
            <img loading="lazy" decoding="async" src={v.blogger.avatar} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-green/10 text-[9px] font-bold text-green">{v.blogger.name[0]}</span>
          )}
          <div className="min-w-0 flex-1">
            {v.blogger.slug ? (
              <a href={`/blogerlar/${v.blogger.slug}`} target="_blank" rel="noreferrer" className="block truncate text-[10px] font-bold text-green hover:underline">{v.blogger.name}</a>
            ) : (
              <span className="block truncate text-[10px] font-bold">{v.blogger.name}</span>
            )}
          </div>
          <span className="shrink-0 text-[9px] text-muted">{v.date || "—"}</span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1 border-t border-green/10 pt-2">
          {olcham.map((o) => (
            <div key={o.label} className="min-w-0 text-center" title={tr(o.label)}>
              <Icon d={o.icon} className="mx-auto h-3 w-3 text-green" />
              <div className="mt-0.5 truncate font-display text-[11px] font-extrabold">{o.value}</div>
            </div>
          ))}
        </div>

        <button onClick={onOpen} className="mt-2 w-full rounded-lg bg-soft py-1.5 text-[10px] font-bold text-green transition-colors hover:bg-green hover:text-white">
          {tr("To'liq ma'lumot")}
        </button>
      </div>
    </div>
  )
}

/**
 * VIDEO HAQIDA TO'LIQ MA'LUMOT.
 *
 * Kartochkaga hammasi sig'maydi — u ro'yxat uchun ixcham bo'lishi
 * kerak. Bu oynada esa hech narsa qisqartirilmaydi: to'liq sarlavha,
 * tavsif, kanal, davomiylik, sana, barcha raqamlar va jalb qilish
 * darajasi.
 */
type VideoComment = { id: string; author: string; avatar: string; text: string; likes: number; date: string; replies: number }

/** Linkdan YouTube video ID — izohlarni so'rash uchun kerak */
function youtubeIdFrom(v: PartnerVideo): string | null {
  const m = v.link.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (m) return m[1]
  return /^[a-zA-Z0-9_-]{11}$/.test(v.id) ? v.id : null
}

function VideoModal({ v, onClose }: { v: PartnerVideo; onClose: () => void }) {
  const ytId = youtubeIdFrom(v)
  // YouTube bo'lmasa so'rov ham yubormaymiz — darrov bo'sh ro'yxat
  const [comments, setComments] = useState<VideoComment[] | null>(ytId ? null : [])
  const [sabab, setSabab] = useState(ytId ? "" : "Izohlar faqat YouTube videolari uchun ko'rsatiladi")

  useEffect(() => {
    if (!ytId) return
    api<{ comments: VideoComment[]; sabab: string }>(`/me/partner?action=comments&video=${ytId}`)
      .then((d) => { setComments(d.comments || []); setSabab(d.sabab || "") })
      .catch(() => { setComments([]); setSabab(tr("Izohlarni yuklab bo'lmadi")) })
  }, [ytId])

  const qatorlar: [string, string][] = [
    ["Bloger", v.blogger.name],
    [tr("Kanal"), v.channel || "—"],
    ["Platforma", v.plats.join(", ") || "—"],
    [tr("Chiqarilgan sana"), v.date || "—"],
    [tr("Davomiyligi"), v.duration || "—"],
  ]
  const olcham = [
    { icon: I.eye, label: "Ko'rishlar", value: raqam(v.views) },
    { icon: I.star, label: tr("Yoqtirishlar"), value: raqam(v.likes) },
    { icon: I.message, label: "Izohlar", value: raqam(v.comments) },
    { icon: I.target, label: tr("Jalb qilish"), value: jalbDarajasi(v) },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative shrink-0">
          {v.thumbnail ? (
            <img src={v.thumbnail} alt="" className="aspect-video w-full bg-soft object-cover" />
          ) : (
            <div className="grid aspect-video w-full place-items-center bg-soft text-green"><Icon d={I.play} className="h-12 w-12" /></div>
          )}
          <button onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80">
            <Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <h3 className="font-display text-lg font-extrabold leading-snug">{v.name}</h3>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {olcham.map((o) => (
              <div key={o.label} className="rounded-xl bg-[#fafdf7] p-3 text-center">
                <Icon d={o.icon} className="mx-auto h-4 w-4 text-green" />
                <div className="mt-1 font-display text-lg font-extrabold">{o.value}</div>
                <div className="text-[10px] text-muted">{tr(o.label)}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-green/12 p-3">
            {v.blogger.avatar ? (
              <img src={v.blogger.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green/10 font-bold text-green">{v.blogger.name[0]}</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{v.blogger.name}</div>
              <div className="text-[11px] text-muted">{tr("Videoni joylagan bloger")}</div>
            </div>
            {v.blogger.slug && (
              <a href={`/blogerlar/${v.blogger.slug}`} target="_blank" rel="noreferrer"
                className="shrink-0 rounded-lg border border-green/25 px-3 py-1.5 text-[11px] font-bold text-green transition-colors hover:bg-green hover:text-white">
                {tr("Profil")}
              </a>
            )}
          </div>

          <dl className="mt-4 divide-y divide-green/8 rounded-xl border border-green/12">
            {qatorlar.map(([k, val]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt className="text-xs text-muted">{tr(k)}</dt>
                <dd className="min-w-0 truncate text-sm font-semibold">{val}</dd>
              </div>
            ))}
          </dl>

          {v.description && (
            <div className="mt-4">
              <h4 className="text-xs font-bold text-muted">{tr("Tavsif")}</h4>
              <p className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-[#fafdf7] p-3 text-xs leading-relaxed">{v.description}</p>
            </div>
          )}

          {/*
            IZOHLAR — raqamning o'zi yetarli emas.
            Kompaniya odamlar NIMA yozganini bilishi kerak: maqtovmi,
            shikoyatmi, savolmi. Eng ko'p javob olganlari tepada
            (YouTube "relevance" tartibi).
          */}
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-sm font-bold">{tr("Izohlar")}</h4>
              <span className="text-xs text-muted">
                {comments === null ? tr("yuklanmoqda...") : `${raqam(v.comments)} ${tr("ta")}`}
              </span>
            </div>

            {comments === null && (
              <div className="mt-2 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
            )}

            {comments !== null && comments.length === 0 && (
              <p className="mt-2 rounded-xl bg-[#fafdf7] px-3 py-4 text-center text-xs text-muted">
                {sabab ? tr(sabab) : tr("Hali izoh yozilmagan.")}
              </p>
            )}

            {comments !== null && comments.length > 0 && (
              <>
                <div className="mt-2 space-y-2">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2.5 rounded-xl border border-green/10 bg-[#fafdf7] p-3">
                      {c.avatar ? (
                        <img loading="lazy" decoding="async" src={c.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green/10 text-xs font-bold text-green">{c.author[0] || "?"}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px]">
                          <span className="font-bold">{c.author}</span>
                          <span className="text-muted">{c.date}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed">{c.text}</p>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted">
                          <span className="inline-flex items-center gap-1"><Icon d={I.star} className="h-3 w-3" />{c.likes}</span>
                          {c.replies > 0 && <span className="inline-flex items-center gap-1"><Icon d={I.message} className="h-3 w-3" />{c.replies} {tr("javob")}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* YouTube bir so'rovda 50 tagacha beradi — qolgani videoda */}
                {comments.length >= 50 && (
                  <p className="mt-2 text-center text-[11px] text-muted">{tr("Eng mashhur 50 ta izoh ko'rsatildi.")}</p>
                )}
              </>
            )}
          </div>

          <a href={v.link} target="_blank" rel="noreferrer"
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-green px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-[1.02]">
            <Icon d={I.play} className="h-4 w-4" /> {tr("Videoni ochish")}
          </a>
        </div>
      </div>
    </div>
  )
}

/* ---------- Diagrammalar ---------- */

/**
 * OYLIK KO'RSATKICH — bir yillik, oylar bo'yicha ustunlar.
 *
 * Bitta qator (ko'rishlar), shuning uchun BITTA rang va afsona
 * (legend) yo'q — sarlavha nima chizilganini aytadi. Har ustunga
 * raqam yozilmaydi: eng kattasi belgilanadi, qolganlari sichqoncha
 * ustiga kelganda ko'rinadi.
 *
 * Video yo'q oylar ham qoladi — ular tashlab ketilsa vaqt o'qi
 * buzilib, tanaffuslar ko'rinmasdi.
 */
function OylikGrafik({ data, tanlangan, onTanla }: {
  data: VideoStats["monthly"]
  /** Tanlangan oy ("YYYY-MM") yoki null — jami */
  tanlangan: string | null
  onTanla: (oy: string | null) => void
}) {
  const [ustida, setUstida] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.views))
  const engKattaIdx = data.reduce((eng, d, i) => (d.views > data[eng].views ? i : eng), 0)
  const jami = data.reduce((s, d) => s + d.views, 0)

  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{tr("Oylik ko'rishlar")}</h3>
        <span className="text-xs text-muted">{tr("so'nggi 12 oy")} · {qisqaSon(jami)}</span>
      </div>
      {/* Raqam nimani anglatishini AYTAMIZ: ijtimoiy tarmoqlar
          ko'rishlarning kunlik tarixini bermaydi, faqat joriy jami
          raqamni. Shusiz kompaniya buni "shu oyda shuncha ko'rildi"
          deb o'qib, noto'g'ri xulosa chiqarardi. */}
      <p className="mt-0.5 text-xs text-muted">
        {tr("Shu oyda chiqarilgan videolar bugungi kunga yig'gan ko'rishlar")}
        {" · "}
        <span className="font-semibold">{tr("oyni bosing")}</span>
      </p>

      <div className="relative mt-5">
        {/* Yuqori chegara chizig'i — o'qsiz ham masshtab bilinsin */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-green/15" />
        <span className="pointer-events-none absolute -top-2 right-0 bg-white px-1 text-[10px] text-muted">
          {qisqaSon(max)}
        </span>

        <div className="flex h-44 items-end gap-[2px]">
          {data.map((d, i) => {
            const bal = Math.round((d.views / max) * 100)
            const faol = ustida === i
            const tanlandi = tanlangan === d.oy
            /**
             * Videosi yo'q oy tanlanmaydi: bosilsa ekrandagi hamma
             * raqam nolga aylanib, foydalanuvchi nima bo'lganini
             * tushunmasdi.
             */
            const bosiladi = d.videos > 0
            return (
              <div
                key={d.oy}
                role={bosiladi ? "button" : undefined}
                tabIndex={bosiladi ? 0 : undefined}
                title={bosiladi ? (tanlandi ? tr("Jamiga qaytish") : tr("Shu oyni ko'rish")) : undefined}
                onClick={() => bosiladi && onTanla(tanlandi ? null : d.oy)}
                onKeyDown={(e) => {
                  if (!bosiladi || (e.key !== "Enter" && e.key !== " ")) return
                  e.preventDefault()
                  onTanla(tanlandi ? null : d.oy)
                }}
                className={`group relative flex h-full flex-1 items-end justify-center rounded-t ${bosiladi ? "cursor-pointer" : "cursor-default"} ${tanlandi ? "bg-green/8" : ""}`}
                onMouseEnter={() => setUstida(i)}
                onMouseLeave={() => setUstida(null)}
              >
                {/* Eng katta oy doim belgilangan — hikoya shunda */}
                {(i === engKattaIdx || faol) && d.views > 0 && (
                  <span
                    className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white"
                    /**
                     * Baland ustunda yorliq USTUNNING ICHIGA tushadi.
                     * Ustidan qo'yilsa u grafik chegarasidan chiqib
                     * ketardi — eng katta oy, ya'ni aynan ko'rsatilishi
                     * kerak bo'lgan raqam kesilib qolardi.
                     */
                    style={bal > 80 ? { bottom: `calc(${bal}% - 22px)` } : { bottom: `calc(${bal}% + 6px)` }}
                  >
                    {qisqaSon(d.views)}
                    {faol && <span className="font-normal"> · {d.videos} {tr("video")}</span>}
                  </span>
                )}
                <div
                  className="w-full max-w-[24px] rounded-t transition-[height,opacity]"
                  style={{
                    height: d.views > 0 ? `max(${bal}%, 3px)` : "2px",
                    background: d.views > 0 ? USTUN_RANG : "#e5e7eb",
                    // Oy tanlanganda faqat o'sha ustun to'liq rangda —
                    // qaysi oy ko'rilayotgani bir qarashda bilinsin
                    opacity: tanlangan ? (tanlandi ? 1 : 0.3) : (ustida === null || faol ? 1 : 0.55),
                  }}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex gap-[2px]">
          {data.map((d) => {
            const { nom, yil } = oyYorlig(d.oy)
            return (
              <div key={d.oy} className="min-w-0 flex-1 text-center">
                <div className="truncate text-[10px] text-muted">{nom}</div>
                {/* Yil faqat yanvarda — takrorlanish shovqin qiladi */}
                {d.oy.endsWith("-01") && <div className="text-[9px] text-muted/70">{yil}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * PLATFORMA ULUSHI — donut.
 *
 * Ko'rishlar bo'yicha, video soni bo'yicha emas: kompaniya uchun 2 ta
 * video 100 000 ko'rish bergan tarmoq 10 ta video 500 ko'rish
 * bergandan qimmatliroq.
 *
 * Rang yagona belgi EMAS — har bo'lak afsonada nomi, foizi va aniq
 * raqami bilan turadi. Bo'laklar orasida 2px oq tirqish: qo'shni
 * ranglar bir-biriga qo'shilib ketmasin.
 */
function PlatformaDonut({ stats }: { stats: Korsatkich }) {
  const [ustida, setUstida] = useState<string | null>(null)

  const qatorlar = Object.entries(stats.platformViews || {})
    .map(([nom, views]) => ({ nom, views, videos: stats.platforms[nom] || 0 }))
    .sort((a, b) => b.views - a.views)
  const jami = qatorlar.reduce((s, r) => s + r.views, 0)

  // Ko'rish raqami umuman yo'q bo'lsa donut ma'nosiz — video soniga o'tamiz
  const korishBor = jami > 0
  const asos = korishBor
    ? qatorlar
    : qatorlar.map((r) => ({ ...r, views: r.videos })).sort((a, b) => b.views - a.views)
  const asosJami = asos.reduce((s, r) => s + r.views, 0)
  if (asosJami === 0) return null

  const R = 56
  const QALINLIK = 18
  const C = 2 * Math.PI * R
  const TIRQISH = 2

  /**
   * Har bo'lakning aylanadagi boshlanish nuqtasi — undan oldingi
   * bo'laklar uzunligining yig'indisi. `reduce` ichida to'plangani
   * uchun render paytida o'zgaruvchi qayta yozilmaydi.
   */
  const foiz = foizlar(asos.map((r) => r.views))
  const boklaklar = asos.reduce<Array<typeof asos[number] & { ulush: number; foiz: number; uzunlik: number; siljish: number }>>(
    (acc, r, i) => {
      const oldingi = acc.length ? acc[acc.length - 1] : null
      const siljish = oldingi ? oldingi.siljish + oldingi.ulush * C : 0
      const ulush = r.views / asosJami
      /**
       * Uzunlik BO'LAK ULUSHIDAN OSHMASLIGI kerak.
       *
       * Ilgari faqat pastki chegara (0.5px) bor edi. Ulushi nolga
       * teng bo'lak — masalan ko'rishlari o'qilmagan tarmoq —
       * o'sha 0.5px ni olib, aylanadan chiqib ketardi va
       * dashoffset davri bo'yicha aylanib, BIRINCHI bo'lakning
       * ustiga, boshqa rangdagi chiziqcha bo'lib tushardi.
       */
      const uzunlik = Math.min(Math.max(ulush * C - TIRQISH, 0.5), ulush * C)
      acc.push({ ...r, ulush, foiz: foiz[i], uzunlik, siljish })
      return acc
    },
    [],
  )

  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{tr("Platformalar ulushi")}</h3>
        <span className="text-xs text-muted">{korishBor ? tr("ko'rishlar bo'yicha") : tr("videolar soni bo'yicha")}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="relative shrink-0">
          <svg width={2 * (R + QALINLIK / 2)} height={2 * (R + QALINLIK / 2)} role="img"
            aria-label={tr("Platformalar ulushi diagrammasi")}>
            <g transform={`translate(${R + QALINLIK / 2} ${R + QALINLIK / 2}) rotate(-90)`}>
              {boklaklar.map((b) => (
                <circle
                  key={b.nom}
                  r={R} fill="none"
                  stroke={rangOl(b.nom)}
                  strokeWidth={QALINLIK}
                  strokeDasharray={`${b.uzunlik} ${C - b.uzunlik}`}
                  strokeDashoffset={-b.siljish}
                  opacity={ustida === null || ustida === b.nom ? 1 : 0.4}
                  onMouseEnter={() => setUstida(b.nom)}
                  onMouseLeave={() => setUstida(null)}
                  style={{ transition: "opacity .15s" }}
                />
              ))}
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            {ustida ? (
              <div>
                <div className="font-display text-lg font-extrabold">
                  {boklaklar.find((b) => b.nom === ustida)!.foiz}%
                </div>
                <div className="max-w-[80px] truncate text-[10px] text-muted">{ustida}</div>
              </div>
            ) : (
              <div>
                <div className="font-display text-lg font-extrabold">{qisqaSon(asosJami)}</div>
                <div className="text-[10px] text-muted">{korishBor ? tr("ko'rish") : tr("video")}</div>
              </div>
            )}
          </div>
        </div>

        {/* Afsona — RANG YOLG'IZ BELGI EMAS: nom, foiz va raqam */}
        <ul className="min-w-[180px] flex-1 space-y-2">
          {boklaklar.map((b) => (
            <li key={b.nom}
              className="flex items-center gap-2"
              onMouseEnter={() => setUstida(b.nom)}
              onMouseLeave={() => setUstida(null)}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: rangOl(b.nom) }} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{b.nom}</span>
              <span className="shrink-0 text-sm font-bold">{b.foiz}%</span>
              <span className="w-14 shrink-0 text-right text-xs text-muted">{qisqaSon(b.views)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * ENG SAMARALI BLOGERLAR.
 *
 * Nomlar tabiiy tartibga ega emas, shuning uchun har blogerga
 * alohida rang berilmaydi — hammasi bitta rangda. Uzunlik allaqachon
 * kattalikni ko'rsatib turibdi, rangga ikkinchi marta yuklash
 * ma'lumot qo'shmaydi.
 */
function TopBloggers({ list }: { list: TopBlogger[] }) {
  const [hammasi, setHammasi] = useState(false)
  if (!list.length) return null
  const max = Math.max(1, ...list.map((b) => b.views))
  const korinadigan = hammasi ? list : list.slice(0, 5)

  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{tr("Eng samarali blogerlar")}</h3>
        <span className="text-xs text-muted">{tr("ko'rishlar bo'yicha")}</span>
      </div>

      <div className="mt-4 space-y-3">
        {korinadigan.map((b, i) => (
          <div key={b.id} className="flex items-center gap-3">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold ${i === 0 ? "bg-green text-white" : "bg-soft text-muted"}`}>
              {i + 1}
            </span>
            {b.avatar
              ? <img loading="lazy" decoding="async" src={b.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green/10 text-xs font-bold text-green">{b.name[0]}</span>}

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                {b.slug ? (
                  <a href={`/blogerlar/${b.slug}`} target="_blank" rel="noreferrer"
                    className="truncate text-sm font-bold hover:text-green hover:underline">{b.name}</a>
                ) : (
                  <span className="truncate text-sm font-bold">{b.name}</span>
                )}
                <span className="shrink-0 font-display text-sm font-extrabold">{qisqaSon(b.views)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-soft">
                <div className="h-full rounded-full" style={{ width: `${Math.max((b.views / max) * 100, 2)}%`, background: USTUN_RANG }} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted">
                <span>{b.videos} {tr("video")}</span>
                <span>{qisqaSon(b.likes)} {tr("yoqtirish")}</span>
                <span>{qisqaSon(b.comments)} {tr("izoh")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {list.length > 5 && (
        <button onClick={() => setHammasi((h) => !h)}
          className="mt-4 w-full rounded-xl border border-green/20 py-2 text-xs font-bold text-green transition-colors hover:bg-green/5">
          {hammasi ? tr("Kamroq") : `${tr("Yana")} ${list.length - 5}`}
        </button>
      )}
    </div>
  )
}

/* ---------- Taqqoslash ---------- */

/**
 * O'zgarish belgisi: +38% yoki -12%.
 *
 * Oldingi davr NOL bo'lsa foiz chiqarilmaydi — nolga bo'linish
 * cheksizlik beradi va "+∞%" foydalanuvchiga hech narsa aytmaydi.
 * O'sha holatda "yangi" deb yoziladi.
 */
function Ozgarish({ hozir, oldin }: { hozir: number; oldin: number }) {
  if (oldin === 0) {
    if (hozir === 0) return null
    return <span className="text-[11px] font-semibold text-green">{tr("yangi")}</span>
  }
  const foiz = Math.round(((hozir - oldin) / oldin) * 100)
  if (foiz === 0) return <span className="text-[11px] font-semibold text-muted">{tr("o'zgarmadi")}</span>
  const osdi = foiz > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${osdi ? "text-green" : "text-red-500"}`}>
      {/* Strelka — rang yolg'iz belgi bo'lib qolmasin */}
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {osdi ? <path d="M12 19V5 M5 12l7-7 7 7" /> : <path d="M12 5v14 M5 12l7 7 7-7" />}
      </svg>
      {Math.abs(foiz)}%
    </span>
  )
}

/* ---------- Izohlar tahlili ---------- */

type IzohTahlil = {
  ijobiy: number; salbiy: number; savol: number; neytral: number
  savollar: { matn: string; soni: number }[]
  shikoyatlar: { matn: string; soni: number }[]
  brend: string[]
  xulosa: string
}
type TahlilJavob = { tahlil: IzohTahlil | null; izohlar?: number; videolar?: number; sabab?: string }

/**
 * Ohang ranglari — HOLAT palitrasi, kategoriya emas.
 *
 * Yashil/qizil bu yerda "yaxshi/yomon" ma'nosini bildiradi, shuning
 * uchun ular diagrammalardagi qator ranglaridan alohida turadi. Rang
 * yolg'iz belgi emas: har bo'lak nomi va soni bilan ko'rsatiladi.
 */
const OHANG: { kalit: keyof Pick<IzohTahlil, "ijobiy" | "savol" | "neytral" | "salbiy">; nom: string; rang: string }[] = [
  { kalit: "ijobiy", nom: tr("Ijobiy"), rang: "#1e7a4d" },
  { kalit: "savol", nom: tr("Savol"), rang: "#2a78d6" },
  { kalit: "neytral", nom: tr("Neytral"), rang: "#9ca3af" },
  { kalit: "salbiy", nom: tr("Salbiy"), rang: "#c23b3b" },
]

const TAHLIL_KESH = "aa_izoh_tahlil_"

function IzohlarTahlili({ partnerId }: { partnerId: string }) {
  /**
   * Natija BRAUZERDA saqlanadi. AI chaqiruvi sekin va kvota talab
   * qiladi — sahifa har ochilganda qayta yugurtirish bekorga sarf
   * bo'lardi. Yangilash kerak bo'lsa tugma bor.
   *
   * Kesh effektda emas, boshlang'ich qiymatda o'qiladi: effekt
   * ortiqcha render keltirib, natija bir zumga yo'q bo'lib turardi.
   */
  const [kesh] = useState(() => {
    try {
      const xom = localStorage.getItem(TAHLIL_KESH + partnerId)
      if (xom) return JSON.parse(xom) as { javob: TahlilJavob; vaqt: string }
    } catch { /* buzuq kesh — e'tiborsiz qoldiramiz */ }
    return null
  })
  const [javob, setJavob] = useState<TahlilJavob | null>(kesh?.javob ?? null)
  const [vaqt, setVaqt] = useState<string>(kesh?.vaqt ?? "")
  const [band, setBand] = useState(false)
  const [xato, setXato] = useState("")

  const yugurt = async () => {
    setBand(true); setXato("")
    try {
      const d = await api<TahlilJavob>("/me/partner?action=comment-analysis")
      const v = new Date().toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      setJavob(d); setVaqt(v)
      try { localStorage.setItem(TAHLIL_KESH + partnerId, JSON.stringify({ javob: d, vaqt: v })) } catch { /* joy yo'q */ }
    } catch (e) {
      setXato(e instanceof Error ? e.message : tr("Tahlil qilib bo'lmadi"))
    } finally {
      setBand(false)
    }
  }

  const t = javob?.tahlil
  const jami = t ? t.ijobiy + t.salbiy + t.savol + t.neytral : 0

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold">{tr("Izohlar tahlili")}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {vaqt ? `${tr("oxirgi tahlil")}: ${vaqt}` : tr("Odamlar videolar ostida nima yozayotganini AI ko'rib chiqadi")}
          </p>
        </div>
        <button onClick={yugurt} disabled={band}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green px-4 py-2 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100">
          {band
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : <Icon d={I.brain} className="h-4 w-4" />}
          {band ? tr("Tahlil qilinmoqda…") : javob ? tr("Yangilash") : tr("Tahlil qilish")}
        </button>
      </div>

      {xato && <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{xato}</div>}
      {javob && !t && javob.sabab && (
        <div className="mt-3 rounded-xl bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700">{javob.sabab}</div>
      )}

      {t && jami > 0 && (
        <>
          <p className="mt-4 text-sm">
            <b>{javob?.izohlar}</b> {tr("ta izoh")} · <b>{javob?.videolar}</b> {tr("ta video")}
          </p>

          {/* Ohang nisbati — 2px oq tirqish bilan ajratilgan bo'laklar */}
          <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-full">
            {OHANG.map((o) => {
              const n = t[o.kalit]
              if (n <= 0) return null
              return <div key={o.kalit} style={{ width: `${(n / jami) * 100}%`, background: o.rang }} title={`${tr(o.nom)}: ${n}`} />
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {OHANG.map((o) => (
              <span key={o.kalit} className="inline-flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: o.rang }} />
                <span className="font-semibold">{tr(o.nom)}</span>
                <span className="text-muted">{t[o.kalit]} ({Math.round((t[o.kalit] / jami) * 100)}%)</span>
              </span>
            ))}
          </div>

          {t.xulosa && (
            <p className="mt-4 rounded-xl bg-[#fafdf7] p-3 text-sm leading-relaxed">{t.xulosa}</p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TahlilRoyxat
              sarlavha="Eng ko'p so'ralgan savollar"
              bosh="Savol berilmagan"
              rang="text-blue-600"
              elementlar={t.savollar}
            />
            <TahlilRoyxat
              sarlavha="Eng ko'p uchragan shikoyatlar"
              bosh="Shikoyat yo'q"
              rang="text-red-500"
              elementlar={t.shikoyatlar}
            />
          </div>

          {t.brend.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold text-muted">{tr("Kompaniyangiz tilga olingan izohlar")}</h4>
              <div className="mt-2 space-y-1.5">
                {t.brend.map((b, i) => (
                  <p key={i} className="rounded-lg border-l-2 border-green bg-[#fafdf7] px-3 py-2 text-xs leading-relaxed">{b}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TahlilRoyxat({ sarlavha, bosh, rang, elementlar }: {
  sarlavha: string; bosh: string; rang: string
  elementlar: { matn: string; soni: number }[]
}) {
  return (
    <div>
      <h4 className="text-xs font-bold text-muted">{tr(sarlavha)}</h4>
      {elementlar.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{tr(bosh)}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {elementlar.map((e, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg bg-[#fafdf7] px-3 py-2">
              <span className={`shrink-0 font-display text-xs font-extrabold ${rang}`}>{e.soni}×</span>
              <span className="min-w-0 flex-1 text-xs leading-relaxed">{e.matn}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------- Videolar ---------- */
/**
 * BLOGERLAR SHU KOMPANIYA UCHUN BELGILAGAN VIDEOLAR.
 *
 * Bloger video qo'shayotganda qaysi hamkor kompaniya uchun ekanini
 * belgilaydi. Shu yerda o'sha videolar to'liq statistikasi bilan
 * ko'rinadi: umumiy ko'rishlar, platformalar bo'yicha taqsimot va
 * qaysi bloger tayyorlagani.
 */
function PartnerVideos({ partnerId }: { partnerId: string }) {
  const [videos, setVideos] = useState<PartnerVideo[]>([])
  const [stats, setStats] = useState<VideoStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [platform, setPlatform] = useState("Barchasi")
  /** Grafikda tanlangan oy ("YYYY-MM") yoki null — jami */
  const [oy, setOy] = useState<string | null>(null)
  /** To'liq ma'lumot oynasida ochilgan video */
  const [ochiq, setOchiq] = useState<PartnerVideo | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setFailed(false)
    api<{ videos: PartnerVideo[]; stats: VideoStats }>("/me/partner?action=videos")
      .then((d) => { setVideos(d.videos || []); setStats(d.stats) })
      // Xato "video yo'q" degani emas — ikkalasi bir xil ko'rinmasin
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  /**
   * OY FILTRI butun bo'limga qo'llanadi: ko'rsatkichlar, donut,
   * blogerlar reytingi va ro'yxat — hammasi shu oyga tegishli
   * bo'ladi. Faqat oylik grafikning O'ZI to'liq yil bo'lib qoladi,
   * chunki u filtrning boshqaruvchisi.
   */
  const oyVideolari = useMemo(
    () => (oy ? videos.filter((v) => String(v.date || "").startsWith(oy)) : videos),
    [videos, oy],
  )
  // Serverdan kelgan `stats` butun davr uchun — oy tanlansa
  // ko'rsatkichlar shu yerda qaytadan hisoblanadi
  const korsatkich = useMemo(() => hisobla(oyVideolari), [oyVideolari])

  const platformalar = useMemo(
    () => ["Barchasi", ...Object.keys(korsatkich.platforms)],
    [korsatkich],
  )
  /**
   * Tanlangan tarmoq shu oyda umuman yo'q bo'lishi mumkin (masalan
   * Instagram tanlangan, keyin faqat YouTube video bo'lgan oy
   * bosilgan). Bunda holatni tuzatish shart emas — joriy tanlov
   * shu yerda hisoblanadi va ro'yxat bo'sh qolib ketmaydi.
   */
  const faolPlatform = platformalar.includes(platform) ? platform : "Barchasi"

  const korinadigan = useMemo(
    () => faolPlatform === "Barchasi" ? oyVideolari : oyVideolari.filter((v) => v.plats.includes(faolPlatform)),
    [oyVideolari, faolPlatform],
  )

  const oyNomi = oy ? `${oyYorlig(oy).nom} ${oyYorlig(oy).yil}` : ""

  /**
   * TAQQOSLASH — "12K ko'rish" o'zi hech narsa anglatmaydi, "o'tgan
   * oyga nisbatan +38%" esa anglatadi.
   *
   * Oy tanlanganda oldingi oy bilan solishtiriladi. "Jami" holatida
   * solishtiradigan oldingi davr yo'q, shuning uchun kartochkalarda
   * o'zgarish ko'rsatilmaydi — uning o'rniga oxirgi TO'LIQ oy
   * alohida qatorda beriladi (joriy oy hali tugamagan, uni oldingisi
   * bilan solishtirish adolatsiz).
   */
  const oldingiOy = useMemo(() => {
    if (!oy) return null
    const [y, m] = oy.split("-").map(Number)
    const d = new Date(Date.UTC(y, m - 2, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  }, [oy])

  const oldingiKorsatkich = useMemo(
    () => (oldingiOy ? hisobla(videos.filter((v) => String(v.date || "").startsWith(oldingiOy))) : null),
    [videos, oldingiOy],
  )

  /** "Jami" holatidagi qator uchun: oxirgi tugagan oy va undan oldingisi */
  const oxirgiToliq = useMemo(() => {
    const m = stats?.monthly
    if (!m || m.length < 3) return null
    // Oxirgi element — JORIY oy, u hali tugamagan
    return { oy: m[m.length - 2], oldin: m[m.length - 3] }
  }, [stats])

  const son = (n: number) => n.toLocaleString("ru-RU")

  if (loading) {
    return (
      <div className="mt-6 space-y-6">
        <SkeletonStatGrid />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }
  if (failed) {
    return <div className={`mt-6 ${card}`}><ErrorState onRetry={load} message="Videolarni yuklab bo'lmadi." /></div>
  }

  return (
    <div className="mt-6 space-y-6">
      {/*
        FILTR HOLATI — qaysi davr ko'rilayotgani va "Jami" ga
        qaytish tugmasi. Usiz foydalanuvchi raqamlar nega
        o'zgarganini tushunmasdi: ko'rsatkichlar jimgina kichrayardi.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOy(null)}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${oy ? "border border-green/25 text-green hover:bg-green/5" : "bg-green text-white"}`}
        >
          {tr("Jami")}
        </button>
        {oy && (
          <span className="inline-flex items-center gap-2 rounded-xl bg-green/10 px-3 py-2 text-sm font-bold text-green">
            {oyNomi}
            <span role="button" tabIndex={0} title={tr("Filtrni olib tashlash")}
              onClick={() => setOy(null)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOy(null) } }}
              className="cursor-pointer opacity-70 hover:opacity-100">
              <Icon d="M18 6L6 18 M6 6l12 12" className="h-3.5 w-3.5" />
            </span>
          </span>
        )}
        <span className="text-xs text-muted">
          {oy ? tr("faqat shu oy ko'rsatkichlari") : tr("butun davr bo'yicha")}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: I.media, t: tr("Videolar"), v: son(korsatkich.total), sub: `${son(korsatkich.bloggers)} ${tr("bloger")}`, n: korsatkich.total, oldin: oldingiKorsatkich?.total ?? 0 },
          { icon: I.eye, t: "Ko'rishlar", v: son(korsatkich.views), sub: tr("barcha platformalar"), n: korsatkich.views, oldin: oldingiKorsatkich?.views ?? 0 },
          { icon: I.star, t: tr("Yoqtirishlar"), v: son(korsatkich.likes), sub: tr("like"), n: korsatkich.likes, oldin: oldingiKorsatkich?.likes ?? 0 },
          { icon: I.message, t: "Izohlar", v: son(korsatkich.comments), sub: tr("komment"), n: korsatkich.comments, oldin: oldingiKorsatkich?.comments ?? 0 },
        ].map((s) => (
          <div key={s.t} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green"><Icon d={s.icon} className="h-5 w-5" /></span>
            <div className="mt-3 text-xs text-muted">{tr(s.t)}</div>
            <div className="mt-1 font-display text-2xl font-extrabold truncate">{s.v}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-green">{tr(s.sub)}</span>
              {/* O'zgarish faqat oy tanlanganda — solishtiradigan davr o'shanda bor */}
              {oldingiKorsatkich && <Ozgarish hozir={s.n} oldin={s.oldin} />}
            </div>
          </div>
        ))}
      </div>

      {/*
        "Jami" holatida kartochkalarda o'zgarish yo'q — butun davrni
        solishtiradigan oldingi davr yo'q. O'rniga oxirgi TUGAGAN oy
        beriladi: joriy oy hali tugamagan va uni to'liq oy bilan
        solishtirish har doim "tushib ketdi" degan yolg'on chiqarardi.
      */}
      {!oy && oxirgiToliq && oxirgiToliq.oy.videos > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-green/10 bg-white px-5 py-3 text-sm shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
          <span className="text-muted">{tr("Oxirgi tugagan oy")}</span>
          <b>{oyYorlig(oxirgiToliq.oy.oy).nom} {oyYorlig(oxirgiToliq.oy.oy).yil}</b>
          <span className="font-display font-extrabold">{son(oxirgiToliq.oy.views)}</span>
          <span className="text-muted">{tr("ko'rish")}</span>
          <Ozgarish hozir={oxirgiToliq.oy.views} oldin={oxirgiToliq.oldin.views} />
          <span className="text-xs text-muted">{tr("o'tgan oyga nisbatan")}</span>
        </div>
      )}

      {/*
        Shart massiv uzunligiga EMAS, ma'lumot borligiga qaraydi:
        backend har doim 12 oy qaytaradi (bo'shlari ham), shuning
        uchun `length > 0` hech qachon false bo'lmasdi va videosi
        yo'q hamkorga "Video topilmadi" yozuvi ustida bo'm-bo'sh
        grafik chizilardi.
      */}
      {stats?.monthly?.some((m) => m.videos > 0) && (
        <OylikGrafik data={stats.monthly} tanlangan={oy} onTanla={setOy} />
      )}

      <IzohlarTahlili partnerId={partnerId} />

      {Object.keys(korsatkich.platforms).length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <PlatformaDonut stats={korsatkich} />
          <TopBloggers list={korsatkich.topBloggers} />
        </div>
      )}

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold">{tr("Videolar ro'yxati")}</h3>
          {platformalar.length > 2 && (
            <div className="flex flex-wrap gap-1.5">
              {platformalar.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${faolPlatform === p ? "bg-green text-white" : "border border-green/20 text-muted hover:border-green/40"}`}
                >
                  {p === "Barchasi" ? tr("Barchasi") : p}
                </button>
              ))}
            </div>
          )}
        </div>

        {korinadigan.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-green"><Icon d={I.media} className="h-7 w-7" /></span>
            <p className="mt-3 text-sm font-semibold">{tr("Video topilmadi")}</p>
            <p className="mt-1 text-xs text-muted">{tr("Bloger video qo'shayotganda kompaniyangizni belgilasa, u shu yerda paydo bo'ladi.")}</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {korinadigan.map((v) => (
              <VideoCard key={`${v.blogger.id}-${v.id}`} v={v} onOpen={() => setOchiq(v)} />
            ))}
          </div>
        )}
      </div>

      {ochiq && <VideoModal v={ochiq} onClose={() => setOchiq(null)} />}
    </div>
  )
}


/* ---------- Topshiriqlar (TZ) ---------- */

type Brief = {
  id: string; title: string; description: string | null
  priority: string; deadline: string | null
  file_url: string | null; file_name: string | null
  status: string; admin_note: string | null; task_id: string | null
  created_at: string
  takrorlanish: string; boshlanish: string | null; tugash: string | null; keyingi: string | null
  bajarilish: { jami: number; boshlandi: number; bajarildi: number } | null
}

/**
 * TZ SO'ROVI HOLATLARI.
 *
 * Hamkor uchun eng muhim savol — "so'rovim qayerda qoldi?". Shuning
 * uchun har holatga TUSHUNARLI izoh berilgan: "new" yoki "seen" kabi
 * texnik so'zlar foydalanuvchiga hech narsa aytmaydi.
 */
const BRIEF_HOLAT: Record<string, { nom: string; izoh: string; cls: string }> = {
  new: { nom: "Yuborildi", izoh: "Administrator hali ko'rmagan", cls: "bg-soft text-muted" },
  seen: { nom: "Ko'rib chiqilmoqda", izoh: "Administrator so'rovingizni o'qidi", cls: "bg-blue-100 text-blue-600" },
  sent: { nom: "Blogerlarga yuborildi", izoh: "Topshiriq blogerlarga biriktirildi", cls: "bg-green/10 text-green" },
  rejected: { nom: "Qabul qilinmadi", izoh: "Sababi quyida yozilgan", cls: "bg-red-50 text-red-600" },
}

const TAKROR_NOM: Record<string, string> = {
  bir_marta: "Bir marta",
  kunlik: "Har kuni",
  haftalik: "Har hafta",
  oylik: "Har oy",
}

const KECHIKISH_SOAT: Record<string, number> = {
  darhol: 0, "2soat": 2, "6soat": 6, "1kun": 24, "3kun": 72,
}

/**
 * TANLANGAN JADVALNI ODDIY SO'Z BILAN AYTADI.
 *
 * "kunlik + 2soat" degan sozlama o'zi hech narsa anglatmaydi.
 * Foydalanuvchi yuborishdan OLDIN aynan nima bo'lishini ko'rishi
 * kerak — aks holda noto'g'ri jadval bilan yuborilgan TZ ni keyin
 * tuzatib bo'lmaydi.
 */
function jadvalIzohi(f: { takrorlanish: string; kechikish: string; boshlanish: string; tugash: string }): string {
  let qachon: string
  if (f.kechikish === "aniq") {
    qachon = f.boshlanish
      ? new Date(f.boshlanish).toLocaleString("ru-RU")
      : tr("sana tanlanmagan")
  } else {
    const soat = KECHIKISH_SOAT[f.kechikish] ?? 0
    qachon = soat === 0
      ? tr("darhol")
      : new Date(Date.now() + soat * 3600_000).toLocaleString("ru-RU")
  }

  const takror = f.takrorlanish === "bir_marta"
    ? tr("bir marta bajariladi")
    : `${tr(TAKROR_NOM[f.takrorlanish] || "")} ${tr("takrorlanadi")}`

  const tugash = f.takrorlanish !== "bir_marta" && f.tugash
    ? ` · ${tr("gacha")}: ${f.tugash}`
    : ""

  return `${tr("Boshlanadi")}: ${qachon} · ${takror}${tugash}`
}

const BRIEF_MUHIM: Record<string, { nom: string; cls: string }> = {
  low: { nom: "Past", cls: "bg-soft text-muted" },
  normal: { nom: "O'rtacha", cls: "bg-blue-50 text-blue-600" },
  high: { nom: "Shoshilinch", cls: "bg-orange-100 text-orange-600" },
}

function Briefs() {
  const [list, setList] = useState<Brief[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [xato, setXato] = useState(false)

  const [ochiq, setOchiq] = useState(false)
  const [forma, setForma] = useState({
    title: "", description: "", priority: "normal", deadline: "", file_url: "",
    takrorlanish: "bir_marta", kechikish: "darhol", boshlanish: "", tugash: "",
  })
  /**
   * TALAB BANDLARI — har qatordan bitta band.
   *
   * Hisobotning butun asosi shu: bandsiz TZ da "nima bajarildi, nima
   * qolmadi" degan savolga javob berib bo'lmaydi — faqat "bloger
   * tugatdi" deb aytish mumkin, bu esa hech narsani anglatmaydi.
   */
  const [bandlar, setBandlar] = useState("")
  const [band, setBand] = useState(false)
  const [xabar, setXabar] = useState<{ ok: boolean; matn: string } | null>(null)

  const yukla = useCallback(() => {
    setYuklanmoqda(true); setXato(false)
    api<{ briefs: Brief[] }>("/me/partner?action=briefs")
      .then((d) => setList(d.briefs || []))
      .catch(() => setXato(true))
      .finally(() => setYuklanmoqda(false))
  }, [])
  useEffect(() => { yukla() }, [yukla])

  const yubor = async () => {
    setXabar(null)
    if (!forma.title.trim()) { setXabar({ ok: false, matn: tr("Sarlavha yozing") }); return }
    if (forma.description.trim().length < 20) {
      setXabar({ ok: false, matn: tr("Talablarni batafsilroq yozing (kamida 20 belgi)") }); return
    }
    setBand(true)
    try {
      const royxat = bandlar.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 50)
      await api("/me/partner?action=brief-create", {
        method: "POST", body: JSON.stringify({ ...forma, bandlar: royxat }),
      })
      setXabar({ ok: true, matn: tr("Topshiriq administratorga yuborildi") })
      setForma({
        title: "", description: "", priority: "normal", deadline: "", file_url: "",
        takrorlanish: "bir_marta", kechikish: "darhol", boshlanish: "", tugash: "",
      })
      setBandlar("")
      setOchiq(false)
      yukla()
    } catch (e) {
      setXabar({ ok: false, matn: e instanceof Error ? e.message : tr("Topshiriqni yuborib bo'lmadi") })
    } finally { setBand(false) }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold">{tr("Topshiriqlar (TZ)")}</h3>
          <p className="mt-1 text-sm text-muted">
            {tr("Qanday reklama kerakligini yozing — administrator ko'rib chiqib blogerlarga yuboradi.")}
          </p>
        </div>
        <button onClick={() => { setOchiq(true); setXabar(null) }}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105">
          <Icon d="M12 5v14 M5 12h14" className="h-4 w-4" />
          {tr("Yangi topshiriq")}
        </button>
      </div>

      {xabar && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${xabar.ok ? "bg-green/10 text-green" : "bg-red-50 text-red-600"}`}>
          {xabar.matn}
        </div>
      )}

      {/* ---- Yangi topshiriq — MODAL ----
           Ilgari forma sahifa ichida ochilib, ostidagi ro'yxatni pastga
           surib yuborardi: foydalanuvchi yozayotganda ham, yopgandan
           keyin ham sahifa "sakrardi". Modal diqqatni bitta ishga
           qaratadi va sahifa tuzilishini o'zgartirmaydi. */}
      {ochiq && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          onClick={() => setOchiq(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-display text-lg font-bold">{tr("Yangi topshiriq")}</h4>
                <p className="mt-0.5 text-sm text-muted">
                  {tr("Qanday reklama kerakligini yozing — administrator ko'rib chiqib blogerlarga yuboradi.")}
                </p>
              </div>
              <button onClick={() => setOchiq(false)} aria-label={tr("Yopish")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-soft hover:text-ink">
                <Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" />
              </button>
            </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted">{tr("Sarlavha")}</label>
              <input value={forma.title} maxLength={255}
                onChange={(e) => setForma((f) => ({ ...f, title: e.target.value }))}
                placeholder={tr("Masalan: Yangi o'g'it liniyasi uchun reklama")}
                className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted">{tr("Talablar")}</label>
              <textarea value={forma.description} rows={6} maxLength={5000}
                onChange={(e) => setForma((f) => ({ ...f, description: e.target.value }))}
                placeholder={tr("Mahsulot nima, kimga qaratilgan, qanday format kerak (video/post), nimani ta'kidlash kerak, nimani aytmaslik kerak…")}
                className="mt-1 w-full resize-y rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
              {/* Bo'sh TZ adminga hech narsa bermaydi — u baribir qayta
                  so'rashga majbur bo'ladi va vaqt yo'qoladi */}
              <p className="mt-1 text-[11px] text-muted">
                {forma.description.trim().length} / 20 {tr("belgi (kamida)")}
              </p>
            </div>
            {/* TALAB BANDLARI — hisobotning asosi.
                Har qatordan bitta band. Bandsiz TZ da hisobot faqat
                "bloger tugatdi" deya oladi, bu esa nima qilinganini
                ko'rsatmaydi. */}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted">{tr("Talab bandlari — har qatordan bittasi")}</label>
              <textarea value={bandlar} rows={5}
                onChange={(e) => setBandlar(e.target.value)}
                placeholder={tr("Mahsulot qadog'ini yaqindan ko'rsatish\nNarxni aniq aytish\nTavsifga sayt havolasini qo'yish\nVideo kamida 60 soniya bo'lsin")}
                className="mt-1 w-full resize-y rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
              <p className="mt-1 text-[11px] text-muted">
                {bandlar.split("\n").filter((x) => x.trim()).length} {tr("ta band")} ·{" "}
                {tr("hisobotda har biri alohida ko'rinadi: bajarildimi, kim bajardi, qanday qildi")}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted">{tr("Muhimligi")}</label>
              <select value={forma.priority}
                onChange={(e) => setForma((f) => ({ ...f, priority: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green">
                <option value="low">{tr("Past")}</option>
                <option value="normal">{tr("O'rtacha")}</option>
                <option value="high">{tr("Shoshilinch")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted">{tr("Muddat")}</label>
              <input type="date" value={forma.deadline}
                onChange={(e) => setForma((f) => ({ ...f, deadline: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted">{tr("Havola (ixtiyoriy)")}</label>
              <input value={forma.file_url} maxLength={500}
                onChange={(e) => setForma((f) => ({ ...f, file_url: e.target.value }))}
                placeholder={tr("Mahsulot sahifasi yoki brief fayliga havola")}
                className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            </div>

            {/* ---- JADVAL: takrorlanish va qachondan boshlanishi ----
                TZ yuborilgan zahoti ishga tushishi shart emas: hamkor
                ko'pincha "2 soatdan keyin" yoki "ertaga" deydi.
                Takrorlanuvchi TZ da esa har davr uchun alohida
                topshiriq yaratiladi. */}
            <div className="sm:col-span-2 rounded-xl border border-green/15 bg-soft/60 p-3">
              <p className="text-xs font-bold text-ink">{tr("Jadval")}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted">{tr("Takrorlanish")}</label>
                  <select value={forma.takrorlanish}
                    onChange={(e) => setForma((f) => ({ ...f, takrorlanish: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green">
                    <option value="bir_marta">{tr("Bir marta")}</option>
                    <option value="kunlik">{tr("Har kuni")}</option>
                    <option value="haftalik">{tr("Har hafta")}</option>
                    <option value="oylik">{tr("Har oy")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted">{tr("Qachondan boshlansin")}</label>
                  <select value={forma.kechikish}
                    onChange={(e) => setForma((f) => ({ ...f, kechikish: e.target.value, boshlanish: "" }))}
                    className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green">
                    <option value="darhol">{tr("Darhol")}</option>
                    <option value="2soat">{tr("2 soatdan keyin")}</option>
                    <option value="6soat">{tr("6 soatdan keyin")}</option>
                    <option value="1kun">{tr("1 kundan keyin")}</option>
                    <option value="3kun">{tr("3 kundan keyin")}</option>
                    <option value="aniq">{tr("Aniq sana va vaqt")}</option>
                  </select>
                </div>
                {forma.kechikish === "aniq" && (
                  <div>
                    <label className="text-xs font-semibold text-muted">{tr("Boshlanish sanasi va vaqti")}</label>
                    <input type="datetime-local" value={forma.boshlanish}
                      onChange={(e) => setForma((f) => ({ ...f, boshlanish: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
                  </div>
                )}
                {/* Takrorlanish MUDDATSIZ bo'lsa TZ abadiy yaratilib
                    turardi — tugash sanasi shuning uchun ko'rinadi */}
                {forma.takrorlanish !== "bir_marta" && (
                  <div>
                    <label className="text-xs font-semibold text-muted">{tr("Qachongacha takrorlansin")}</label>
                    <input type="date" value={forma.tugash}
                      onChange={(e) => setForma((f) => ({ ...f, tugash: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
                  </div>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted">{jadvalIzohi(forma)}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-green/10 pt-4">
            <button onClick={yubor} disabled={band}
              className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 disabled:opacity-60">
              {band
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <Icon d={I.send} className="h-4 w-4" />}
              {band ? tr("Yuborilmoqda…") : tr("Administratorga yuborish")}
            </button>
            <button onClick={() => setOchiq(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted transition-colors hover:text-ink">
              {tr("Bekor qilish")}
            </button>
          </div>
          </div>
        </div>
      )}

      {yuklanmoqda ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : xato ? (
        <div className={card}><ErrorState onRetry={yukla} message={tr("Topshiriqlarni yuklab bo'lmadi.")} /></div>
      ) : list.length === 0 ? (
        <div className={`${card} text-center`}>
          <Icon d={I.task} className="mx-auto h-8 w-8 text-green/40" />
          <p className="mt-2 text-sm text-muted">
            {tr("Hali topshiriq yubormagansiz. \"Yangi topshiriq\" tugmasini bosing.")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => {
            const h = BRIEF_HOLAT[b.status] || BRIEF_HOLAT.new
            const m = BRIEF_MUHIM[b.priority] || BRIEF_MUHIM.normal
            return (
              <div key={b.id} className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display font-bold">{b.title}</h4>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${m.cls}`}>{tr(m.nom)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(b.created_at).toLocaleDateString("ru-RU")}
                      {b.deadline ? ` · ${tr("muddat")}: ${b.deadline}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold ${h.cls}`}>{tr(h.nom)}</span>
                    <span className="mt-1 block text-[11px] text-muted">{tr(h.izoh)}</span>
                  </span>
                </div>

                {/* ---- JADVAL ----
                    Takrorlanuvchi yoki kechiktirilgan TZ da "qachon
                    boshlanadi, qachon takrorlanadi" eng ko'p so'raladigan
                    savol. Kartada ko'rinmasa hamkor har safar so'rashi
                    kerak bo'lardi. */}
                {(b.takrorlanish !== "bir_marta" || b.boshlanish) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    {b.takrorlanish !== "bir_marta" && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-green/10 px-2 py-1 font-bold text-green">
                        <Icon d={I.refresh} className="h-3 w-3" />
                        {tr(TAKROR_NOM[b.takrorlanish] || b.takrorlanish)}
                      </span>
                    )}
                    {b.boshlanish && (
                      <span className="text-muted">
                        {new Date(b.boshlanish).getTime() > Date.now()
                          ? `${tr("Boshlanadi")}: ${new Date(b.boshlanish).toLocaleString("ru-RU")}`
                          : `${tr("Boshlangan")}: ${new Date(b.boshlanish).toLocaleDateString("ru-RU")}`}
                      </span>
                    )}
                    {b.keyingi && (
                      <span className="text-muted">
                        · {tr("keyingisi")}: {new Date(b.keyingi).toLocaleString("ru-RU")}
                      </span>
                    )}
                    {b.tugash && <span className="text-muted">· {tr("gacha")}: {b.tugash}</span>}
                  </div>
                )}

                {b.description && (
                  <p className="mt-3 whitespace-pre-wrap rounded-xl bg-soft p-3 text-sm text-ink/85">{b.description}</p>
                )}

                {b.file_url && (
                  <a href={b.file_url} target="_blank" rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-green hover:underline">
                    <Icon d={I.doc} className="h-3.5 w-3.5" /> {b.file_name || b.file_url}
                  </a>
                )}

                {/* Adminning javobi — ayniqsa rad etilganda MUHIM:
                    sababsiz "qabul qilinmadi" hech narsa bermaydi */}
                {b.admin_note && (
                  <div className="mt-3 rounded-xl border border-green/15 bg-[#fafdf7] p-3">
                    <p className="text-[11px] font-bold text-muted">{tr("Administrator javobi")}</p>
                    <p className="mt-0.5 text-sm">{b.admin_note}</p>
                  </div>
                )}

                {/* Blogerlarga yuborilgach — ish qay darajada bajarilgani.
                    Hamkor uchun "qabul qilindi" emas, AYNAN shu muhim. */}
                {b.bajarilish && b.bajarilish.jami > 0 && (
                  <div className="mt-3 rounded-xl bg-soft p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold">
                        {b.bajarilish.jami} {tr("blogerga yuborildi")}
                      </span>
                      <span className="font-bold text-green">
                        {b.bajarilish.bajarildi} / {b.bajarilish.jami} {tr("bajarildi")}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-green transition-all"
                        style={{ width: `${Math.round((b.bajarilish.bajarildi / b.bajarilish.jami) * 100)}%` }} />
                    </div>
                    {b.bajarilish.boshlandi > 0 && (
                      <p className="mt-1 text-[11px] text-muted">
                        {b.bajarilish.boshlandi} {tr("ta bloger ishni boshladi")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ---------- Hisobot ---------- */

/** `YYYY-MM-DD` — sana kiritish maydonlari va solishtirish uchun */
const kunGa = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Tayyor davrlar.
 *
 * NEGA KERAK: hisobot doim BIR DAVR uchun tuziladi — chorak, oy, yil.
 * Ilgari hisobot faqat "boshidan beri" edi va rahbariyatga "avgust
 * oyida nima qildik?" degan savolga javob bera olmasdi.
 */
function davrOraliq(kalit: string): { dan: string; gacha: string } {
  const hozir = new Date()
  const oxiri = kunGa(hozir)
  const y = hozir.getFullYear(), m = hozir.getMonth()
  if (kalit === "shu-oy") return { dan: kunGa(new Date(y, m, 1)), gacha: oxiri }
  if (kalit === "otgan-oy") {
    return { dan: kunGa(new Date(y, m - 1, 1)), gacha: kunGa(new Date(y, m, 0)) }
  }
  if (kalit === "chorak") return { dan: kunGa(new Date(y, m - 2, 1)), gacha: oxiri }
  if (kalit === "yarim-yil") return { dan: kunGa(new Date(y, m - 5, 1)), gacha: oxiri }
  if (kalit === "yil") return { dan: kunGa(new Date(y, m - 11, 1)), gacha: oxiri }
  return { dan: "", gacha: "" }   // butun davr
}

const DAVRLAR = [
  { kalit: "hammasi", nom: "Butun davr" },
  { kalit: "shu-oy", nom: "Shu oy" },
  { kalit: "otgan-oy", nom: "O'tgan oy" },
  { kalit: "chorak", nom: "3 oy" },
  { kalit: "yarim-yil", nom: "6 oy" },
  { kalit: "yil", nom: "1 yil" },
] as const

/* ---- TZ asosidagi hisobot ---- */
type TzHisobotBand = {
  id: string; title: string; status: string; note: string | null
  done_at: string | null; done_by: string | null; done_by_name: string | null
}
type TzHisobotVideo = {
  video_id: string; link: string; name: string; thumbnail: string | null
  platform: string; views: string; likes: string; comments: string
  ishonchli: boolean; ochirilgan: boolean; added_at: string
}
type TzHisobotBloger = {
  id: string; name: string; avatar: string | null; slug: string | null
  status: string; note: string | null
  videolar: TzHisobotVideo[]
  views: number; likes: number; comments: number; nomalum: number
}
type TzHisobot = {
  id: string; title: string; description: string | null
  priority: string; deadline: string | null; status: string
  admin_note: string | null; created_at: string
  takrorlanish: string; boshlanish: string | null; tugash: string | null; keyingi: string | null
  /** Nechta davr yaratilgan (kunlik TZ da kunlar soni) */
  davrSoni: number
  bandlar: TzHisobotBand[]
  bandJami: number; bandBajarildi: number
  blogerlar: TzHisobotBloger[]
  views: number; likes: number; comments: number; videoJami: number; nomalum: number
}

function Report({ partner, counts, pct, extra }: { partner: Partner; counts: { total: number; done: number; progress: number; pending: number }; pct: number; extra: CompanyExtra }) {
  const [videos, setVideos] = useState<PartnerVideo[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [xato, setXato] = useState(false)

  const [davr, setDavr] = useState<string>("hammasi")
  const [dan, setDan] = useState("")
  const [gacha, setGacha] = useState("")

  /* TZ asosidagi hisobot — bandlar, blogerlar, videolar */
  const [tz, setTz] = useState<TzHisobot[]>([])
  const [raqamHolati, setRaqamHolati] = useState<string | null>(null)
  /** Butun ro'yxatni ochish: sukut bo'yicha faqat yig'indi ko'rinadi */
  const [toliq, setToliq] = useState(false)

  const yukla = useCallback(() => {
    setYuklanmoqda(true); setXato(false)
    Promise.all([
      api<{ videos: PartnerVideo[] }>("/me/partner?action=videos")
        .then((d) => setVideos(d.videos || [])),
      // TZ hisoboti yiqilsa ham videolar statistikasi ko'rinsin
      api<{ hisobot: TzHisobot[]; raqamlarHolati: string | null }>("/me/partner?action=brief-report")
        .then((d) => { setTz(d.hisobot || []); setRaqamHolati(d.raqamlarHolati) })
        .catch(() => {}),
    ])
      // Xato "video yo'q" degani emas — ikkalasi bir xil ko'rinmasin
      .catch(() => setXato(true))
      .finally(() => setYuklanmoqda(false))
  }, [])
  useEffect(() => { yukla() }, [yukla])

  const davrniTanla = (kalit: string) => {
    setDavr(kalit)
    const o = davrOraliq(kalit)
    setDan(o.dan); setGacha(o.gacha)
  }

  /* Sana maydonlari qo'lda o'zgartirilsa tayyor davr belgisi olinadi —
     aks holda "Shu oy" yozuvi turib, oraliq boshqa bo'lib qolardi */
  const qolda = (yangiDan: string, yangiGacha: string) => {
    setDan(yangiDan); setGacha(yangiGacha); setDavr("qolda")
  }

  const davrVideolari = useMemo(() => videos.filter((v) => {
    const k = String(v.date || "").slice(0, 10)
    if (!k) return !dan && !gacha      // sanasi yo'q video faqat "butun davr" da
    if (dan && k < dan) return false
    if (gacha && k > gacha) return false
    return true
  }), [videos, dan, gacha])

  const k = useMemo(() => hisobla(davrVideolari), [davrVideolari])

  /**
   * OYLIK GRAFIK BUTUN DAVRNI ko'rsatadi, tanlangan oraliqni emas.
   *
   * Sabab: grafik filtrning O'ZI boshqaruvchisi — oy ustiga bosilsa
   * hisobot shu oyga o'tadi. Agar u ham filtrlangan bo'lsa, bir oy
   * tanlangach grafikda bitta ustun qolib, qaytish yo'li yo'qolardi.
   * Videolar bo'limida ham xuddi shunday ishlaydi.
   */
  const oylik = useMemo(() => {
    const xarita = new Map<string, { oy: string; views: number; videos: number }>()
    for (const v of videos) {
      const oy = String(v.date || "").slice(0, 7)
      if (!oy) continue
      const bor = xarita.get(oy) || { oy, views: 0, videos: 0 }
      bor.views += songa(v.views); bor.videos += 1
      xarita.set(oy, bor)
    }
    return [...xarita.values()].sort((a, b) => a.oy.localeCompare(b.oy))
  }, [videos])

  /** Oraliq AYNAN bitta to'liq oyga tengmi — grafikda shu oy belgilanadi */
  const tanlanganOy = useMemo(() => {
    if (!dan || !gacha || dan.slice(0, 7) !== gacha.slice(0, 7)) return null
    const [y, m] = dan.split("-").map(Number)
    const boshi = kunGa(new Date(y, m - 1, 1))
    const oxiri = kunGa(new Date(y, m, 0))
    return dan === boshi && gacha === oxiri ? dan.slice(0, 7) : null
  }, [dan, gacha])

  /** Grafikdan oy tanlash — hisobot davri shu oyga o'tadi */
  const oyniTanla = (oy: string | null) => {
    if (!oy) { davrniTanla("hammasi"); return }
    const [y, m] = oy.split("-").map(Number)
    setDan(kunGa(new Date(y, m - 1, 1)))
    setGacha(kunGa(new Date(y, m, 0)))
    setDavr("qolda")
  }

  const son = (n: number) => n.toLocaleString("ru-RU")
  const davrNomi = dan || gacha
    ? `${dan || "…"} — ${gacha || "…"}`
    : tr("Butun hamkorlik davri")

  /**
   * A4 GA CHOP ETISH.
   *
   * Tashqi kutubxona QO'SHILMADI: brauzerning o'z chop etish oynasi
   * "PDF sifatida saqlash" ni beradi va sahifa o'lchami, chekkalar,
   * varaqlarga bo'linish `@media print` orqali boshqariladi
   * (qarang: src/index.css). PDF kutubxonasi ~300 KB qo'shardi va
   * SVG diagrammalarni qaytadan chizishga majbur qilardi.
   *
   * `print-area` sinfi shu blokdagina — chap menyu, tepa panel va
   * tugmalar qog'ozga tushmaydi.
   */
  const chopEt = () => {
    // To'liq ro'yxat ochilmagan bo'lsa qog'ozga ham qisqasi tushadi —
    // buni foydalanuvchi bilishi kerak emas, chunki ekranda ham shunday
    window.print()
  }

  return (
    <div className="print-area mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold">{tr("Hamkorlik hisoboti")}</h3>
          <p className="mt-1 text-sm text-muted">{tr("Kompaniyangiz bo'yicha umumiy hisobot. Chop etish yoki PDF sifatida saqlash mumkin.")}</p>
        </div>
        <button onClick={chopEt} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105">
          <Icon d={I.doc} className="h-4 w-4" /> {tr("A4 ga chop etish / PDF")}
        </button>
      </div>

      {/* ---- Davr tanlash ---- */}
      <div className={`mt-5 ${card} print:hidden`}>
        <div className="flex flex-wrap items-center gap-2">
          {DAVRLAR.map((d) => (
            <button key={d.kalit} onClick={() => davrniTanla(d.kalit)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                davr === d.kalit ? "bg-green text-white" : "border border-green/20 text-muted hover:border-green/50"
              }`}>
              {tr(d.nom)}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-green/15" />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            {tr("dan")}
            <input type="date" value={dan} onChange={(e) => qolda(e.target.value, gacha)}
              className="rounded-lg border border-green/20 bg-white px-2 py-1.5 text-xs outline-none focus:border-green" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            {tr("gacha")}
            <input type="date" value={gacha} onChange={(e) => qolda(dan, e.target.value)}
              className="rounded-lg border border-green/20 bg-white px-2 py-1.5 text-xs outline-none focus:border-green" />
          </label>
        </div>
      </div>

      {/* ---- Hisobot varag'i ---- */}
      <div className={`mt-5 ${card} print-block`}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-green/10 pb-4">
          <div className="min-w-0">
            <div className="font-display text-xl font-extrabold">{partner.name}</div>
            <div className="text-sm text-muted">{partner.sphere || tr("Hamkor kompaniya")}{extra.website ? ` • ${extra.website}` : ""}</div>
          </div>
          {/* Qaysi davr uchun ekani QOG'OZDA ham ko'rinishi shart —
              aks holda chop etilgan hisobotning raqamlari qaysi
              oyga tegishli ekani noma'lum qolardi */}
          <div className="text-right text-xs text-muted">
            <div>{tr("Hisobot davri")}</div>
            <div className="font-display text-sm font-bold text-ink">{davrNomi}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[[tr("Shartnoma raqami"), partner.contractNo || "—"], [tr("Shartnoma summasi"), fmtSom(partner.amount) + " " + tr("so'm")], [tr("Imzolangan sana"), partner.signedDate || "—"], [tr("Holat"), (partnerStatusMeta[partner.status] || partnerStatusMeta.active).label], [tr("Jami ishlar"), String(counts.total)], [tr("Bajarilish"), `${pct}% (${counts.done}/${counts.total})`]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{l}</div><div className="mt-0.5 font-display font-bold">{v}</div></div>
          ))}
        </div>
        {extra.description && <div className="mt-4 rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{tr("Kompaniya haqida")}</div><div className="mt-1 text-sm">{extra.description}</div></div>}
      </div>

      {/* ============ REKLAMA NATIJALARI ============
          Ilgari hisobotda faqat shartnoma ma'lumotlari bor edi va
          "shu pulga nima oldik?" degan savolga javob yo'q edi.
          Raqamlar Videolar bo'limida turardi, hisobotga tushmasdi. */}
      {yuklanmoqda ? (
        <div className="mt-6"><SkeletonStatGrid /></div>
      ) : xato ? (
        <div className={`mt-6 ${card}`}>
          <ErrorState onRetry={yukla} message={tr("Reklama natijalarini yuklab bo'lmadi.")} />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <h4 className="font-display text-base font-bold">
            {tr("Reklama natijalari")}
            <span className="ml-2 text-sm font-normal text-muted">{davrNomi}</span>
          </h4>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: I.media, t: "Videolar", v: son(k.total), sub: `${son(k.bloggers)} ${tr("bloger")}` },
              { icon: I.eye, t: "Ko'rishlar", v: son(k.views), sub: tr("barcha platformalar") },
              { icon: I.star, t: "Yoqtirishlar", v: son(k.likes), sub: tr("like") },
              { icon: I.message, t: "Izohlar", v: son(k.comments), sub: tr("komment") },
            ].map((s) => (
              <div key={s.t} className="min-w-0 print-block rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green"><Icon d={s.icon} className="h-5 w-5" /></span>
                <div className="mt-3 text-xs text-muted">{tr(s.t)}</div>
                <div className="mt-1 truncate font-display text-2xl font-extrabold">{s.v}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-green">{s.sub}</div>
              </div>
            ))}
          </div>

          {k.total === 0 ? (
            <div className={`${card} text-center text-sm text-muted`}>
              {tr("Tanlangan davrda video yo'q — boshqa oraliqni tanlab ko'ring.")}
            </div>
          ) : (
            <>
              {/* Oylik grafik faqat bir necha oy bo'lganda ma'noli:
                  bitta ustunli grafik hech narsa ko'rsatmaydi */}
              {oylik.length > 1 && (
                <div className="print-block">
                  <OylikGrafik data={oylik} tanlangan={tanlanganOy} onTanla={oyniTanla} />
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="print-block"><PlatformaDonut stats={k} /></div>
                <div className="print-block"><TopBloggers list={k.topBloggers.slice(0, 5)} /></div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ TZ BO'YICHA BAJARILISH ============
          Hamkor TZ da nima yozgan bo'lsa — aynan shu bandlar va
          ularning holati. Ilgari hisobot faqat "N ta ishdan M tasi"
          deb ayta olardi: qaysi ish, kim qildi, qanday qildi va qaysi
          video bilan — hech biri ko'rinmasdi. */}
      {tz.length > 0 && (
        <div className="print-page-break mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-display text-base font-bold">{tr("Topshiriqlar bo'yicha bajarilish")}</h4>
              <p className="mt-0.5 text-sm text-muted">
                {tr("Siz yuborgan har bir TZ va uning natijasi")}
              </p>
            </div>
            {/* Uzun hisobot qog'ozda 20 varaq bo'lib ketadi. Sukut
                bo'yicha yig'indi, to'liq ro'yxat esa so'ralganda. */}
            <button type="button" onClick={() => setToliq((v) => !v)}
              className="shrink-0 rounded-xl border border-green/25 px-4 py-2 text-xs font-bold text-green transition-colors hover:bg-green/5 print:hidden">
              {toliq ? tr("Qisqartirish") : tr("To'liq ro'yxatni ochish")}
            </button>
          </div>

          {/* Raqamlar qachonligini AYTISH shart: bugun 120 000, ertaga
              145 000 — chop etilgan ikki hisobot bir-biriga zid
              ko'rinadi va sabab tushunarsiz qoladi. */}
          {raqamHolati && (
            <p className="mt-2 text-[11px] text-muted">
              {tr("Ko'rish va yoqtirish raqamlari oxirgi marta yangilangan")}:{" "}
              {new Date(Number(raqamHolati) || raqamHolati).toLocaleString("ru-RU")}
            </p>
          )}

          <div className="mt-4 space-y-4">
            {tz.map((b) => {
              const foiz = b.bandJami ? Math.round((b.bandBajarildi / b.bandJami) * 100) : 0
              const holat = BRIEF_HOLAT[b.status] || BRIEF_HOLAT.new
              return (
                <div key={b.id} className={`${card} print-block`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-green/10 pb-3">
                    <div className="min-w-0">
                      <h5 className="font-display font-bold">{b.title}</h5>
                      <p className="mt-0.5 text-xs text-muted">
                        {new Date(b.created_at).toLocaleDateString("ru-RU")}
                        {b.deadline ? ` · ${tr("muddat")}: ${b.deadline}` : ""}
                        {b.takrorlanish !== "bir_marta" && (
                          <> · <b className="text-green">{tr(TAKROR_NOM[b.takrorlanish] || b.takrorlanish)}</b>
                          {b.davrSoni > 1 ? ` · ${b.davrSoni} ${tr("davr")}` : ""}</>
                        )}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${holat.cls}`}>
                      {tr(holat.nom)}
                    </span>
                  </div>

                  {/* Natija raqamlari */}
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { t: "Bandlar", v: `${b.bandBajarildi} / ${b.bandJami}` },
                      { t: "Videolar", v: String(b.videoJami) },
                      { t: "Ko'rishlar", v: son(b.views) },
                      { t: "Yoqtirishlar", v: son(b.likes) },
                    ].map((s) => (
                      <div key={s.t} className="rounded-xl bg-[#fafdf7] p-3">
                        <div className="text-[11px] text-muted">{tr(s.t)}</div>
                        <div className="mt-0.5 font-display font-bold tabular-nums">{s.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Raqami noma'lum videolar — jimgina 0 deb sanash
                      hisobotni yolg'on qilardi */}
                  {b.nomalum > 0 && (
                    <p className="mt-2 text-[11px] text-orange-600">
                      {b.nomalum} {tr("ta videoning ko'rish soni noma'lum (faqat YouTube raqamlari avtomatik olinadi) — ular jamiga qo'shilmagan.")}
                    </p>
                  )}

                  {b.bandJami > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-soft">
                        <div className="h-full rounded-full bg-green" style={{ width: `${foiz}%` }} />
                      </div>
                    </div>
                  )}

                  {/* ---- Bandlar: nima bajarildi, nima yo'q ---- */}
                  {b.bandlar.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {(toliq ? b.bandlar : b.bandlar.slice(0, 4)).map((x) => {
                        const ok = x.status === "done"
                        return (
                          <li key={x.id} className="flex items-start gap-2">
                            <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded ${
                              ok ? "bg-green text-white" : "border-2 border-gray-300"}`}>
                              {ok && <Icon d={I.check} className="h-2.5 w-2.5" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block text-xs ${ok ? "text-ink/85" : "text-muted"}`}>{x.title}</span>
                              {/* "Qanday qilindi" — blogerning izohi */}
                              {x.note && <span className="block text-[11px] text-muted">↳ {x.note}</span>}
                              {ok && x.done_by_name && (
                                <span className="block text-[11px] text-green">
                                  {x.done_by_name}
                                  {x.done_at ? ` · ${new Date(x.done_at).toLocaleDateString("ru-RU")}` : ""}
                                </span>
                              )}
                            </span>
                          </li>
                        )
                      })}
                      {!toliq && b.bandlar.length > 4 && (
                        <li className="text-[11px] text-muted">
                          + {b.bandlar.length - 4} {tr("ta band — \"To'liq ro'yxatni ochish\"")}
                        </li>
                      )}
                    </ul>
                  ) : (
                    /* Bandsiz TZ da 0% ko'rsatish "ish qilinmagan" degan
                       yolg'on xabar bo'lardi — holatni boshqacha aytamiz */
                    <p className="mt-3 rounded-xl bg-soft px-3 py-2 text-[11px] text-muted">
                      {tr("Bu TZ bandlarga bo'linmagan — umumiy holat blogerlar bo'yicha ko'rsatilgan.")}
                    </p>
                  )}

                  {/* ---- Kim bajardi va qanday natija ---- */}
                  {b.blogerlar.length > 0 && (
                    <div className="mt-3 border-t border-green/10 pt-3">
                      <p className="text-xs font-bold text-ink">{tr("Kim bajardi")}</p>
                      <ul className="mt-2 space-y-2">
                        {b.blogerlar.map((bl) => (
                          <li key={bl.id} className="rounded-xl bg-[#fafdf7] p-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 truncate text-xs font-bold">{bl.name}</span>
                              <span className="shrink-0 text-[11px] text-muted">
                                {bl.videolar.length} {tr("video")} · <b className="text-ink tabular-nums">{son(bl.views)}</b> {tr("ko'rish")} · {son(bl.likes)} {tr("layk")}
                              </span>
                            </div>
                            {bl.note && <p className="mt-1 text-[11px] text-muted">{bl.note}</p>}
                            {(toliq ? bl.videolar : bl.videolar.slice(0, 2)).map((v) => (
                              <div key={v.link} className="mt-1.5 flex items-center gap-2">
                                {v.thumbnail && <img src={v.thumbnail} alt="" className="h-7 w-12 shrink-0 rounded object-cover" />}
                                <span className="min-w-0 flex-1">
                                  <a href={v.link} target="_blank" rel="noreferrer"
                                    className="block truncate text-[11px] font-semibold text-green hover:underline">{v.name}</a>
                                  <span className="block text-[10px] text-muted">
                                    {v.platform} ·{" "}
                                    {v.ishonchli ? `${v.views} ${tr("ko'rish")}` : tr("ko'rish ma'lumoti yo'q")}
                                    {v.ochirilgan && <span className="text-orange-600"> · {tr("video o'chirilgan")}</span>}
                                  </span>
                                </span>
                              </div>
                            ))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Rad etilgan bo'lsa sababi */}
                  {b.admin_note && (
                    <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-[11px] text-orange-700">
                      <b>{tr("Administrator javobi")}:</b> {b.admin_note}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Sozlamalar ---------- */
function Settings() {
  const [pwd, setPwd] = useState("")
  const [pwd2, setPwd2] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const changePwd = async () => {
    setMsg(null)
    if (pwd.length < 6) { setMsg({ ok: false, text: tr("Parol kamida 6 belgi bo'lishi kerak") }); return }
    if (pwd !== pwd2) { setMsg({ ok: false, text: tr("Parollar mos kelmadi") }); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd })
      if (error) throw new Error(error.message)
      setMsg({ ok: true, text: tr("Parol muvaffaqiyatli o'zgartirildi") }); setPwd(""); setPwd2("")
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Xatolik" }) } finally { setBusy(false) }
  }

  return (
    <div className={`mt-6 ${card} max-w-lg`}>
      <h3 className="font-display text-lg font-bold">{tr("Parolni o'zgartirish")}</h3>
      <p className="mt-1 text-sm text-muted">{tr("Hisobingiz uchun yangi parol o'rnating.")}</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted">{tr("Yangi parol")}</label>
          <input value={pwd} onChange={(e) => setPwd(e.target.value)} type="password" placeholder={tr("Kamida 6 belgi")} className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted">{tr("Parolni tasdiqlang")}</label>
          <input value={pwd2} onChange={(e) => setPwd2(e.target.value)} type="password" placeholder={tr("Yangi parolni qayta kiriting")} className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
        </div>
        {msg && <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? "bg-green/10 text-green" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
        <button onClick={changePwd} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60">
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon d={I.lock} className="h-4 w-4" />} {tr("O'zgartirish")}
        </button>
      </div>
    </div>
  )
}
