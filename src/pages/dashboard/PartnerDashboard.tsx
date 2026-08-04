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

const OY_NOMI = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"]
const oyYorlig = (oy: string) => {
  const [y, m] = oy.split("-")
  return { nom: OY_NOMI[Number(m) - 1] || m, yil: y }
}

const partnerStatusMeta: Record<string, { label: string; cls: string }> = {
  active: { label: "Faol", cls: "bg-green/10 text-green" },
  pending: { label: "Kutilmoqda", cls: "bg-orange-100 text-orange-600" },
  completed: { label: "Yakunlangan", cls: "bg-blue-100 text-blue-600" },
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
      user={{ name: user?.name || "Hamkor", role: "Hamkor kompaniya", initials }}
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
                <p className="mt-0.5 text-sm text-muted">{partner.sphere || "Hamkor kompaniya"} • Hamkorlik kabineti</p>
              </div>
            </div>
          </div>

          {active === "Umumiy" && <Overview partner={partner} counts={counts} pct={pct} onNav={setActive} />}
          {active === "Kompaniya profili" && (
            extraLoading
              ? <Skeleton className="h-96 w-full rounded-2xl" />
              : extraFailed
                ? <ErrorState onRetry={reload} message="Kompaniya profilini yuklab bo'lmadi. Saqlash ma'lumotni o'chirib yuborishi mumkin — avval qayta yuklang." />
                : <CompanyProfile partner={partner} extra={extra} onSaved={reload} />
          )}
          {active === "Shartnoma" && <Contract partner={partner} counts={counts} />}
          {active === "Videolar" && <PartnerVideos />}
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
    { icon: I.wallet, t: "Shartnoma summasi", v: `${fmtSom(partner.amount)}`, sub: "so'm" },
    { icon: I.task, t: "Jami ishlar", v: String(counts.total), sub: `${counts.done} bajarilgan` },
    { icon: I.target, t: "Bajarilish", v: `${pct}%`, sub: `${counts.progress} jarayonda` },
    // Yuklanayotganda "0" emas, "…" — nol real raqamdek ko'rinib qolmasin.
    { icon: I.media, t: "Videolar", v: vs ? String(vs.total) : "…", sub: vs ? `${vs.bloggers} bloger` : "yuklanmoqda" },
  ]
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.t} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green"><Icon d={s.icon} className="h-5 w-5" /></span>
            <div className="mt-3 text-xs text-muted">{s.t}</div>
            <div className="mt-1 font-display text-2xl font-extrabold truncate">{s.v}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-green">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className={`mt-6 ${card}`}>
        <h3 className="font-display text-lg font-bold">{tr("Shartnoma qisqacha")}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{tr("Shartnoma raqami")}</div><div className="mt-0.5 font-display font-bold">{partner.contractNo || "—"}</div></div>
          <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{tr("Summa")}</div><div className="mt-0.5 font-display font-bold text-green">{fmtSom(partner.amount)} so'm</div></div>
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
          {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon d={I.check} className="h-4 w-4" />} Saqlash
        </button>
      </div>
      {saved && <div className="mt-3 flex items-center gap-2 rounded-xl bg-green/10 px-4 py-3 text-sm font-semibold text-green"><Icon d={I.check} className="h-4 w-4" />{tr("Saqlandi!")}</div>}
      {error && <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {field("Kompaniya nomi", "name", "Kompaniya nomi")}
        {field("Yo'nalish / soha", "sphere", "masalan: O'g'itlar")}
        {field("Veb-sayt", "website", "https://...")}
        {field("Telefon", "phone", "+998 ...")}
        {field("Instagram", "instagram", "@username yoki link")}
        {field("Telegram", "telegram", "@username yoki link")}
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
            <h3 className="font-display text-lg font-bold">Shartnoma № {partner.contractNo || "—"}</h3>
            <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${ps.cls}`}>{ps.label}</span>
          </div>
        </div>
        <div className="mt-5 space-y-3 text-sm">
          {[["Kompaniya", partner.name], ["Yo'nalish", partner.sphere || "—"], ["Shartnoma summasi", fmtSom(partner.amount) + " so'm"], ["Imzolangan sana", partner.signedDate || "—"]].map(([l, v]) => (
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
          {[["Bajarilgan", counts.done, "text-green"], ["Jarayonda", counts.progress, "text-orange-600"], ["Kutilayotgan", counts.pending, "text-slate-500"]].map(([l, v, c]) => (
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
    { icon: I.star, label: "Yoqtirishlar", value: raqam(v.likes) },
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
      .catch(() => { setComments([]); setSabab("Izohlarni yuklab bo'lmadi") })
  }, [ytId])

  const qatorlar: [string, string][] = [
    ["Bloger", v.blogger.name],
    ["Kanal", v.channel || "—"],
    ["Platforma", v.plats.join(", ") || "—"],
    ["Chiqarilgan sana", v.date || "—"],
    ["Davomiyligi", v.duration || "—"],
  ]
  const olcham = [
    { icon: I.eye, label: "Ko'rishlar", value: raqam(v.views) },
    { icon: I.star, label: "Yoqtirishlar", value: raqam(v.likes) },
    { icon: I.message, label: "Izohlar", value: raqam(v.comments) },
    { icon: I.target, label: "Jalb qilish", value: jalbDarajasi(v) },
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
function OylikGrafik({ data }: { data: VideoStats["monthly"] }) {
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
            return (
              <div
                key={d.oy}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center"
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
                    opacity: ustida === null || faol ? 1 : 0.55,
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
function PlatformaDonut({ stats }: { stats: VideoStats }) {
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

/* ---------- Videolar ---------- */
/**
 * BLOGERLAR SHU KOMPANIYA UCHUN BELGILAGAN VIDEOLAR.
 *
 * Bloger video qo'shayotganda qaysi hamkor kompaniya uchun ekanini
 * belgilaydi. Shu yerda o'sha videolar to'liq statistikasi bilan
 * ko'rinadi: umumiy ko'rishlar, platformalar bo'yicha taqsimot va
 * qaysi bloger tayyorlagani.
 */
function PartnerVideos() {
  const [videos, setVideos] = useState<PartnerVideo[]>([])
  const [stats, setStats] = useState<VideoStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [platform, setPlatform] = useState("Barchasi")
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

  const platformalar = useMemo(
    () => ["Barchasi", ...Object.keys(stats?.platforms || {})],
    [stats],
  )
  const korinadigan = useMemo(
    () => platform === "Barchasi" ? videos : videos.filter((v) => v.plats.includes(platform)),
    [videos, platform],
  )

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: I.media, t: "Jami video", v: son(stats?.total || 0), sub: `${son(stats?.bloggers || 0)} bloger` },
          { icon: I.eye, t: "Jami ko'rishlar", v: son(stats?.views || 0), sub: "barcha platformalar" },
          { icon: I.star, t: "Jami yoqtirishlar", v: son(stats?.likes || 0), sub: "like" },
          { icon: I.message, t: "Jami izohlar", v: son(stats?.comments || 0), sub: "komment" },
        ].map((s) => (
          <div key={s.t} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green"><Icon d={s.icon} className="h-5 w-5" /></span>
            <div className="mt-3 text-xs text-muted">{tr(s.t)}</div>
            <div className="mt-1 font-display text-2xl font-extrabold truncate">{s.v}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-green">{tr(s.sub)}</div>
          </div>
        ))}
      </div>

      {/*
        Shart massiv uzunligiga EMAS, ma'lumot borligiga qaraydi:
        backend har doim 12 oy qaytaradi (bo'shlari ham), shuning
        uchun `length > 0` hech qachon false bo'lmasdi va videosi
        yo'q hamkorga "Video topilmadi" yozuvi ustida bo'm-bo'sh
        grafik chizilardi.
      */}
      {stats?.monthly?.some((m) => m.videos > 0) && <OylikGrafik data={stats.monthly} />}

      {stats && Object.keys(stats.platforms).length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <PlatformaDonut stats={stats} />
          <TopBloggers list={stats.topBloggers || []} />
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
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${platform === p ? "bg-green text-white" : "border border-green/20 text-muted hover:border-green/40"}`}
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


/* ---------- Hisobot ---------- */
function Report({ partner, counts, pct, extra }: { partner: Partner; counts: { total: number; done: number; progress: number; pending: number }; pct: number; extra: CompanyExtra }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">{tr("Hamkorlik hisoboti")}</h3>
          <p className="mt-1 text-sm text-muted">{tr("Kompaniyangiz bo'yicha umumiy hisobot. Chop etish yoki PDF sifatida saqlash mumkin.")}</p>
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105">
          <Icon d={I.doc} className="h-4 w-4" /> Chop etish / PDF
        </button>
      </div>
      <div className={`mt-5 ${card}`}>
        <div className="border-b border-green/10 pb-4">
          <div className="font-display text-xl font-extrabold">{partner.name}</div>
          <div className="text-sm text-muted">{partner.sphere || "Hamkor kompaniya"}{extra.website ? ` • ${extra.website}` : ""}</div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[["Shartnoma raqami", partner.contractNo || "—"], ["Shartnoma summasi", fmtSom(partner.amount) + " so'm"], ["Imzolangan sana", partner.signedDate || "—"], ["Holat", (partnerStatusMeta[partner.status] || partnerStatusMeta.active).label], ["Jami ishlar", String(counts.total)], ["Bajarilish", `${pct}% (${counts.done}/${counts.total})`]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{l}</div><div className="mt-0.5 font-display font-bold">{v}</div></div>
          ))}
        </div>
        {extra.description && <div className="mt-4 rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">{tr("Kompaniya haqida")}</div><div className="mt-1 text-sm">{extra.description}</div></div>}
      </div>
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
    if (pwd.length < 6) { setMsg({ ok: false, text: "Parol kamida 6 belgi bo'lishi kerak" }); return }
    if (pwd !== pwd2) { setMsg({ ok: false, text: "Parollar mos kelmadi" }); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd })
      if (error) throw new Error(error.message)
      setMsg({ ok: true, text: "Parol muvaffaqiyatli o'zgartirildi" }); setPwd(""); setPwd2("")
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
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon d={I.lock} className="h-4 w-4" />} O'zgartirish
        </button>
      </div>
    </div>
  )
}
