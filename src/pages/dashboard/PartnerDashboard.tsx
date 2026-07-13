import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import DashboardLayout, { Donut } from "../../components/DashboardLayout"
import { Icon, I, fmtSom } from "../../lib/ui"
import { api } from "../../lib/api"
import { useAuth } from "../../lib/auth"
import { supabase } from "../../lib/supabase"

const nav = [
  { label: "Umumiy", icon: I.dashboard },
  { label: "Kompaniya profili", icon: I.building },
  { label: "Shartnoma", icon: I.doc },
  { label: "Loyiha ishlari", icon: I.task },
  { label: "Statistika", icon: I.chart },
  { label: "Blogerlar", icon: I.users },
  { label: "Bildirishnomalar", icon: I.bell },
  { label: "Hisobot", icon: I.fileText },
  { label: "Sozlamalar", icon: I.gear },
]

type Task = { id: number; title: string; status: "done" | "progress" | "pending" }
type Partner = {
  id: number; name: string; sphere: string; contractNo: string
  amount: number; signedDate: string; status: string; tasks: Task[]
}
type CompanyExtra = { description?: string; website?: string; phone?: string; address?: string; instagram?: string; telegram?: string }
type Notif = { id: string; title: string; body: string; type: string; is_read: boolean; link: string | null; created_at: string }
type Blogger = { slug: string; name: string; cat: string; subs: string; region: string; avatar: string; tag?: string }

const taskMeta: Record<string, { label: string; cls: string; dot: string }> = {
  done: { label: "Bajarilgan", cls: "bg-green/10 text-green", dot: "bg-green" },
  progress: { label: "Jarayonda", cls: "bg-orange-100 text-orange-600", dot: "bg-orange-500" },
  pending: { label: "Kutilayotgan", cls: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
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
        <span className="font-semibold">Umumiy bajarilish <span className="text-muted">({done}/{total})</span></span>
        <span className="font-bold text-green">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-green transition-all" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function TaskRow({ t }: { t: Task }) {
  const tm = taskMeta[t.status] || taskMeta.pending
  return (
    <div className="flex items-center gap-3 rounded-lg border border-green/8 bg-white px-3 py-2.5">
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold ${tm.cls}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${tm.dot}`} /> {tm.label}
      </span>
      <span className={`flex-1 text-sm ${t.status === "done" ? "text-muted line-through" : ""}`}>{t.title}</span>
      {t.status === "done" && <Icon d={I.check} className="h-4 w-4 shrink-0 text-green" />}
    </div>
  )
}

export default function PartnerDashboard() {
  const [active, setActive] = useState("Umumiy")
  const [partner, setPartner] = useState<Partner | null>(null)
  const [extra, setExtra] = useState<CompanyExtra>({})
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const { user, logout } = useAuth()
  const nav2 = useNavigate()

  const reload = () => {
    api<{ partner: Partner }>("/me/partner").then((d) => setPartner(d.partner)).catch((e) => setErr(e?.message || "Yuklashda xatolik")).finally(() => setLoading(false))
    api<{ settings: CompanyExtra; notifications: Notif[] }>("/client/partner").then((d) => { setExtra(d.settings || {}); setNotifs(d.notifications || []) }).catch(() => {})
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
      {loading && <div className="grid min-h-[50vh] place-items-center text-muted">Yuklanmoqda…</div>}
      {err && !loading && <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-600">{err}</div>}
      {!loading && !err && !partner && (
        <div className="grid min-h-[50vh] place-items-center text-center">
          <div>
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-soft text-green"><Icon d={I.building} className="h-8 w-8" /></span>
            <h2 className="mt-4 font-display text-xl font-bold">Kompaniya topilmadi</h2>
            <p className="mt-2 text-muted">Hisobingizga biriktirilgan hamkor kompaniya topilmadi. Administrator bilan bog'laning.</p>
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

          {active === "Umumiy" && <Overview partner={partner} counts={counts} pct={pct} notifs={notifs} onNav={setActive} />}
          {active === "Kompaniya profili" && <CompanyProfile partner={partner} extra={extra} onSaved={reload} />}
          {active === "Shartnoma" && <Contract partner={partner} counts={counts} />}
          {active === "Loyiha ishlari" && <TasksSection partner={partner} counts={counts} />}
          {active === "Statistika" && <Statistics counts={counts} pct={pct} partner={partner} />}
          {active === "Blogerlar" && <BloggersBrowse />}
          {active === "Bildirishnomalar" && <Notifications notifs={notifs} />}
          {active === "Hisobot" && <Report partner={partner} counts={counts} pct={pct} extra={extra} />}
          {active === "Sozlamalar" && <Settings />}
        </>
      )}
    </DashboardLayout>
  )
}

/* ---------- Umumiy ---------- */
function Overview({ partner, counts, pct, notifs, onNav }: { partner: Partner; counts: { total: number; done: number; progress: number; pending: number }; pct: number; notifs: Notif[]; onNav: (t: string) => void }) {
  const statCards = [
    { icon: I.wallet, t: "Shartnoma summasi", v: `${fmtSom(partner.amount)}`, sub: "so'm" },
    { icon: I.task, t: "Jami ishlar", v: String(counts.total), sub: `${counts.done} bajarilgan` },
    { icon: I.target, t: "Bajarilish", v: `${pct}%`, sub: `${counts.progress} jarayonda` },
    { icon: I.bell, t: "Bildirishnoma", v: String(notifs.filter((n) => !n.is_read).length), sub: "o'qilmagan" },
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className={card}>
          <h3 className="font-display text-lg font-bold">Ishlar holati</h3>
          {counts.total === 0 ? (
            <p className="mt-6 text-center text-sm text-muted">Hozircha ish qo'shilmagan.</p>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:justify-around">
              <div className="relative grid place-items-center">
                <Donut segments={[
                  { label: "Bajarilgan", value: counts.done, color: "#5bb420" },
                  { label: "Jarayonda", value: counts.progress, color: "#f97316" },
                  { label: "Kutilayotgan", value: counts.pending, color: "#cbd5e1" },
                ]} />
                <div className="absolute text-center">
                  <div className="font-display text-2xl font-extrabold leading-none">{pct}%</div>
                  <div className="text-[11px] text-muted">bajarildi</div>
                </div>
              </div>
              <div className="space-y-2.5">
                {[["Bajarilgan", counts.done, "bg-green"], ["Jarayonda", counts.progress, "bg-orange-500"], ["Kutilayotgan", counts.pending, "bg-slate-300"]].map(([l, v, c]) => (
                  <div key={l as string} className="flex items-center gap-2.5 text-sm">
                    <span className={`h-3 w-3 rounded-full ${c}`} />
                    <span className="text-muted">{l}</span>
                    <span className="ml-auto font-bold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={card}>
          <h3 className="font-display text-lg font-bold">Shartnoma qisqacha</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">Shartnoma raqami</div><div className="mt-0.5 font-display font-bold">{partner.contractNo || "—"}</div></div>
            <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">Summa</div><div className="mt-0.5 font-display font-bold text-green">{fmtSom(partner.amount)} so'm</div></div>
            <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">Imzolangan</div><div className="mt-0.5 font-display font-bold">{partner.signedDate || "—"}</div></div>
            <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">Yo'nalish</div><div className="mt-0.5 font-display font-bold truncate">{partner.sphere || "—"}</div></div>
          </div>
          <div className="mt-5"><ProgressBar done={counts.done} total={counts.total} /></div>
        </div>
      </div>

      <div className={`mt-6 ${card}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">So'nggi bildirishnomalar</h3>
          <button onClick={() => onNav("Bildirishnomalar")} className="text-sm font-semibold text-green hover:underline">Barchasi →</button>
        </div>
        <div className="mt-4 space-y-2">
          {notifs.length === 0 && <p className="py-6 text-center text-sm text-muted">Bildirishnoma yo'q.</p>}
          {notifs.slice(0, 4).map((n) => (
            <div key={n.id} className={`flex items-start gap-3 rounded-lg border border-green/8 px-3 py-2.5 ${n.is_read ? "bg-white" : "bg-green/5"}`}>
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-soft text-green"><Icon d={I.bell} className="h-3.5 w-3.5" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{n.title}</div>
                {n.body && <div className="text-xs text-muted line-clamp-1">{n.body}</div>}
              </div>
              {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green" />}
            </div>
          ))}
        </div>
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
        <h3 className="font-display text-lg font-bold">Kompaniya ma'lumotlari</h3>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60">
          {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon d={I.check} className="h-4 w-4" />} Saqlash
        </button>
      </div>
      {saved && <div className="mt-3 flex items-center gap-2 rounded-xl bg-green/10 px-4 py-3 text-sm font-semibold text-green"><Icon d={I.check} className="h-4 w-4" /> Saqlandi!</div>}
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
        <label className="text-xs font-semibold text-muted">Manzil</label>
        <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Shahar, ko'cha..." className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
      </div>
      <div className="mt-4">
        <label className="text-xs font-semibold text-muted">Kompaniya haqida</label>
        <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} placeholder="Kompaniyangiz faoliyati haqida qisqacha..." className="mt-1 w-full resize-none rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
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
        <h3 className="font-display text-lg font-bold">Bajarilish darajasi</h3>
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

/* ---------- Loyiha ishlari ---------- */
function TasksSection({ partner, counts }: { partner: Partner; counts: { total: number; done: number; progress: number; pending: number } }) {
  const [filter, setFilter] = useState<"all" | "done" | "progress" | "pending">("all")
  const list = partner.tasks.filter((t) => filter === "all" || t.status === filter)
  const filters: { k: typeof filter; l: string; n: number }[] = [
    { k: "all", l: "Barchasi", n: counts.total },
    { k: "done", l: "Bajarilgan", n: counts.done },
    { k: "progress", l: "Jarayonda", n: counts.progress },
    { k: "pending", l: "Kutilayotgan", n: counts.pending },
  ]
  return (
    <div className={`mt-6 ${card}`}>
      <h3 className="font-display text-lg font-bold">Loyiha ishlari</h3>
      <p className="mt-1 text-sm text-muted">Kompaniyangiz uchun rejalashtirilgan ishlar va ularning holati.</p>
      <div className="mt-4"><ProgressBar done={counts.done} total={counts.total} /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${filter === f.k ? "bg-green text-white" : "border border-green/20 text-muted hover:border-green"}`}>
            {f.l} ({f.n})
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {list.length === 0 && <p className="py-6 text-center text-sm text-muted">Bu bo'limda ish yo'q.</p>}
        {list.map((t) => <TaskRow key={t.id} t={t} />)}
      </div>
    </div>
  )
}

/* ---------- Statistika ---------- */
function Statistics({ counts, pct, partner }: { counts: { total: number; done: number; progress: number; pending: number }; pct: number; partner: Partner }) {
  const bars = [
    { l: "Bajarilgan", v: counts.done, c: "from-green/40 to-green" },
    { l: "Jarayonda", v: counts.progress, c: "from-orange-200 to-orange-500" },
    { l: "Kutilayotgan", v: counts.pending, c: "from-slate-200 to-slate-400" },
  ]
  const max = Math.max(1, counts.total)
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Bajarilish darajasi", `${pct}%`, I.target], ["Jami ishlar", String(counts.total), I.task], ["Shartnoma summasi", `${fmtSom(partner.amount)}`, I.wallet]].map(([t, v, ic]) => (
          <div key={t} className={card}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green"><Icon d={ic} className="h-5 w-5" /></span>
            <div className="mt-3 text-xs text-muted">{t}</div>
            <div className="mt-1 font-display text-2xl font-extrabold truncate">{v}</div>
          </div>
        ))}
      </div>
      <div className={card}>
        <h3 className="font-display text-lg font-bold">Ishlar taqsimoti</h3>
        <div className="mt-6 flex items-end gap-6" style={{ height: "180px" }}>
          {bars.map((b) => (
            <div key={b.l} className="flex flex-1 flex-col items-center justify-end h-full">
              <div className="mb-1.5 font-display text-sm font-bold">{b.v}</div>
              <div className={`w-full rounded-t-xl bg-gradient-to-t ${b.c} transition-all duration-500`} style={{ height: `${Math.round((b.v / max) * 140)}px` }} />
              <div className="mt-2 text-[11px] text-muted text-center">{b.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- Blogerlar ---------- */
function BloggersBrowse() {
  const [bloggers, setBloggers] = useState<Blogger[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api<{ bloggers: Blogger[] }>("/public/bloggers?limit=24").then((d) => setBloggers(d.bloggers || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  return (
    <div className={`mt-6 ${card}`}>
      <h3 className="font-display text-lg font-bold">Platforma blogerlari</h3>
      <p className="mt-1 text-sm text-muted">Hamkorlik uchun blogerlarni ko'rib chiqing.</p>
      {loading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-soft" />)}</div>
      ) : bloggers.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Bloger topilmadi.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bloggers.map((b) => (
            <a key={b.slug} href={`/blogerlar/${b.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-green/10 bg-[#fafdf7] p-3 transition-colors hover:border-green/30">
              {b.avatar ? <img src={b.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-green/10 text-green font-bold">{b.name[0]}</span>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{b.name}</div>
                <div className="truncate text-[11px] text-muted">{b.cat} • {b.region}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-green">{b.subs}</div>
                <div className="text-[10px] text-muted">obuna</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Bildirishnomalar ---------- */
function Notifications({ notifs }: { notifs: Notif[] }) {
  return (
    <div className={`mt-6 ${card}`}>
      <h3 className="font-display text-lg font-bold">Bildirishnomalar</h3>
      <div className="mt-4 space-y-2">
        {notifs.length === 0 && <p className="py-6 text-center text-sm text-muted">Bildirishnoma yo'q.</p>}
        {notifs.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 rounded-lg border border-green/8 px-3 py-3 ${n.is_read ? "bg-white" : "bg-green/5"}`}>
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-soft text-green"><Icon d={I.bell} className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{n.title}</div>
              {n.body && <div className="mt-0.5 text-xs text-muted">{n.body}</div>}
              <div className="mt-1 text-[10px] text-muted">{(n.created_at || "").split("T")[0]}</div>
            </div>
            {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green" />}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Hisobot ---------- */
function Report({ partner, counts, pct, extra }: { partner: Partner; counts: { total: number; done: number; progress: number; pending: number }; pct: number; extra: CompanyExtra }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">Hamkorlik hisoboti</h3>
          <p className="mt-1 text-sm text-muted">Kompaniyangiz bo'yicha umumiy hisobot. Chop etish yoki PDF sifatida saqlash mumkin.</p>
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
        {extra.description && <div className="mt-4 rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">Kompaniya haqida</div><div className="mt-1 text-sm">{extra.description}</div></div>}
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
      <h3 className="font-display text-lg font-bold">Parolni o'zgartirish</h3>
      <p className="mt-1 text-sm text-muted">Hisobingiz uchun yangi parol o'rnating.</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted">Yangi parol</label>
          <input value={pwd} onChange={(e) => setPwd(e.target.value)} type="password" placeholder="Kamida 6 belgi" className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted">Parolni tasdiqlang</label>
          <input value={pwd2} onChange={(e) => setPwd2(e.target.value)} type="password" placeholder="Yangi parolni qayta kiriting" className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
        </div>
        {msg && <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? "bg-green/10 text-green" : "bg-red-50 text-red-600"}`}>{msg.text}</div>}
        <button onClick={changePwd} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60">
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon d={I.lock} className="h-4 w-4" />} O'zgartirish
        </button>
      </div>
    </div>
  )
}
