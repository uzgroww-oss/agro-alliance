import { useEffect, useMemo, useState, Fragment } from "react"
import { Link, useNavigate } from "react-router-dom"
import DashboardLayout, { LineChart } from "../../components/DashboardLayout"
import { Icon, I, statIcon, type StatItem, fmtSom, SkeletonTable, SkeletonStatGrid, SkeletonCard, Skeleton, useBusy } from "../../lib/ui"
import MediaUpload from "../../components/MediaUpload"
import { categories } from "../../lib/bloggers"
import { api } from "../../lib/api"
import { useAuth } from "../../lib/auth"

const nav = [
  { label: "Dashboard", icon: I.dashboard },
  { label: "Bloggerlar", icon: I.users },
  { label: "Topshiriqlar", icon: I.task },
  { label: "Hamkorlar", icon: I.handshake },
  { label: "Yangiliklar", icon: I.doc },
  { label: "Kategoriyalar", icon: I.grid },
  { label: "Rollar", icon: I.shield },
  { label: "Bosh sahifa", icon: I.dashboard },
  { label: "Manbalar", icon: I.globe },
  { label: "Foydalanuvchilar", icon: I.users },
  { label: "Xabarlar", icon: I.doc },
  { label: "Obunachilar", icon: I.users },
  { label: "Statistika", icon: I.chart },
  { label: "Jamoa", icon: I.users },
  { label: "Sozlamalar", icon: I.gear },
  { label: "Monitoring", icon: I.chart },
]

const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"
const catLabel = (k: string) => categories.find((c) => c.key === k)?.label ?? k

const VILOYATLAR = [
  "Qoraqalpog'iston Respublikasi",
  "Andijon viloyati",
  "Buxoro viloyati",
  "Farg'ona viloyati",
  "Jizzax viloyati",
  "Namangan viloyati",
  "Navoiy viloyati",
  "Qashqadaryo viloyati",
  "Samarqand viloyati",
  "Sirdaryo viloyati",
  "Surxondaryo viloyati",
  "Toshkent viloyati",
  "Toshkent shahri",
  "Xorazm viloyati",
]

type Row = { id: number; name: string; cat: string; region: string; email: string; status: string; slug: string }

/* ---------- Blogger management ---------- */
function Bloggers() {
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const [registering, setRegistering] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const blank = { name: "", email: "", cat: "fermerlik", region: "", password: "" }
  const [form, setForm] = useState(blank)

  // Ilgari loading holati umuman yo'q edi: har ochilganda jadval
  // "Bloger yo'q" degan YOLG'ON bo'sh-holatni ko'rsatardi.
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const reload = (silent = false) => {
    if (!silent) setLoading(true)
    setFailed(false)
    return api<{ bloggers: Row[] }>("/bloggers")
      .then((d) => setRows(d.bloggers))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [])

  const list = useMemo(
    () => rows.filter((r) => !query.trim() || r.name.toLowerCase().includes(query.toLowerCase()) || r.email.toLowerCase().includes(query.toLowerCase())),
    [rows, query],
  )

  const [createdBlogger, setCreatedBlogger] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [socialLink, setSocialLink] = useState("")
  const [addingSocial, setAddingSocial] = useState(false)
  const [socialResults, setSocialResults] = useState<Array<{ url: string; platform: string; name: string; subscribers: number; views: number; engagement: number; error?: string }>>([])

  const register = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setRegistering(true)
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { setError("Ism, email va parol majburiy"); setRegistering(false); return }
    if (!form.region) { setError("Viloyatni tanlang"); setRegistering(false); return }
    try {
      const res = await api<{ success: boolean; blogger: { id: string; slug: string; name: string } }>("/bloggers", { method: "POST", body: JSON.stringify({ name: form.name, email: form.email, password: form.password, region: form.region, niche: form.cat }) })
      setForm(blank); setAdding(false)
      setCreatedBlogger({ id: res.blogger.id, name: res.blogger.name, slug: res.blogger.slug })
      setSocialResults([]); setSocialLink("")
      reload()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Xatolik") }
    finally { setRegistering(false) }
  }

  const addSocialLink = async () => {
    if (!socialLink.trim() || !createdBlogger) return
    setAddingSocial(true)
    try {
      const res = await api<{ success: boolean; results: Array<{ url: string; platform: string; name: string; subscribers: number; views: number; engagement: number; error?: string }> }>(`/bloggers/${createdBlogger.id}/social`, { method: "POST", body: JSON.stringify({ links: [socialLink.trim()] }) })
      setSocialResults((prev) => [...res.results, ...prev])
      setSocialLink("")
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Xatolik") }
    finally { setAddingSocial(false) }
  }
  // Mutatsiyalar `silent` reload ishlatadi: butun jadval skeletonga aylanmasin.
  const [mutating, runMutation] = useBusy()
  const remove = (id: number) => runMutation(async () => {
    setRows((prev) => prev.filter((r) => r.id !== id))
    setDeleteTarget(null)
    await api(`/bloggers/${id}`, { method: "DELETE" }).catch(() => {})
    await reload(true)
  })
  const toggle = (r: Row) => runMutation(async () => {
    await api(`/bloggers/${r.id}/status`, { method: "PATCH", body: JSON.stringify({ status: r.status === "active" ? "pending" : "active" }) })
    await reload(true)
  })
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIds.size === list.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(list.map((r) => r.id)))
  }
  const bulkRemove = () => runMutation(async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)))
    setSelectedIds(new Set())
    await Promise.allSettled(ids.map((id) => api(`/bloggers/${id}`, { method: "DELETE" })))
    await reload(true)
  })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Bloggerlarni boshqarish</h2>
          <p className="mt-1 text-sm text-muted">Bloggerlar faqat admin tomonidan ro'yxatdan o'tkaziladi.</p>
        </div>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105">
          <Icon d={I.plus} className="h-4 w-4" /> Yangi bloger qo'shish
        </button>
      </div>

      {/* Add Blogger Modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => { setAdding(false); setError(""); setForm(blank) }}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-extrabold">Yangi bloger qo'shish</h3>
            <form onSubmit={register} className="mt-5 space-y-4">
              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>}
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Bloger ismi" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" required />
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" required />
              <select value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" required>
                <option value="" disabled>Viloyatni tanlang (bloger qayerdan)</option>
                {VILOYATLAR.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={form.cat} onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))} className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green">
                {categories.filter((c) => c.key !== "all").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Boshlang'ich parol" type="password" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" required />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setAdding(false); setError(""); setForm(blank) }} className="rounded-xl border-2 border-green/30 px-6 py-2.5 text-sm font-bold text-ink transition-colors hover:border-green hover:text-green">Bekor qilish</button>
                <button type="submit" disabled={registering} className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105 disabled:opacity-60">
                  {registering && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {registering ? "Ro'yxatdan o'tkazilmoqda…" : "Ro'yxatdan o'tkazish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Social Links Section (shown after creating a blogger) */}
      {createdBlogger && (
        <div className="mt-5 rounded-2xl border border-green/15 bg-soft p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-extrabold text-green">Bloger yaratildi: {createdBlogger.name}</h3>
              <p className="mt-0.5 text-xs text-muted">Endi ijtimoiy tarmoq linklarini qo'shing</p>
            </div>
            <button onClick={() => { setCreatedBlogger(null); setSocialResults([]) }} className="rounded-lg border border-green/30 px-3 py-1.5 text-xs font-bold text-green hover:bg-green hover:text-white">Yopish</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input value={socialLink} onChange={(e) => setSocialLink(e.target.value)} placeholder="Ijtimoiy tarmoq linki — YouTube, Instagram, Telegram..." className="flex-1 min-w-[200px] rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <button onClick={addSocialLink} disabled={addingSocial || !socialLink.trim()} className="inline-flex items-center gap-2 rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white shadow transition-transform hover:scale-105 disabled:opacity-60">
              {addingSocial && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              {addingSocial ? "Olinmoqda…" : "Qo'shish"}
            </button>
          </div>
          {socialResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {socialResults.map((sr, i) => (
                <div key={i} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm ${sr.error ? "border-red-200 bg-red-50" : "border-green/15 bg-white"}`}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-green/10 font-bold text-green">{sr.platform.slice(0, 2)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{sr.name || sr.platform}</span>
                    <span className="block text-xs text-muted truncate">{sr.url}</span>
                  </span>
                  {sr.error ? (
                    <span className="text-xs text-red-500">{sr.error}</span>
                  ) : (
                    <span className="flex flex-wrap gap-3 text-xs">
                      <span className="font-semibold text-green">{sr.subscribers.toLocaleString()} obunachi</span>
                      <span className="text-muted">{sr.views.toLocaleString()} ko'rish</span>
                      {sr.engagement > 0 && <span className="text-muted">{sr.engagement}% engagement</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-sm font-semibold text-red-700">{selectedIds.size} ta blogger tanlandi</span>
            <button onClick={bulkRemove} disabled={mutating} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white shadow transition-transform hover:scale-105 disabled:opacity-60">
              <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /> Tanlanganlarni o'chirish
            </button>
          </div>
        )}
        <div className="relative mb-4 max-w-sm">
          <Icon d={I.search} className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Bloger qidirish..." className="w-full rounded-xl border border-green/15 bg-[#f7faf4] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-green" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="pb-3 font-semibold w-10">
                  <input type="checkbox" checked={list.length > 0 && selectedIds.size === list.length} onChange={toggleAll} className="h-4 w-4 rounded border-green/30 text-green accent-green" />
                </th>
                <th className="pb-3 font-semibold">Bloger</th>
                <th className="pb-3 font-semibold">Yo'nalish</th>
                <th className="pb-3 font-semibold">Hudud</th>
                <th className="pb-3 font-semibold">Holati</th>
                <th className="pb-3 font-semibold">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="py-6"><SkeletonTable rows={5} cols={5} /></td></tr>
              )}
              {!loading && failed && (
                <tr><td colSpan={7} className="py-10 text-center text-red-600">Blogerlar ro'yxatini yuklab bo'lmadi. <button onClick={() => reload()} className="font-bold text-green hover:underline">Qayta urinish</button></td></tr>
              )}
              {!loading && !failed && list.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-muted">Bloger yo'q. "Yangi bloger qo'shish" orqali qo'shing.</td></tr>
              )}
              {!loading && !failed && list.map((r) => (
                <tr key={r.id} className="border-t border-green/8 text-sm">
                  <td className="py-3 pr-3 w-10">
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="h-4 w-4 rounded border-green/30 text-green accent-green" />
                  </td>
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green/10 font-display text-xs font-bold text-green">{r.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                      <span><span className="block font-semibold">{r.name}</span><span className="block text-xs text-muted">{r.email}</span></span>
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-muted">{catLabel(r.cat)}</td>
                  <td className="py-3 pr-3 text-muted">{r.region || "—"}</td>
                  <td className="py-3 pr-3">
                    <button onClick={() => toggle(r)} disabled={mutating} title="Holatni o'zgartirish" className="disabled:opacity-50">
                      {r.status === "active"
                        ? <span className="inline-flex items-center gap-1 rounded-md bg-green/10 px-2 py-1 text-[11px] font-bold text-green"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Faol</span>
                        : <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-600"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Kutilmoqda</span>}
                    </button>
                  </td>
                  <td className="py-3">
                    <span className="flex gap-1.5">
                      <Link to={`/bloger/${r.slug}`} target="_blank" className="grid h-8 w-8 place-items-center rounded-lg border border-green/15 text-muted hover:text-green" title="Profilni ko'rish"><Icon d={I.external} className="h-4 w-4" /></Link>
                      <button onClick={() => setDeleteTarget(r.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500" title="O'chirish"><Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /></button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-red-50">
                <Icon d="M12 9v4 M12 17h.01 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" className="h-7 w-7 text-red-500" />
              </span>
              <h3 className="mt-4 font-display text-lg font-extrabold">Blogerni o'chirish</h3>
              <p className="mt-2 text-sm text-muted">Bu blogerni ro'yxatdan o'chirishni tasdiqlaysizmi?</p>
            </div>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border-2 border-green/30 px-6 py-2.5 text-sm font-bold text-ink transition-colors hover:border-green hover:text-green">Bekor qilish</button>
              <button type="button" onClick={() => remove(deleteTarget)} disabled={mutating} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/30 transition-transform hover:scale-105 disabled:opacity-60">
                <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" className="h-4 w-4" /> {mutating ? "O'chirilmoqda…" : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Partners (hamkorlar) management ---------- */
type Task = { id: number; title: string; status: "done" | "progress" | "pending" }
type PartnerClient = { id: number; name: string; email: string }
type Partner = { id: number; name: string; sphere: string; logo?: string | null; contractNo: string; amount: number | null; signedDate: string; status: string; tasks: Task[]; client: PartnerClient | null }

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

function AdminPartners() {
  const [list, setList] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [taskDrafts, setTaskDrafts] = useState<Record<number, string>>({})
  const [clientDrafts, setClientDrafts] = useState<Record<number, { email: string; password: string }>>({})
  const [openClient, setOpenClient] = useState<Record<number, boolean>>({})
  const [clientErr, setClientErr] = useState<Record<number, string>>({})
  const blank = { name: "", sphere: "", contractNo: "", amount: "", status: "active", logo: "", clientEmail: "", clientPassword: "" }
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  // silent=true -> mutatsiyadan keyingi qayta yuklash. Ilgari har vazifa
  // qo'shish/o'chirishda butun hamkorlar ro'yxati skeletonga aylanib ketardi.
  const reload = (silent = false) => {
    if (!silent) setLoading(true)
    return api<{ partners: Partner[] }>("/partners").then((d) => setList(d.partners)).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [])
  // Vazifa/mijoz amallari uchun umumiy pending: ikki marta bosish yoki
  // Enter'ni bosib turish dublikat yozuv yaratardi.
  const [mutating, runMutation] = useBusy()

  const totals = useMemo(() => {
    const sum = list.reduce((s, p) => s + (p.amount || 0), 0)
    const allTasks = list.flatMap((p) => p.tasks)
    const done = allTasks.filter((t) => t.status === "done").length
    return {
      count: list.length,
      sum,
      active: list.filter((p) => p.status === "active").length,
      progressPct: allTasks.length ? Math.round((done / allTasks.length) * 100) : 0,
    }
  }, [list])

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true)
    if (!form.name.trim() || !form.contractNo.trim()) { setError("Tashkilot nomi va shartnoma raqami majburiy"); setSaving(false); return }
    try {
      await api("/partners", { method: "POST", body: JSON.stringify({
        name: form.name,
        sphere: form.sphere,
        contractNo: form.contractNo,
        amount: Number(form.amount) || 0,
        status: form.status,
        logo: form.logo.trim() || undefined,
        clientName: form.name,
        clientEmail: form.clientEmail.trim() || undefined,
        clientPassword: form.clientPassword.trim() || undefined,
      })})
      setForm(blank); setAdding(false); await reload(true)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Xatolik") }
    finally { setSaving(false) }
  }
  // --- Mavjud hamkorni tahrirlash ---
  const [editTarget, setEditTarget] = useState<Partner | null>(null)
  const [editForm, setEditForm] = useState({ name: "", sphere: "", contractNo: "", amount: "", status: "active", logo: "" })
  const [editErr, setEditErr] = useState("")
  const startEdit = (p: Partner) => {
    setEditErr("")
    setEditTarget(p)
    setEditForm({
      name: p.name || "",
      sphere: p.sphere || "",
      contractNo: p.contractNo || "",
      amount: p.amount == null ? "" : String(p.amount),
      status: p.status || "active",
      logo: p.logo || "",
    })
  }
  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setEditErr("")
    if (!editForm.name.trim()) { setEditErr("Tashkilot nomi majburiy"); return }
    return runMutation(async () => {
      try {
        await api(`/partners/${editTarget.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: editForm.name.trim(),
            sphere: editForm.sphere,
            contractNo: editForm.contractNo,
            amount: editForm.amount,
            status: editForm.status,
            logo: editForm.logo,
          }),
        })
        setEditTarget(null)
        await reload(true)
      } catch (err: unknown) {
        setEditErr(err instanceof Error ? err.message : "Saqlashda xatolik")
      }
    })
  }

  const remove = (id: number) => {
    setList((prev) => prev.filter((p) => p.id !== id))
    setDeleteTarget(null)
    api(`/partners/${id}`, { method: "DELETE" }).catch(() => {}).then(() => reload(true))
  }
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIds.size === list.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(list.map((p) => p.id)))
  }
  const bulkRemove = () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    setList((prev) => prev.filter((p) => !ids.includes(p.id)))
    setSelectedIds(new Set())
    Promise.allSettled(ids.map((id) => api(`/partners/${id}`, { method: "DELETE" }))).then(() => reload(true))
  }
  const cycleTask = (pid: number, tid: number) => runMutation(async () => { await api(`/partners/${pid}/tasks/${tid}`, { method: "PATCH", body: "{}" }); await reload(true) })
  const removeTask = (pid: number, tid: number) => runMutation(async () => { await api(`/partners/${pid}/tasks/${tid}`, { method: "DELETE" }); await reload(true) })
  const addTask = (pid: number) => runMutation(async () => {
    const title = (taskDrafts[pid] || "").trim(); if (!title) return
    await api(`/partners/${pid}/tasks`, { method: "POST", body: JSON.stringify({ title }) })
    setTaskDrafts((d) => ({ ...d, [pid]: "" })); await reload(true)
  })
  const createClient = (p: Partner) => {
    const draft = clientDrafts[p.id] || { email: "", password: "" }
    if (!draft.email.trim() || !draft.password.trim()) { setClientErr((e) => ({ ...e, [p.id]: "Email va parol majburiy" })); return }
    return runMutation(async () => {
      try {
        await api(`/partners/${p.id}/client`, { method: "POST", body: JSON.stringify({ name: p.name, email: draft.email, password: draft.password }) })
        setClientDrafts((d) => ({ ...d, [p.id]: { email: "", password: "" } }))
        setClientErr((e) => ({ ...e, [p.id]: "" })); setOpenClient((o) => ({ ...o, [p.id]: false })); await reload(true)
      } catch (err: unknown) {
        setClientErr((e) => ({ ...e, [p.id]: err instanceof Error ? err.message : "Xatolik" }))
      }
    })
  }
  const removeClient = (pid: number) => {
    if (!confirm("Hamkor loginini o'chirishni tasdiqlaysizmi?")) return
    return runMutation(async () => { await api(`/partners/${pid}/client`, { method: "DELETE" }); await reload(true) })
  }

  const stats = [
    { icon: I.handshake, t: "Jami hamkorlar", v: String(totals.count) },
    { icon: I.wallet, t: "Umumiy shartnoma", v: fmtSom(totals.sum) + " so'm" },
    { icon: I.shield, t: "Faol shartnomalar", v: String(totals.active) },
    { icon: I.chart, t: "Vazifalar bajarilishi", v: totals.progressPct + "%" },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Hamkorlarni boshqarish</h2>
          <p className="mt-1 text-sm text-muted">Hamkor tashkilotlar, shartnomalar va rejadagi ishlar.</p>
        </div>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105">
          <Icon d={I.plus} className="h-4 w-4" /> Yangi hamkor qo'shish
        </button>
      </div>

      {/* stat cards */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.t} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green"><Icon d={s.icon} className="h-5 w-5" /></span>
            <div className="mt-3 text-xs text-muted">{s.t}</div>
            <div className="mt-1 font-display text-xl font-extrabold">{s.v}</div>
          </div>
        ))}
      </div>

      {/* Add Partner Modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => { setAdding(false); setError(""); setForm(blank) }}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-extrabold">Yangi hamkor qo'shish</h3>
            <form onSubmit={add} className="mt-5 space-y-4">
              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>}
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tashkilot nomi" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" required />
              <input value={form.sphere} onChange={(e) => setForm((f) => ({ ...f, sphere: e.target.value }))} placeholder="Yo'nalish (masalan: O'g'itlar)" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
              {/* Logo: URL yozish YOKI rasm yuklash — ikkalasi ham bitta
                  `form.logo` maydoniga yozadi, shuning uchun backend o'zgarmadi. */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted">Logo (ixtiyoriy)</label>
                <input value={form.logo} onChange={(e) => setForm((f) => ({ ...f, logo: e.target.value }))} placeholder="Rasm havolasi (URL)" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs text-muted">yoki</span>
                  <MediaUpload accept="image/*" onUpload={(r) => setForm((f) => ({ ...f, logo: r.signedUrl }))} />
                </div>
                {form.logo.trim() && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-green/10 bg-soft p-3">
                    <img src={form.logo.trim()} alt="" className="max-h-12 max-w-[120px] object-contain" />
                    <button type="button" onClick={() => setForm((f) => ({ ...f, logo: "" }))} className="ml-auto text-xs font-bold text-red-500 hover:underline">
                      Olib tashlash
                    </button>
                  </div>
                )}
              </div>
              <input value={form.contractNo} onChange={(e) => setForm((f) => ({ ...f, contractNo: e.target.value }))} placeholder="Shartnoma raqami" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" required />
              <input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Summa (so'm)" type="number" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green">
                <option value="active">Faol</option>
                <option value="pending">Kutilmoqda</option>
                <option value="completed">Yakunlangan</option>
              </select>
              <hr className="border-green/10" />
              <p className="text-xs font-semibold text-muted">Hamkor kompaniya logini (ixtiyoriy — email + parol)</p>
              <input value={form.clientEmail} onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))} placeholder="Email (login)" type="email" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
              <input value={form.clientPassword} onChange={(e) => setForm((f) => ({ ...f, clientPassword: e.target.value }))} placeholder="Parol (kamida 6 belgi)" type="password" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setAdding(false); setError(""); setForm(blank) }} className="rounded-xl border-2 border-green/30 px-6 py-2.5 text-sm font-bold text-ink transition-colors hover:border-green hover:text-green">Bekor qilish</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105 disabled:opacity-60">
                  {saving && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {saving ? "Qo'shilmoqda…" : "Qo'shish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* partner cards */}
      <div className="mt-5 space-y-4">
        {!loading && selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-sm font-semibold text-red-700">{selectedIds.size} ta hamkor tanlandi</span>
            <button onClick={bulkRemove} disabled={mutating} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white shadow transition-transform hover:scale-105 disabled:opacity-60">
              <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /> Tanlanganlarni o'chirish
            </button>
          </div>
        )}
        {loading && <SkeletonStatGrid />}
        {!loading && list.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={selectedIds.size === list.length} onChange={toggleAll} className="h-4 w-4 rounded border-green/30 text-green accent-green" />
            Hammasini tanlash
          </label>
        )}
        {!loading && list.length === 0 && <div className="rounded-2xl border border-green/10 bg-white py-12 text-center text-muted">Hamkor yo'q. "Yangi hamkor qo'shish" orqali qo'shing.</div>}
        {list.map((p) => {
          const ps = partnerStatusMeta[p.status] || partnerStatusMeta.active
          const done = p.tasks.filter((t) => t.status === "done").length
          const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0
          return (
            <div key={p.id} className={`min-w-0 rounded-2xl border bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)] ${selectedIds.has(p.id) ? "border-red-300 ring-2 ring-red-200" : "border-green/10"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="h-5 w-5 shrink-0 rounded border-green/30 text-green accent-green" />
                  {p.logo
                    ? <img src={p.logo} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-green/10 bg-white object-contain p-1" />
                    : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-soft text-green"><Icon d={I.building} className="h-6 w-6" /></span>}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold">{p.name}</h3>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${ps.cls}`}>{ps.label}</span>
                    </div>
                    <p className="text-sm text-muted">{p.sphere}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(p)} className="grid h-9 w-9 place-items-center rounded-lg border border-green/20 text-muted hover:border-green hover:text-green" title="Tahrirlash">
                    <Icon d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(p.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500" title="O'chirish">
                    <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* contract row */}
              <div className="mt-4 grid gap-3 rounded-xl bg-[#fafdf7] p-4 sm:grid-cols-3">
                <div><div className="text-xs text-muted">Shartnoma raqami</div><div className="mt-0.5 font-display font-bold">{p.contractNo}</div></div>
                <div><div className="text-xs text-muted">Summa</div><div className="mt-0.5 font-display font-bold text-green">{fmtSom(p.amount)} so'm</div></div>
                <div><div className="text-xs text-muted">Imzolangan sana</div><div className="mt-0.5 font-display font-bold">{p.signedDate}</div></div>
              </div>

              {/* tasks */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Rejadagi ishlar <span className="text-muted">({done}/{p.tasks.length})</span></span>
                  <span className="text-xs font-bold text-green">{pct}%</span>
                </div>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-green transition-all" style={{ width: `${pct}%` }} /></div>
                <div className="space-y-2">
                  {p.tasks.map((t) => {
                    const tm = taskMeta[t.status]
                    return (
                      <div key={t.id} className="flex items-center gap-3 rounded-lg border border-green/8 bg-white px-3 py-2">
                        <button onClick={() => cycleTask(p.id, t.id)} disabled={mutating} title="Holatni o'zgartirish" className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold ${tm.cls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tm.dot}`} /> {tm.label}
                        </button>
                        <span className={`flex-1 text-sm ${t.status === "done" ? "text-muted line-through" : ""}`}>{t.title}</span>
                        <button onClick={() => removeTask(p.id, t.id)} disabled={mutating} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-40"><Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" /></button>
                      </div>
                    )
                  })}
                </div>
                {/* add task */}
                <div className="mt-2 flex gap-2">
                  <input value={taskDrafts[p.id] || ""} onChange={(e) => setTaskDrafts((d) => ({ ...d, [p.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" && !mutating) addTask(p.id) }} placeholder="Yangi vazifa qo'shish..." className="flex-1 rounded-lg border border-green/15 bg-white px-3 py-2 text-sm outline-none focus:border-green" />
                  <button onClick={() => addTask(p.id)} disabled={mutating} className="inline-flex items-center gap-1.5 rounded-lg border border-green/20 px-3 py-2 text-xs font-bold text-green hover:bg-green hover:text-white disabled:opacity-50"><Icon d={I.plus} className="h-4 w-4" /> Vazifa</button>
                </div>
              </div>

              {/* hamkor kompaniya login */}
              <div className="mt-4 rounded-xl border border-green/15 bg-[#fafdf7] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-green/10 text-green"><Icon d={I.building} className="h-5 w-5" /></span>
                    <div>
                      <div className="text-sm font-bold">Hamkor kabineti (login)</div>
                      <div className="text-xs text-muted">{p.client ? "Hamkor o'z kabinetiga kira oladi" : "Login yarating — hamkor o'z kabinetiga kiradi"}</div>
                    </div>
                  </div>
                  {p.client ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-green/10 px-2.5 py-1 text-xs font-bold text-green"><Icon d={I.check} className="h-3.5 w-3.5" /> {p.client.email}</span>
                      <button onClick={() => removeClient(p.id)} disabled={mutating} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40" title="Loginni o'chirish"><Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => setOpenClient((o) => ({ ...o, [p.id]: !o[p.id] }))} className="inline-flex items-center gap-1.5 rounded-lg border border-green/25 px-3 py-2 text-xs font-bold text-green hover:bg-green hover:text-white">
                      <Icon d={I.plus} className="h-4 w-4" /> Login yaratish
                    </button>
                  )}
                </div>
                {!p.client && openClient[p.id] && (
                  <div className="mt-3">
                    {clientErr[p.id] && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{clientErr[p.id]}</div>}
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input value={clientDrafts[p.id]?.email || ""} onChange={(e) => setClientDrafts((d) => ({ ...d, [p.id]: { ...(d[p.id] || { email: "", password: "" }), email: e.target.value } }))} placeholder="Hamkor emaili" type="email" className="rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green" />
                      <input value={clientDrafts[p.id]?.password || ""} onChange={(e) => setClientDrafts((d) => ({ ...d, [p.id]: { ...(d[p.id] || { email: "", password: "" }), password: e.target.value } }))} placeholder="Boshlang'ich parol" type="password" className="rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green" />
                      <button onClick={() => createClient(p)} disabled={mutating} className="rounded-lg bg-green px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{mutating ? "..." : "Yaratish"}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tahrirlash modali */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setEditTarget(null)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-extrabold">Hamkorni tahrirlash</h3>
            <form onSubmit={saveEdit} className="mt-5 space-y-4">
              {editErr && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{editErr}</div>}
              <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tashkilot nomi" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" required />
              <input value={editForm.sphere} onChange={(e) => setEditForm((f) => ({ ...f, sphere: e.target.value }))} placeholder="Yo'nalish (masalan: O'g'itlar)" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />

              {/* Logo: URL yozish yoki rasm yuklash — qo'shish formasi bilan bir xil */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted">Logo</label>
                <input value={editForm.logo} onChange={(e) => setEditForm((f) => ({ ...f, logo: e.target.value }))} placeholder="Rasm havolasi (URL)" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs text-muted">yoki</span>
                  <MediaUpload accept="image/*" onUpload={(r) => setEditForm((f) => ({ ...f, logo: r.signedUrl }))} />
                </div>
                {editForm.logo.trim() && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-green/10 bg-soft p-3">
                    <img src={editForm.logo.trim()} alt="" className="max-h-12 max-w-[120px] object-contain" />
                    <button type="button" onClick={() => setEditForm((f) => ({ ...f, logo: "" }))} className="ml-auto text-xs font-bold text-red-500 hover:underline">
                      Olib tashlash
                    </button>
                  </div>
                )}
              </div>

              <input value={editForm.contractNo} onChange={(e) => setEditForm((f) => ({ ...f, contractNo: e.target.value }))} placeholder="Shartnoma raqami" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
              <input value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Summa (so'm)" type="number" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
              <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green">
                <option value="active">Faol</option>
                <option value="pending">Kutilmoqda</option>
                <option value="completed">Yakunlangan</option>
              </select>

              <p className="text-xs text-muted">Hamkor logini (email/parol) bu yerdan o'zgartirilmaydi — buning uchun kartadagi alohida bo'lim bor.</p>

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setEditTarget(null)} className="rounded-xl border-2 border-green/30 px-5 py-2.5 text-sm font-bold transition-colors hover:border-green hover:text-green">Bekor qilish</button>
                <button type="submit" disabled={mutating} className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105 disabled:opacity-60">
                  <Icon d={I.check} className="h-4 w-4" /> {mutating ? "Saqlanmoqda…" : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-red-50">
                <Icon d="M12 9v4 M12 17h.01 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" className="h-7 w-7 text-red-500" />
              </span>
              <h3 className="mt-4 font-display text-lg font-extrabold">Hamkorni o'chirish</h3>
              <p className="mt-2 text-sm text-muted">Bu hamkorni ro'yxatdan o'chirishni tasdiqlaysizmi?</p>
            </div>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border-2 border-green/30 px-6 py-2.5 text-sm font-bold text-ink transition-colors hover:border-green hover:text-green">Bekor qilish</button>
              <button type="button" onClick={() => remove(deleteTarget)} disabled={mutating} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/30 transition-transform hover:scale-105 disabled:opacity-60">
                <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" className="h-4 w-4" /> O'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Overview() {
  const [bloggerCount, setBloggerCount] = useState<number | null>(null)
  const [partnerCount, setPartnerCount] = useState<number | null>(null)
  const [newsCount, setNewsCount] = useState<number | null>(null)
  const [subscribers, setSubscribers] = useState<number | null>(null)
  const [recentNews, setRecentNews] = useState<{ title: string; created_at: string }[]>([])
  // Ilgari yuklanayotganda "Yangiliklar yo'q" ko'rinardi (stat kartalar "…"
  // ko'rsatgani holda) — shu ro'yxat yagona istisno edi.
  const [newsLoading, setNewsLoading] = useState(true)

  useEffect(() => {
    api<{ bloggers: unknown[] }>("/bloggers").then((d) => setBloggerCount(d.bloggers.length)).catch(() => {})
    api<{ partners: unknown[] }>("/partners").then((d) => setPartnerCount(d.partners.length)).catch(() => {})
    api<{ pagination: { total: number } }>("/news?per_page=1").then((d) => setNewsCount(d.pagination?.total || 0)).catch(() => {})
    api<{ subscribers: unknown[] }>("/subscribers").then((d) => setSubscribers(d.subscribers.length)).catch(() => {})
    api<{ news: { title: string; created_at: string }[] }>("/news?per_page=4")
      .then((d) => setRecentNews(d.news || []))
      .catch(() => {})
      .finally(() => setNewsLoading(false))
  }, [])

  const stats = [
    { icon: I.users, t: "Jami bloggerlar", v: bloggerCount === null ? "…" : String(bloggerCount), delta: "real-time" },
    { icon: I.handshake, t: "Hamkorlar", v: partnerCount === null ? "…" : String(partnerCount), delta: "real-time" },
    { icon: I.doc, t: "Yangiliklar", v: newsCount === null ? "…" : String(newsCount), delta: "real-time" },
    { icon: I.send, t: "Obunachilar", v: subscribers === null ? "…" : String(subscribers), delta: "real-time" },
  ]
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Admin Panel</h1>
      <p className="mt-1 text-sm text-muted">Platformaning to'liq boshqaruvi.</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.t} className={card.replace("p-6", "p-5")}>
            <div className="flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-soft text-green"><Icon d={s.icon} className="h-5 w-5" /></span>
              <span className="rounded-md bg-green/10 px-2 py-1 text-[11px] font-bold text-green">{s.delta}</span>
            </div>
            <div className="mt-3 text-xs text-muted">{s.t}</div>
            <div className="mt-1 font-display text-2xl font-extrabold">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className={card}>
          <h3 className="font-display text-lg font-bold">Platforma o'sishi</h3>
          <div className="mt-4">
              {bloggerCount !== null || partnerCount !== null || newsCount !== null ? (
              <LineChart
                points={[bloggerCount || 0, partnerCount || 0, newsCount || 0, (bloggerCount || 0) + (partnerCount || 0), (bloggerCount || 0) + (newsCount || 0), (partnerCount || 0) + (newsCount || 0)]}
                labels={["Blogerlar", "Hamkorlar", "Yangiliklar", "Blog+Hamkor", "Blog+Yangilik", "Hamk+Yangilik"]}
              />
            ) : (
              <SkeletonCard />
            )}
          </div>
        </div>
        <div className={card}>
          <h3 className="font-display text-lg font-bold">So'nggi yangiliklar</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {newsLoading ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i}><Skeleton className="h-8 w-full" /></li>
            )) : recentNews.length > 0 ? recentNews.map((n, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green" />
                <span>
                  <span className="font-medium">{n.title.substring(0, 50)}{n.title.length > 50 ? "…" : ""}</span>
                  <span className="block text-xs text-muted">{n.created_at ? new Date(n.created_at).toLocaleDateString("uz") : ""}</span>
                </span>
              </li>
            )) : (
              <li className="text-muted">Yangiliklar yo'q</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-6"><Bloggers /></div>
    </>
  )
}

/* ---------- Site stats editor ---------- */
function StatsEditor() {
  const [items, setItems] = useState<StatItem[]>([])
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const reload = () => api<{ stats: StatItem[] }>("/stats").then((d) => setItems(d.stats)).catch(() => {})
  useEffect(() => { reload() }, [])

  const set = (i: number, field: "value" | "label", v: string) =>
    setItems((arr) => arr.map((s, idx) => (idx === i ? { ...s, [field]: v } : s)))

  const save = async () => {
    setBusy(true); setSaved(false)
    try {
      const d = await api<{ stats: StatItem[] }>("/stats", { method: "PUT", body: JSON.stringify({ stats: items }) })
      setItems(d.stats); setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch { /* ignore */ } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Sayt statistikasi</h2>
          <p className="mt-1 text-sm text-muted">Bosh sahifadagi raqamlar (120+, 5M+ …) — bu yerdan tahrirlanadi.</p>
        </div>
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60">
          <Icon d={I.check} className="h-4 w-4" /> {busy ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>

      {saved && <div className="mt-4 flex items-center gap-2 rounded-xl bg-green/10 px-4 py-3 text-sm font-semibold text-green"><Icon d={I.check} className="h-4 w-4" /> Saqlandi — bosh sahifada yangilandi.</div>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s, i) => (
          <div key={s.key} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-soft text-green"><Icon d={statIcon[s.key] || I.star} className="h-5 w-5" /></span>
              <span className="rounded-md bg-soft px-2 py-0.5 text-[11px] font-bold text-muted">{s.key}</span>
            </div>
            <label className="mt-4 block text-xs font-semibold text-muted">Qiymat</label>
            <input value={s.value} onChange={(e) => set(i, "value", e.target.value)} placeholder="120+" className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 font-display text-lg font-extrabold outline-none focus:border-green" />
            <label className="mt-3 block text-xs font-semibold text-muted">Izoh</label>
            <input value={s.label} onChange={(e) => set(i, "label", e.target.value)} placeholder="Agro blogerlar" className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
          </div>
        ))}
        {items.length === 0 && <div className="rounded-2xl border border-green/10 bg-white py-12 text-center text-muted sm:col-span-2 lg:col-span-3">Yuklanmoqda…</div>}
      </div>
    </div>
  )
}

/* ---------- Team management ---------- */
type TeamMember = { id: string; name: string; role: string | null; image_url: string | null; sort_order: number; is_active: boolean }

function AdminTeam() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", role: "", image_url: "" })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api<{ members: TeamMember[] }>("/team")
      .then((d) => setMembers(d.members || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const openNew = () => {
    setForm({ name: "", role: "", image_url: "" })
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (m: TeamMember) => {
    setForm({ name: m.name, role: m.role || "", image_url: m.image_url || "" })
    setEditing(m)
    setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await api(`/team/${editing.id}`, { method: "PATCH", body: JSON.stringify({ name: form.name.trim(), role: form.role.trim() || null, image_url: form.image_url || null }) })
      } else {
        await api("/team", { method: "POST", body: JSON.stringify({ name: form.name.trim(), role: form.role.trim() || null, image_url: form.image_url || null }) })
      }
      setShowForm(false)
      load()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const [mutating, runMutation] = useBusy()
  const remove = (id: string) => {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return
    return runMutation(async () => {
      try {
        await api(`/team/${id}`, { method: "DELETE" })
        load()
      } catch { /* ignore */ }
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Jamoa a'zolari</h2>
          <p className="mt-1 text-sm text-muted">"Bizning jamoa" bo'limidagi a'zolarni boshqarish.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
          <Icon d={I.plus} className="h-4 w-4" /> Yangi a'zo
        </button>
      </div>

      {showForm && (
        <div className="mt-5 rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
          <h3 className="font-display text-lg font-bold">{editing ? "Tahrirlash" : "Yangi a'zo"}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-muted">Ism *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Aliyev Alisher" className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted">Lavozim</label>
              <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Bosh direktor" className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-semibold text-muted">Rasm</label>
            {form.image_url && (
              <div className="mt-2 mb-2 flex items-center gap-3">
                <img src={form.image_url} alt="preview" className="h-16 w-16 rounded-full object-cover ring-2 ring-soft" />
                <button onClick={() => setForm((f) => ({ ...f, image_url: "" }))} className="text-xs font-semibold text-red-500 hover:underline">O'chirish</button>
              </div>
            )}
            <MediaUpload
              onUpload={(result) => setForm((f) => ({ ...f, image_url: result.signedUrl }))}
              accept="image/*"
            />
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button onClick={save} disabled={saving || !form.name.trim()} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60">
              <Icon d={I.check} className="h-4 w-4" /> {saving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-green/20 bg-white px-5 py-2.5 text-sm font-bold text-muted transition-colors hover:bg-soft">Bekor qilish</button>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
        {!loading && members.map((m) => (
          <div key={m.id} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-soft">
                {m.image_url ? (
                  <img src={m.image_url} alt={m.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-green/10 text-green"><Icon d={I.user} className="h-6 w-6" /></span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-sm font-bold truncate">{m.name}</h3>
                <p className="text-xs text-muted truncate">{m.role || "—"}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => openEdit(m)} className="flex-1 rounded-lg border border-green/20 px-3 py-1.5 text-xs font-bold text-green transition-colors hover:bg-green hover:text-white">Tahrirlash</button>
              <button onClick={() => remove(m.id)} disabled={mutating} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50">O'chirish</button>
            </div>
          </div>
        ))}
        {!loading && members.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <div className="rounded-2xl border border-green/10 bg-white py-12 text-center text-muted">Hali a'zolar yo'q. "Yangi a'zo" tugmasini bosing.</div>
          </div>
        )}
      </div>
    </div>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-soft text-green"><Icon d={I.gear} className="h-8 w-8" /></span>
        <h2 className="mt-4 font-display text-xl font-bold">{title}</h2>
        <p className="mt-2 text-muted">Bu bo'lim tez orada qo'shiladi.</p>
      </div>
    </div>
  )
}

/* ---------- News Management ---------- */
type NewsArticle = { id: string; title: string; slug: string; status: string; language: string; is_featured: boolean; published_at: string; view_count: number; category: { name_uz: string; key: string } | null; author: { name: string } | null }

function AdminNews() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchNews = (p: number, q: string, silent = false) => {
    // Ilgari setLoading(true) yo'q edi: qidiruv yoki sahifa o'zgarganda eski
    // natijalar hech qanday belgisiz turib, keyin birdan almashardi.
    if (!silent) setLoading(true)
    const params = new URLSearchParams({ page: String(p), per_page: "12" })
    if (q.trim()) params.set("search", q.trim())
    return api<{ data: NewsArticle[]; pagination: { total: number } }>(`/news?${params}`)
      .then((d) => { setArticles(d.data || []); setTotal(d.pagination?.total || 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchNews(page, query) }, [query, page])

  const [mutating, runMutation] = useBusy()
  const remove = (id: string) => {
    if (!confirm("Yangilikni o'chirishni tasdiqlaysizmi?")) return
    return runMutation(async () => {
      await api(`/news/${id}`, { method: "DELETE" })
      await fetchNews(page, query, true)
    })
  }
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIds.size === articles.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(articles.map((a) => a.id)))
  }
  const bulkRemove = () => runMutation(async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    setArticles((prev) => prev.filter((a) => !ids.includes(a.id)))
    setSelectedIds(new Set())
    await Promise.allSettled(ids.map((id) => api(`/news/${id}`, { method: "DELETE" })))
    await fetchNews(page, query, true)
  })

  const totalPages = Math.ceil(total / 12)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Yangiliklar boshqaruvi</h2>
          <p className="mt-1 text-sm text-muted">Platformadagi barcha yangiliklar.</p>
        </div>
      </div>

      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        <div className="relative mb-4 max-w-sm">
          <Icon d={I.search} className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="Yangilik qidirish..." className="w-full rounded-xl border border-green/15 bg-[#f7faf4] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-green" />
        </div>

        {loading && <SkeletonTable rows={6} cols={5} />}

        {!loading && articles.length === 0 && (
          <div className="py-8 text-center text-muted">Yangiliklar topilmadi.</div>
        )}

        {!loading && selectedIds.size > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-sm font-semibold text-red-700">{selectedIds.size} ta yangilik tanlandi</span>
            <button onClick={bulkRemove} disabled={mutating} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white shadow transition-transform hover:scale-105 disabled:opacity-60">
              <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /> Tanlanganlarni o'chirish
            </button>
          </div>
        )}
        {!loading && articles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="pb-3 font-semibold w-10">
                    <input type="checkbox" checked={articles.length > 0 && selectedIds.size === articles.length} onChange={toggleAll} className="h-4 w-4 rounded border-green/30 text-green accent-green" />
                  </th>
                  <th className="pb-3 font-semibold">Sarlavha</th>
                  <th className="pb-3 font-semibold">Kategoriya</th>
                  <th className="pb-3 font-semibold">Holat</th>
                  <th className="pb-3 font-semibold">Ko'rishlar</th>
                  <th className="pb-3 font-semibold">Sana</th>
                  <th className="pb-3 font-semibold">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.id} className="border-t border-green/8 text-sm">
                    <td className="py-3 pr-3 w-10">
                      <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} className="h-4 w-4 rounded border-green/30 text-green accent-green" />
                    </td>
                    <td className="py-3 pr-3">
                      <span className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green/10 font-display text-xs font-bold text-green">{a.title[0]?.toUpperCase()}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold truncate max-w-[200px]">{a.title}</span>
                          <span className="block text-xs text-muted">{a.author?.name || "—"}</span>
                        </span>
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-muted">{a.category?.name_uz || "—"}</td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${a.status === "published" ? "bg-green/10 text-green" : a.status === "draft" ? "bg-slate-100 text-slate-500" : "bg-orange-100 text-orange-600"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${a.status === "published" ? "bg-green" : a.status === "draft" ? "bg-slate-400" : "bg-orange-500"}`} />
                        {a.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-semibold">{a.view_count || 0}</td>
                    <td className="py-3 pr-3 text-muted text-xs">{a.published_at ? new Date(a.published_at).toLocaleDateString("uz") : "—"}</td>
                    <td className="py-3">
                      <button onClick={() => remove(a.id)} disabled={mutating} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40" title="O'chirish">
                        <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`grid h-9 w-9 place-items-center rounded-lg border text-sm ${page === 1 ? "border-gray-200 text-gray-400" : "border-green/15 hover:border-green"}`}>
              <Icon d={I.chevLeft} className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`grid h-9 min-w-9 place-items-center rounded-lg px-3 text-sm font-bold ${p === page ? "bg-green text-white" : "border border-green/15 hover:border-green"}`}>{p}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`grid h-9 w-9 place-items-center rounded-lg border text-sm ${page === totalPages ? "border-gray-200 text-gray-400" : "border-green/15 hover:border-green"}`}>
              <Icon d={I.chevRight} className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Settings Management ---------- */
type Setting = { id: string; key: string; value: string; type: string; description: string; is_public: boolean }

function AdminSettings() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [igConnected, setIgConnected] = useState(false)
  const [igUsername, setIgUsername] = useState<string | null>(null)
  const [igChecking, setIgChecking] = useState(true)

  const load = () => {
    api<{ settings: Setting[] }>("/settings")
      .then((d) => setSettings(d.settings || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  // "Yangilash" tugmasi bloklanmagan edi: N ta parallel so'rov ketardi.
  const [igRechecking, runIgCheck] = useBusy()
  const checkIgStatus = () => {
    setIgChecking(true)
    return api<{ connected: boolean; username: string | null }>("/instagram-status")
      .then((d) => { setIgConnected(d.connected); setIgUsername(d.username) })
      .catch(() => { setIgConnected(false); setIgUsername(null) })
      .finally(() => setIgChecking(false))
  }

  useEffect(() => { load(); checkIgStatus() }, [])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "instagram-connected") {
        setIgConnected(true)
        setIgUsername(e.data.username || "Unknown")
      }
      if (e.data?.type === "instagram-error") {
        setIgConnected(false)
        setIgUsername(null)
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  const set = (i: number, field: "value", v: string) =>
    setSettings((arr) => arr.map((s, idx) => (idx === i ? { ...s, [field]: v } : s)))

  // Tugmada `disabled={loading}` yozilgan edi, lekin `loading` birinchi
  // yuklashdan keyin doim false -> tugma AMALDA hech qachon bloklanmasdi.
  // Ikki marta bosilsa har bir sozlama uchun ketma-ket PATCH ikki marta ketardi.
  const [saving, runSave] = useBusy()
  const save = () => runSave(async () => {
    for (const s of settings) {
      await api(`/settings/${s.id}`, { method: "PATCH", body: JSON.stringify({ value: s.value }) })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Sozlamalar</h2>
          <p className="mt-1 text-sm text-muted">Platforma sozlamalarini boshqarish.</p>
        </div>
        <button onClick={save} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60">
          <Icon d={I.check} className="h-4 w-4" /> {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>

      {saved && <div className="mt-4 flex items-center gap-2 rounded-xl bg-green/10 px-4 py-3 text-sm font-semibold text-green"><Icon d={I.check} className="h-4 w-4" /> Saqlandi!</div>}

      {/* Instagram/Facebook ulash */}
      <div className="mt-5 rounded-2xl border border-pink-200 bg-pink-50/50 p-5">
        <div className="flex items-center justify-between gap-2 text-pink-600">
          <div className="flex items-center gap-2">
            <Icon d={I.instagram} className="h-5 w-5" />
            <span className="font-display text-base font-bold">Instagram akkaunt ulash</span>
          </div>
          {!igChecking && igConnected && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-green/10 px-2.5 py-1 text-xs font-bold text-green">
              <span className="h-1.5 w-1.5 rounded-full bg-green" /> Ulangan
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">Facebook orqali Instagram Business akkauntni ulang. Bu bir martalik sozlama — barcha bloggerlar Instagram ma'lumotlarini olish imkoniga ega bo'ladi.</p>
        {!igChecking && igConnected && igUsername ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-green/20 bg-green/5 p-3">
            <Icon d={I.instagram} className="h-5 w-5 text-pink-500" />
            <span className="text-sm font-semibold">@{igUsername}</span>
            <button onClick={() => runIgCheck(checkIgStatus)} disabled={igRechecking} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-green/25 px-3 py-1.5 text-xs font-bold text-green hover:bg-green hover:text-white disabled:opacity-60">
              <Icon d={I.refresh} className="h-3.5 w-3.5" /> Yangilash
            </button>
          </div>
        ) : !igChecking && !igConnected ? (
          <button onClick={async () => {
            try {
              const res = await api<{ authUrl: string }>("/instagram-oauth-start", { method: "POST" })
              if (res.authUrl) window.open(res.authUrl, "_blank", "width=600,height=700")
            } catch (e) {
              alert(e instanceof Error ? e.message : "Xatolik")
            }
          }} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition-transform hover:scale-105">
            <Icon d={I.external} className="h-4 w-4" /> Facebook bilan kirish
          </button>
        ) : null}
      </div>

      {loading && <SkeletonStatGrid />}

      {!loading && settings.length === 0 && (
        <div className="py-8 text-center text-muted">Sozlamalar topilmadi.</div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settings.map((s, i) => (
          <div key={s.id} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-soft px-2 py-0.5 text-[11px] font-bold text-muted">{s.key}</span>
              {s.is_public && <span className="rounded-md bg-green/10 px-2 py-0.5 text-[11px] font-bold text-green">Public</span>}
            </div>
            <label className="mt-3 block text-xs font-semibold text-muted">Qiymat</label>
            <input value={s.value} onChange={(e) => set(i, "value", e.target.value)} className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            {s.description && <p className="mt-1 text-[11px] text-muted">{s.description}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Topshiriqlar (TZ) ---------- */
type AdminTask = {
  id: string; title: string; description: string | null; priority: string; deadline: string | null; created_at: string
  file_url?: string | null; file_name?: string | null
  stats: { total: number; new: number; in_progress: number; done: number }
}
const prioLabel: Record<string, string> = { low: "Past", normal: "O'rta", high: "Yuqori" }
const prioColor: Record<string, string> = {
  low: "bg-gray-100 text-gray-600", normal: "bg-blue-100 text-blue-700", high: "bg-red-100 text-red-600",
}

function AdminTasks() {
  const [tasks, setTasks] = useState<AdminTask[]>([])
  const [bloggers, setBloggers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: "", description: "", priority: "normal", deadline: "" })
  const [file, setFile] = useState<{ url: string; name: string } | null>(null)
  const [target, setTarget] = useState<"all" | "selected">("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState("")

  const load = () => {
    setLoading(true)
    Promise.all([
      api<{ tasks: AdminTask[] }>("/tasks").then((d) => setTasks(d.tasks || [])).catch(() => {}),
      api<{ bloggers: { id: string; name: string }[] }>("/bloggers").then((d) => setBloggers(d.bloggers || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const toggle = (id: string) => setSelected((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const send = async () => {
    setMsg("")
    if (!form.title.trim()) { setMsg("❌ Sarlavha majburiy"); return }
    const blogger_ids = target === "all" ? "all" : Array.from(selected)
    if (target === "selected" && (blogger_ids as string[]).length === 0) { setMsg("❌ Kamida bitta bloger tanlang"); return }
    setSending(true)
    try {
      const r = await api<{ assigned: number }>("/tasks", { method: "POST", body: JSON.stringify({ ...form, file_url: file?.url || null, file_name: file?.name || null, blogger_ids }) })
      setMsg(`✅ Topshiriq ${r.assigned} ta blogerga yuborildi`)
      setForm({ title: "", description: "", priority: "normal", deadline: "" }); setFile(null); setSelected(new Set()); setTarget("all")
      load()
    } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Xatolik"}`) }
    finally { setSending(false) }
  }

  const [mutating, runMutation] = useBusy()
  const remove = (id: string) => runMutation(async () => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await api(`/tasks/${id}`, { method: "DELETE" }).catch(() => {}).then(() => load())
  })

  return (
    <div>
      <div>
        <h2 className="font-display text-xl font-extrabold tracking-tight">Topshiriqlar (TZ)</h2>
        <p className="mt-1 text-sm text-muted">Blogerlarga topshiriq yuboring va bajarilishini kuzating.</p>
      </div>

      {/* Yangi TZ formasi */}
      <div className={`${card} mt-5`}>
        <h3 className="font-display font-bold">Yangi topshiriq yuborish</h3>
        <div className="mt-4 space-y-3">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Sarlavha (masalan: Yangi mahsulot haqida video)" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Topshiriq tavsifi / talablar…" className="w-full resize-none rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">Muhimlik</span>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="w-full rounded-xl border border-green/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-green">
                <option value="low">Past</option>
                <option value="normal">O'rta</option>
                <option value="high">Yuqori</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">Muddat (ixtiyoriy)</span>
              <input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} className="w-full rounded-xl border border-green/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-green" />
            </label>
          </div>

          {/* TZ fayl (ixtiyoriy) */}
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted">TZ fayli (ixtiyoriy) — PDF, Word, rasm</span>
            {file ? (
              <div className="flex items-center gap-2 rounded-xl border border-green/20 bg-green/5 px-4 py-2.5 text-sm">
                <Icon d={I.paperclip} className="h-4 w-4 shrink-0 text-green" />
                <span className="flex-1 truncate font-medium">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-red-400 hover:bg-red-50"><Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" /></button>
              </div>
            ) : (
              <MediaUpload accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*" onUpload={(r) => setFile({ url: r.signedUrl, name: r.fileName || "TZ fayli" })} />
            )}
          </div>

          {/* Kimga */}
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted">Kimga yuborish</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setTarget("all")} className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${target === "all" ? "bg-green text-white" : "border-2 border-green/25 text-ink hover:border-green"}`}>Hamma blogerlarga</button>
              <button type="button" onClick={() => setTarget("selected")} className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${target === "selected" ? "bg-green text-white" : "border-2 border-green/25 text-ink hover:border-green"}`}>Tanlangan blogerlarga</button>
            </div>
            {target === "selected" && (
              <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-green/15 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-muted">{selected.size} ta tanlandi</span>
                  <button type="button" onClick={() => setSelected(selected.size === bloggers.length ? new Set() : new Set(bloggers.map((b) => b.id)))} className="text-xs font-bold text-green hover:underline">
                    {selected.size === bloggers.length ? "Bekor qilish" : "Hammasini tanlash"}
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {bloggers.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-soft cursor-pointer">
                      <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} className="h-4 w-4 accent-green" />
                      <span className="truncate">{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {msg && <div className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${msg.startsWith("✅") ? "bg-green/10 text-green" : "bg-red-50 text-red-600"}`}>{msg}</div>}
          <button onClick={send} disabled={sending} className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60">
            <Icon d={I.send} className="h-4 w-4" /> {sending ? "Yuborilmoqda…" : "Topshiriqni yuborish"}
          </button>
        </div>
      </div>

      {/* Yuborilgan TZ ro'yxati */}
      <div className="mt-6">
        <h3 className="font-display font-bold">Yuborilgan topshiriqlar</h3>
        {loading ? (
          <div className="mt-3"><SkeletonCard /></div>
        ) : tasks.length === 0 ? (
          <p className="mt-3 rounded-xl border border-green/10 bg-white py-8 text-center text-sm text-muted">Hali topshiriq yuborilmagan.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {tasks.map((t) => (
              <div key={t.id} className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${prioColor[t.priority] || prioColor.normal}`}>{prioLabel[t.priority] || t.priority}</span>
                      <h4 className="font-display font-bold">{t.title}</h4>
                    </div>
                    {t.description && <p className="mt-1 text-sm text-muted">{t.description}</p>}
                    {t.file_url && (
                      <a href={t.file_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green/10 px-3 py-1.5 text-xs font-semibold text-green hover:bg-green/20">
                        <Icon d={I.paperclip} className="h-3.5 w-3.5" /> {t.file_name || "TZ fayli"}
                      </a>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
                      <span>📅 {t.deadline ? `Muddat: ${t.deadline}` : "Muddatsiz"}</span>
                      <span>Yuborildi: {new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={() => remove(t.id)} disabled={mutating} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-40"><Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" /></button>
                </div>
                {/* Holat statistikasi */}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-lg bg-soft px-3 py-1 font-semibold">Jami: {t.stats.total}</span>
                  <span className="rounded-lg bg-gray-100 px-3 py-1 font-semibold text-gray-600">Yangi: {t.stats.new}</span>
                  <span className="rounded-lg bg-blue-50 px-3 py-1 font-semibold text-blue-700">Bajarilmoqda: {t.stats.in_progress}</span>
                  <span className="rounded-lg bg-green/10 px-3 py-1 font-semibold text-green">Bajarildi: {t.stats.done}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Monitoring ---------- */
function AdminMonitoring() {
  const [newsJobs, setNewsJobs] = useState<{ id: string; job_type: string; status: string; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)

  // "Yangilash" tugmasi bloklanmagan edi: N ta parallel so'rov ketardi.
  const [refreshing, runRefresh] = useBusy()
  const load = () => {
    setLoading(true)  // qayta yuklashda ham skeleton ko'rinsin
    api<{ jobs: { id: string; job_type: string; status: string; created_at: string }[] }>("/news/jobs")
      .then((d) => setNewsJobs(d.jobs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const [mutating, runMutation] = useBusy()
  const retry = (id: string) => runMutation(async () => {
    await api(`/news/jobs/${id}/retry`, { method: "POST" })
    load()
  })

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    processing: "bg-blue-100 text-blue-700",
    completed: "bg-green/10 text-green",
    failed: "bg-red-100 text-red-600",
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Monitoring</h2>
          <p className="mt-1 text-sm text-muted">Worker'lar, queue'lar va tizim holati.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => runRefresh(load)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 px-4 py-2 text-sm font-bold transition-colors hover:border-green hover:text-green disabled:opacity-60">
            <Icon d={I.refresh} className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Yangilanmoqda…" : "Yangilash"}
          </button>
        </div>
      </div>

      {/* Queue Stats */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className={card.replace("p-6", "p-5")}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green"><Icon d={I.doc} className="h-5 w-5" /></span>
          <div className="mt-3 text-xs text-muted">Yangiliklar queue</div>
          <div className="mt-1 font-display text-2xl font-extrabold">{newsJobs.filter((j) => j.status === "pending").length}</div>
        </div>
        <div className={card.replace("p-6", "p-5")}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green"><Icon d={I.chart} className="h-5 w-5" /></span>
          <div className="mt-3 text-xs text-muted">Jarayonda</div>
          <div className="mt-1 font-display text-2xl font-extrabold">{newsJobs.filter((j) => j.status === "processing").length}</div>
        </div>
        <div className={card.replace("p-6", "p-5")}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green"><Icon d={I.shield} className="h-5 w-5" /></span>
          <div className="mt-3 text-xs text-muted">Bajarilgan</div>
          <div className="mt-1 font-display text-2xl font-extrabold">{newsJobs.filter((j) => j.status === "completed").length}</div>
        </div>
      </div>

      {/* Job List */}
      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        <h3 className="font-display text-lg font-bold">Yangiliklar ishlari</h3>
        {loading && <div className="py-8"><SkeletonTable rows={4} cols={3} /></div>}
        {!loading && newsJobs.length === 0 && <div className="py-8 text-center text-muted">Hech qanday ish topilmadi.</div>}
        {!loading && newsJobs.length > 0 && (
          <div className="mt-4 space-y-2">
            {newsJobs.slice(0, 20).map((j) => (
              <div key={j.id} className="flex items-center gap-3 rounded-lg border border-green/8 bg-[#fafdf7] px-3 py-2.5">
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold ${statusColor[j.status] || "bg-slate-100 text-slate-500"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${j.status === "completed" ? "bg-green" : j.status === "failed" ? "bg-red-500" : j.status === "processing" ? "bg-blue-500" : "bg-yellow-500"}`} />
                  {j.status}
                </span>
                <span className="flex-1 text-sm font-medium">{j.job_type}</span>
                <span className="text-xs text-muted">{new Date(j.created_at).toLocaleString("uz")}</span>
                {j.status === "failed" && (
                  <button onClick={() => retry(j.id)} disabled={mutating} className="rounded-lg border border-green/20 px-2.5 py-1 text-xs font-bold text-green hover:bg-green hover:text-white disabled:opacity-50">Qayta</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- News Sources Management ---------- */
type NewsSource = { id: string; name: string; type: string; url: string; is_active: boolean; last_fetched_at: string | null }

function AdminNewsSources() {
  const [sources, setSources] = useState<NewsSource[]>([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const blank = { name: "", type: "rss", url: "" }
  const [form, setForm] = useState(blank)

  // Ilgari loading yo'q edi: yuklanayotganda "Manba yo'q" YOLG'ONI ko'rinardi.
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [saving, runSave] = useBusy()
  const reload = (silent = false) => {
    if (!silent) setLoading(true)
    setFailed(false)
    return api<{ sources: NewsSource[] }>("/news-sources")
      .then((d) => setSources(d.sources || []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [])

  const add = (e: React.FormEvent) => {
    e.preventDefault(); setError("")
    if (!form.name.trim() || !form.url.trim()) { setError("Nomi va URL majburiy"); return }
    // Pending holati bo'lmagani uchun ikki marta yuborilsa dublikat manba yaratilardi.
    return runSave(async () => {
      try {
        await api("/news-sources", { method: "POST", body: JSON.stringify(form) })
        setForm(blank); setAdding(false); await reload(true)
      } catch (err: unknown) { setError(err instanceof Error ? err.message : "Xatolik") }
    })
  }
  const remove = (id: string) => {
    if (!confirm("Manbani o'chirishni tasdiqlaysizmi?")) return
    return runSave(async () => { await api(`/news-sources/${id}`, { method: "DELETE" }); await reload(true) })
  }

  const typeLabel: Record<string, string> = { rss: "RSS", web: "Web Crawler", telegram: "Telegram" }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Yangilik manbalari</h2>
          <p className="mt-1 text-sm text-muted">RSS, Telegram va veb-saytlardan yangiliklar yig'ish manbalari.</p>
        </div>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105">
          <Icon d={I.plus} className="h-4 w-4" /> Yangi manba qo'shish
        </button>
      </div>

      {adding && (
        <form onSubmit={add} className="mt-5 rounded-2xl border border-green/15 bg-soft p-5">
          {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-3">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Manba nomi" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none">
              <option value="rss">RSS</option>
              <option value="web">Web Crawler</option>
              <option value="telegram">Telegram</option>
            </select>
            <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="URL" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <button type="submit" disabled={saving} className="rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "..." : "Qo'shish"}</button>
          </div>
        </form>
      )}

      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="pb-3 font-semibold">Nomi</th>
                <th className="pb-3 font-semibold">Turi</th>
                <th className="pb-3 font-semibold">URL</th>
                <th className="pb-3 font-semibold">Holat</th>
                <th className="pb-3 font-semibold">Oxirgi yuklash</th>
                <th className="pb-3 font-semibold">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="py-6"><SkeletonTable rows={4} cols={5} /></td></tr>}
              {!loading && failed && (
                <tr><td colSpan={6} className="py-10 text-center text-red-600">Manbalarni yuklab bo'lmadi. <button onClick={() => reload()} className="font-bold text-green hover:underline">Qayta urinish</button></td></tr>
              )}
              {!loading && !failed && sources.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-muted">Manba yo'q. "Yangi manba qo'shish" orqali qo'shing.</td></tr>
              )}
              {!loading && !failed && sources.map((s) => (
                <tr key={s.id} className="border-t border-green/8 text-sm">
                  <td className="py-3 pr-3 font-semibold">{s.name}</td>
                  <td className="py-3 pr-3"><span className="rounded-md bg-green/10 px-2 py-1 text-[11px] font-bold text-green">{typeLabel[s.type] || s.type}</span></td>
                  <td className="py-3 pr-3 text-muted text-xs max-w-[200px] truncate">{s.url}</td>
                  <td className="py-3 pr-3">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${s.is_active ? "bg-green/10 text-green" : "bg-slate-100 text-slate-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.is_active ? "bg-green" : "bg-slate-400"}`} />
                      {s.is_active ? "Faol" : "O'chirilgan"}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-muted text-xs">{s.last_fetched_at ? new Date(s.last_fetched_at).toLocaleString("uz") : "—"}</td>
                  <td className="py-3">
                    <button onClick={() => remove(s.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500" title="O'chirish">
                      <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ---------- Users Management ---------- */
type AdminUser = { id: string; email: string; name: string; role: string; status: string; created_at: string }
type RoleOption = { id: string; name: string }

function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [changingRole, setChangingRole] = useState<string | null>(null)

  // "Yangilash" tugmasi bloklanmagan edi: N ta parallel so'rov ketardi.
  const [refreshing, runRefresh] = useBusy()
  const load = () => {
    setLoading(true)  // qayta yuklashda ham skeleton ko'rinsin
    Promise.all([
      api<{ users: AdminUser[] }>("/users"),
      api<{ roles: RoleOption[] }>("/roles"),
    ]).then(([u, r]) => {
      setUsers(u.users || [])
      setRoles(r.roles || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const [mutating, runMutation] = useBusy()
  const toggleStatus = (u: AdminUser) => runMutation(async () => {
    const newStatus = u.status === "active" ? "suspended" : "active"
    await api(`/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) })
    load()
  })

  const changeRole = async (userId: string, roleId: string) => {
    await api("/user-role", { method: "PATCH", body: JSON.stringify({ user_id: userId, role_id: roleId }) })
    setChangingRole(null)
    load()
  }

  const roleColors: Record<string, string> = {
    super_admin: "bg-green/10 text-green",
    admin: "bg-blue-100 text-blue-600",
    editor: "bg-purple-100 text-purple-600",
    blogger: "bg-orange-100 text-orange-600",
    company: "bg-cyan-100 text-cyan-600",
    user: "bg-slate-100 text-slate-500",
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Foydalanuvchilar</h2>
          <p className="mt-1 text-sm text-muted">Barcha ro'yxatdan o'tgan foydalanuvchilar.</p>
        </div>
        <button onClick={() => runRefresh(load)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 px-4 py-2 text-sm font-bold transition-colors hover:border-green hover:text-green disabled:opacity-60">
          <Icon d={I.refresh} className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Yangilanmoqda…" : "Yangilash"}
        </button>
      </div>
      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading && <SkeletonTable rows={6} cols={5} />}
        {!loading && users.length === 0 && <div className="py-8 text-center text-muted">Foydalanuvchilar topilmadi.</div>}
        {!loading && users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="pb-3 font-semibold">Foydalanuvchi</th>
                  <th className="pb-3 font-semibold">Rol</th>
                  <th className="pb-3 font-semibold">Holat</th>
                  <th className="pb-3 font-semibold">Ro'yxatdan o'tgan</th>
                  <th className="pb-3 font-semibold">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-green/8 text-sm">
                    <td className="py-3 pr-3">
                      <span className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green/10 font-display text-xs font-bold text-green">{(u.name || u.email)[0]?.toUpperCase()}</span>
                        <span><span className="block font-semibold">{u.name || "—"}</span><span className="block text-xs text-muted">{u.email}</span></span>
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      {changingRole === u.id ? (
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            const val = e.target.value
                            if (val) changeRole(u.id, val)
                          }}
                          onBlur={() => setChangingRole(null)}
                          autoFocus
                          className="rounded-lg border border-green/30 px-2 py-1 text-xs font-bold outline-none"
                        >
                          <option value="" disabled>Rolni tanlang</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${roleColors[u.role] || "bg-slate-100 text-slate-500"}`}>{u.role}</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${u.status === "active" ? "bg-green/10 text-green" : "bg-red-100 text-red-500"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${u.status === "active" ? "bg-green" : "bg-red-500"}`} />
                        {u.status === "active" ? "Faol" : "To'xtatilgan"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-muted text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString("uz") : "—"}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {changingRole !== u.id && (
                          <button onClick={() => setChangingRole(u.id)} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-500 transition-colors hover:bg-blue-50">
                            Rolni o'zgartirish
                          </button>
                        )}
                        <button onClick={() => toggleStatus(u)} disabled={mutating} className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${u.status === "active" ? "border-red-200 text-red-500 hover:bg-red-50" : "border-green/20 text-green hover:bg-green hover:text-white"}`}>
                          {u.status === "active" ? "To'xtatish" : "Faollashtirish"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Contacts Management ---------- */
type ContactMessage = { id: string; name: string; email: string; phone: string; subject: string; message: string; is_read: boolean; created_at: string }

function AdminContacts() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ContactMessage | null>(null)

  // "Yangilash" tugmasi bloklanmagan edi: N ta parallel so'rov ketardi.
  const [refreshing, runRefresh] = useBusy()
  const load = () => {
    setLoading(true)  // qayta yuklashda ham skeleton ko'rinsin
    api<{ messages: ContactMessage[] }>("/messages")
      .then((d) => setMessages(d.messages || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const markRead = async (m: ContactMessage) => {
    setSelected(m)
    if (!m.is_read) {
      await api(`/messages/${m.id}`, { method: "PATCH" })
      setMessages((prev) => prev.map((msg) => msg.id === m.id ? { ...msg, is_read: true } : msg))
    }
  }

  const [mutating, runMutation] = useBusy()
  const remove = (id: string) => {
    if (!confirm("Xabarni o'chirishni tasdiqlaysizmi?")) return
    return runMutation(async () => {
      await api(`/messages/${id}`, { method: "DELETE" })
      setSelected(null)
      load()
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Aloqa xabarlari</h2>
          <p className="mt-1 text-sm text-muted">Foydalanuvchilardan kelgan xabarlar.</p>
        </div>
        <button onClick={() => runRefresh(load)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 px-4 py-2 text-sm font-bold transition-colors hover:border-green hover:text-green disabled:opacity-60">
          <Icon d={I.refresh} className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Yangilanmoqda…" : "Yangilash"}
        </button>
      </div>
      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading && <SkeletonTable rows={6} cols={5} />}
        {!loading && messages.length === 0 && <div className="py-8 text-center text-muted">Xabarlar yo'q.</div>}
        {!loading && messages.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="pb-3 font-semibold">Yuboruvchi</th>
                  <th className="pb-3 font-semibold">Mavzu</th>
                  <th className="pb-3 font-semibold">Holat</th>
                  <th className="pb-3 font-semibold">Sana</th>
                  <th className="pb-3 font-semibold">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id} className={`border-t border-green/8 text-sm ${!m.is_read ? "bg-green/3" : ""}`}>
                    <td className="py-3 pr-3"><span className="font-semibold">{m.name}</span> <span className="text-xs text-muted">({m.email})</span></td>
                    <td className="py-3 pr-3 text-muted">{m.subject || "—"}</td>
                    <td className="py-3 pr-3">
                      <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${m.is_read ? "bg-slate-100 text-slate-500" : "bg-green/10 text-green"}`}>{m.is_read ? "O'qilgan" : "Yangi"}</span>
                    </td>
                    <td className="py-3 pr-3 text-muted text-xs">{m.created_at ? new Date(m.created_at).toLocaleDateString("uz") : "—"}</td>
                    <td className="py-3 flex gap-1.5">
                      <button onClick={() => markRead(m)} className="rounded-lg border border-green/20 px-2.5 py-1 text-xs font-bold text-green hover:bg-green hover:text-white">Ko'rish</button>
                      <button onClick={() => remove(m.id)} disabled={mutating} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"><Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">{selected.subject || "Xabar"}</h3>
              <button onClick={() => setSelected(null)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-soft"><Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 text-sm text-muted">Yuboruvchi: <strong>{selected.name}</strong> ({selected.email})</div>
            {selected.phone && <div className="mt-1 text-sm text-muted">Telefon: {selected.phone}</div>}
            <div className="mt-4 rounded-xl bg-soft p-4 text-sm leading-relaxed whitespace-pre-wrap">{selected.message}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Subscribers Management ---------- */
type Subscriber = { id: string; email: string; is_active: boolean; created_at: string }

function AdminSubscribers() {
  const [subs, setSubs] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)

  // "Yangilash" tugmasi bloklanmagan edi: N ta parallel so'rov ketardi.
  const [refreshing, runRefresh] = useBusy()
  const load = () => {
    setLoading(true)  // qayta yuklashda ham skeleton ko'rinsin
    api<{ subscribers: Subscriber[] }>("/subscribers")
      .then((d) => setSubs(d.subscribers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const [mutating, runMutation] = useBusy()
  const remove = (id: string) => {
    if (!confirm("Obunachini o'chirishni tasdiqlaysizmi?")) return
    return runMutation(async () => { await api(`/subscribers/${id}`, { method: "DELETE" }); load() })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Obunachilar</h2>
          <p className="mt-1 text-sm text-muted">Newsletter obunachilari ro'yxati.</p>
        </div>
        <button onClick={() => runRefresh(load)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 px-4 py-2 text-sm font-bold transition-colors hover:border-green hover:text-green disabled:opacity-60">
          <Icon d={I.refresh} className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Yangilanmoqda…" : "Yangilash"}
        </button>
      </div>
      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading && <SkeletonTable rows={6} cols={5} />}
        {!loading && subs.length === 0 && <div className="py-8 text-center text-muted">Obunachilar yo'q.</div>}
        {!loading && subs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="pb-3 font-semibold">Email</th>
                  <th className="pb-3 font-semibold">Holat</th>
                  <th className="pb-3 font-semibold">Obuna bo'lgan</th>
                  <th className="pb-3 font-semibold">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-t border-green/8 text-sm">
                    <td className="py-3 pr-3 font-semibold">{s.email}</td>
                    <td className="py-3 pr-3">
                      <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${s.is_active ? "bg-green/10 text-green" : "bg-slate-100 text-slate-500"}`}>{s.is_active ? "Faol" : "Nofaol"}</span>
                    </td>
                    <td className="py-3 pr-3 text-muted text-xs">{s.created_at ? new Date(s.created_at).toLocaleDateString("uz") : "—"}</td>
                    <td className="py-3">
                      <button onClick={() => remove(s.id)} disabled={mutating} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"><Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Categories Management ---------- */
type NewsCategory = { id: string; key: string; name_uz: string; name_ru: string; name_en: string; is_active: boolean }

function AdminCategories() {
  const [cats, setCats] = useState<NewsCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const blank = { key: "", name_uz: "", name_ru: "", name_en: "" }
  const [form, setForm] = useState(blank)

  const load = () => { setLoading(true); api<{ categories: NewsCategory[] }>("/categories").then((d) => setCats(d.categories || [])).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true)
    if (!form.key.trim() || !form.name_uz.trim()) { setError("Kalit va nomi majburiy"); setSaving(false); return }
    const temp = { id: crypto.randomUUID(), ...form, is_active: true }
    setCats((prev) => [...prev, temp])
    setForm(blank); setAdding(false)
    try {
      await api("/categories", { method: "POST", body: JSON.stringify(form) })
    } catch { setError("Xatolik yuz berdi") }
    finally { setSaving(false); load() }
  }
  const [mutating, runMutation] = useBusy()
  const remove = (id: string) => {
    if (!confirm("Kategoriyani o'chirishni tasdiqlaysizmi?")) return
    return runMutation(async () => { await api(`/categories/${id}`, { method: "DELETE" }); load() })
  }
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIds.size === cats.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(cats.map((c) => c.id)))
  }
  const bulkRemove = () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    setCats((prev) => prev.filter((c) => !ids.includes(c.id)))
    setSelectedIds(new Set())
    return runMutation(() => Promise.allSettled(ids.map((id) => api(`/categories/${id}`, { method: "DELETE" }))).then(() => load()))
  }
  const toggle = (c: NewsCategory) => runMutation(async () => {
    await api(`/categories/${c.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !c.is_active }) })
    load()
  })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Kategoriyalar</h2>
          <p className="mt-1 text-sm text-muted">Yangiliklar kategoriyalarini boshqarish.</p>
        </div>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105">
          <Icon d={I.plus} className="h-4 w-4" /> Yangi kategoriya
        </button>
      </div>
      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading && <SkeletonTable rows={6} cols={6} />}
        {!loading && selectedIds.size > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-sm font-semibold text-red-700">{selectedIds.size} ta kategoriya tanlandi</span>
            <button onClick={bulkRemove} disabled={mutating} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white shadow transition-transform hover:scale-105 disabled:opacity-60">
              <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /> Tanlanganlarni o'chirish
            </button>
          </div>
        )}
        {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="pb-3 font-semibold w-10">
                  <input type="checkbox" checked={cats.length > 0 && selectedIds.size === cats.length} onChange={toggleAll} className="h-4 w-4 rounded border-green/30 text-green accent-green" />
                </th>
                <th className="pb-3 font-semibold">Kalit</th>
                <th className="pb-3 font-semibold">Nomi (uz)</th>
                <th className="pb-3 font-semibold">Nomi (ru)</th>
                <th className="pb-3 font-semibold">Nomi (en)</th>
                <th className="pb-3 font-semibold">Holat</th>
                <th className="pb-3 font-semibold">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {cats.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-muted">Kategoriya yo'q.</td></tr>}
              {cats.map((c) => (
                <tr key={c.id} className="border-t border-green/8 text-sm">
                  <td className="py-3 pr-3 w-10">
                    <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="h-4 w-4 rounded border-green/30 text-green accent-green" />
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-muted">{c.key}</td>
                  <td className="py-3 pr-3 font-semibold">{c.name_uz}</td>
                  <td className="py-3 pr-3 text-muted">{c.name_ru}</td>
                  <td className="py-3 pr-3 text-muted">{c.name_en}</td>
                  <td className="py-3 pr-3">
                    <button onClick={() => toggle(c)} disabled={mutating} className="disabled:opacity-50">
                      {c.is_active
                        ? <span className="inline-flex items-center gap-1 rounded-md bg-green/10 px-2 py-1 text-[11px] font-bold text-green"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Faol</span>
                        : <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Nofaol</span>}
                    </button>
                  </td>
                  <td className="py-3">
                    <button onClick={() => remove(c.id)} disabled={mutating} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"><Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Add Category Modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => { setAdding(false); setError(""); setForm(blank) }}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-extrabold">Yangi kategoriya qo'shish</h3>
            <form onSubmit={add} className="mt-5 space-y-4">
              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Kalit</label>
                <input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} placeholder="masalan: texnologiya" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Nomi (uz)</label>
                <input value={form.name_uz} onChange={(e) => setForm((f) => ({ ...f, name_uz: e.target.value }))} placeholder="O'zbekcha nomi" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Nomi (ru)</label>
                <input value={form.name_ru} onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))} placeholder="Russkiy" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Nomi (en)</label>
                <input value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} placeholder="English" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setAdding(false); setError(""); setForm(blank) }} className="rounded-xl border-2 border-green/30 px-6 py-2.5 text-sm font-bold text-ink transition-colors hover:border-green hover:text-green">Bekor qilish</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105 disabled:opacity-60">
                  {saving && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {saving ? "Qo'shilmoqda…" : "Qo'shish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Homepage Management ---------- */
type HomepageSection = { id: string; section_key: string; title: string; subtitle: string; is_active: boolean; items: HomepageItem[] }
type HomepageItem = { id: string; section_id: string; item_key: string; title: string; description: string; icon: string; link: string; sort_order: number; is_active: boolean }

function AdminHomepage() {
  const [sections, setSections] = useState<HomepageSection[]>([])
  const [loading, setLoading] = useState(true)
  const [editSec, setEditSec] = useState<string | null>(null)
  const [secForm, setSecForm] = useState<{ title: string; subtitle: string }>({ title: "", subtitle: "" })
  const [editItem, setEditItem] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState<{ title: string; description: string; icon: string; link: string }>({ title: "", description: "", icon: "", link: "" })
  const [saving, setSaving] = useState(false)

  // "Yangilash" tugmasi bloklanmagan edi: N ta parallel so'rov ketardi.
  const [refreshing, runRefresh] = useBusy()
  const load = () => {
    setLoading(true)  // qayta yuklashda ham skeleton ko'rinsin
    api<{ sections: HomepageSection[] }>("/homepage")
      .then((d) => setSections(d.sections || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const [mutating, runMutation] = useBusy()
  const toggleSection = (s: HomepageSection) => runMutation(async () => {
    await api(`/homepage/sections/${s.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !s.is_active }) })
    load()
  })
  const toggleItem = (item: HomepageItem) => runMutation(async () => {
    await api(`/homepage/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !item.is_active }) })
    load()
  })
  const startEditSec = (s: HomepageSection) => { setEditSec(s.id); setSecForm({ title: s.title || "", subtitle: s.subtitle || "" }); setEditItem(null) }
  const saveSec = async (id: string) => {
    setSaving(true)
    try { await api(`/homepage/sections/${id}`, { method: "PATCH", body: JSON.stringify(secForm) }); setEditSec(null); load() }
    finally { setSaving(false) }
  }
  const startEditItem = (item: HomepageItem) => { setEditItem(item.id); setItemForm({ title: item.title || "", description: item.description || "", icon: item.icon || "", link: item.link || "" }); setEditSec(null) }
  const saveItem = async (id: string) => {
    setSaving(true)
    try { await api(`/homepage/items/${id}`, { method: "PATCH", body: JSON.stringify(itemForm) }); setEditItem(null); load() }
    finally { setSaving(false) }
  }
  const inp = "w-full rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green"

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Bosh sahifa boshqaruvi</h2>
          <p className="mt-1 text-sm text-muted">Sayt kontenti: sarlavhalar, matnlar, aloqa ma'lumotlari va linklarni tahrirlang.</p>
        </div>
        <button onClick={() => runRefresh(load)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 px-4 py-2 text-sm font-bold transition-colors hover:border-green hover:text-green disabled:opacity-60">
          <Icon d={I.refresh} className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Yangilanmoqda…" : "Yangilash"}
        </button>
      </div>
      {loading && <div className="mt-5"><SkeletonTable rows={5} cols={3} /></div>}
      {!loading && sections.length === 0 && <div className="mt-5 rounded-2xl border border-green/10 bg-white py-12 text-center text-muted">Bo'limlar topilmadi.</div>}
      <div className="mt-5 space-y-4">
        {sections.map((s) => (
          <div key={s.id} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => toggleSection(s)} disabled={mutating} title="Ko'rsatish/yashirish" className="disabled:opacity-50">
                  {s.is_active
                    ? <span className="inline-flex items-center gap-1 rounded-md bg-green/10 px-2 py-1 text-[11px] font-bold text-green"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Ko'rinadi</span>
                    : <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Yashirin</span>}
                </button>
                <div className="min-w-0">
                  <h3 className="font-display font-bold truncate">{s.title || s.section_key}</h3>
                  {s.subtitle && <span className="block text-xs text-muted truncate">{s.subtitle}</span>}
                </div>
              </div>
              <button onClick={() => startEditSec(s)} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-green/25 px-3 py-1.5 text-xs font-bold text-green hover:bg-green hover:text-white">
                <Icon d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" className="h-3.5 w-3.5" /> Tahrirlash
              </button>
            </div>

            {editSec === s.id && (
              <div className="mt-4 space-y-2 rounded-xl bg-soft p-3">
                <div><label className="text-xs font-semibold text-muted">Sarlavha</label><input value={secForm.title} onChange={(e) => setSecForm((f) => ({ ...f, title: e.target.value }))} className={inp} /></div>
                <div><label className="text-xs font-semibold text-muted">Tavsif / matn</label><textarea value={secForm.subtitle} onChange={(e) => setSecForm((f) => ({ ...f, subtitle: e.target.value }))} rows={2} className={inp + " resize-none"} /></div>
                <div className="flex gap-2">
                  <button onClick={() => saveSec(s.id)} disabled={saving} className="rounded-lg bg-green px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "Saqlanmoqda..." : "Saqlash"}</button>
                  <button onClick={() => setEditSec(null)} className="rounded-lg border border-green/25 px-4 py-2 text-xs font-bold">Bekor</button>
                </div>
              </div>
            )}

            {s.items && s.items.length > 0 && (
              <div className="mt-4 space-y-2">
                {s.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-green/8 bg-[#fafdf7] px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleItem(item)} disabled={mutating} className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold disabled:opacity-50 ${item.is_active ? "bg-green/10 text-green" : "bg-slate-100 text-slate-500"}`}>
                        {item.is_active ? "Ko'rinadi" : "Yashirin"}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium">{item.title || item.item_key}</span>
                        {item.description && <span className="block truncate text-xs text-muted">{item.description}</span>}
                      </div>
                      {item.icon && <span className="rounded-md bg-soft px-2 py-0.5 text-[10px] font-bold text-muted">{item.icon}</span>}
                      <button onClick={() => startEditItem(item)} className="shrink-0 grid h-7 w-7 place-items-center rounded-lg border border-green/25 text-green hover:bg-green hover:text-white" title="Tahrirlash">
                        <Icon d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editItem === item.id && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div><label className="text-xs font-semibold text-muted">Sarlavha</label><input value={itemForm.title} onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))} className={inp} /></div>
                        <div><label className="text-xs font-semibold text-muted">Matn / tavsif</label><input value={itemForm.description} onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))} className={inp} /></div>
                        <div><label className="text-xs font-semibold text-muted">Ikon</label><input value={itemForm.icon} onChange={(e) => setItemForm((f) => ({ ...f, icon: e.target.value }))} placeholder="masalan: phone, mail" className={inp} /></div>
                        <div><label className="text-xs font-semibold text-muted">Link</label><input value={itemForm.link} onChange={(e) => setItemForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://..." className={inp} /></div>
                        <div className="sm:col-span-2 flex gap-2">
                          <button onClick={() => saveItem(item.id)} disabled={saving} className="rounded-lg bg-green px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "Saqlanmoqda..." : "Saqlash"}</button>
                          <button onClick={() => setEditItem(null)} className="rounded-lg border border-green/25 px-4 py-2 text-xs font-bold">Bekor</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Roles & Permissions Management ---------- */
type AdminRole = { id: string; name: string; description: string | null; is_system: boolean; priority: number; created_at: string }
type PermissionItem = { id: string; code: string; name: string; resource: string; action: string }

function AdminRoles() {
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [userPassword, setUserPassword] = useState("")
  const [userRole, setUserRole] = useState("admin")
  const [error, setError] = useState("")
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [groupedPerms, setGroupedPerms] = useState<Record<string, PermissionItem[]>>({})
  const [rolePermIds, setRolePermIds] = useState<Set<string>>(new Set())
  const [savingPerms, setSavingPerms] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const loadRoles = () => api<{ roles: AdminRole[] }>("/roles")
    .then((d) => setRoles(d.roles || []))

  const loadPermissions = () => api<{ permissions: PermissionItem[]; grouped: Record<string, PermissionItem[]> }>("/permissions")
    .then((d) => setGroupedPerms(d.grouped || {}))

  const loadAll = () => {
    Promise.all([loadRoles(), loadPermissions()])
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // MUHIM: ilgari pending holati yo'q edi. A rolini ochib, darhol B rolini
  // ochsangiz — B uchun A ning belgilangan ruxsatlari ko'rinib turardi va
  // keyin jimgina almashardi (noto'g'ri ruxsat saqlab yuborish xavfi).
  const [permsLoading, setPermsLoading] = useState(false)
  const loadRolePerms = async (roleId: string) => {
    setPermsLoading(true)
    setRolePermIds(new Set())
    try {
      const d = await api<{ permission_ids: string[] }>(`/role-permissions?role_id=${roleId}`)
      setRolePermIds(new Set(d.permission_ids || []))
    } finally {
      setPermsLoading(false)
    }
  }

  const toggleExpand = (roleId: string) => {
    if (expandedRole === roleId) {
      setExpandedRole(null)
      return
    }
    setExpandedRole(roleId)
    loadRolePerms(roleId)
  }

  const togglePerm = (permId: string) => {
    setRolePermIds((prev) => {
      const next = new Set(prev)
      if (next.has(permId)) next.delete(permId)
      else next.add(permId)
      return next
    })
  }

  const savePerms = async () => {
    if (!expandedRole) return
    setSavingPerms(true)
    try {
      await api("/role-permissions", {
        method: "PUT",
        body: JSON.stringify({ role_id: expandedRole, permission_ids: Array.from(rolePermIds) }),
      })
    } catch { setError("Ruxsatlarni saqlashda xatolik") }
    finally { setSavingPerms(false) }
  }

  const openCreate = () => {
    setUserName("")
    setUserEmail("")
    setUserPassword("")
    setUserRole("admin")
    setError("")
    setShowForm(true)
  }

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) { setError("Ism, email va parol majburiy"); return }
    setSavingUser(true)
    try {
      await api("/users/create", {
        method: "POST",
        body: JSON.stringify({ name: userName.trim(), email: userEmail.trim(), password: userPassword, role: userRole }),
      })
      setShowForm(false)
      loadRoles()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi")
    } finally {
      setSavingUser(false)
    }
  }

  const roleInfo: Record<string, string> = {
    super_admin: "To'liq boshqaruv — barcha ruxsatlar, rollar, foydalanuvchilar",
    admin: "Kundalik boshqaruv — bloggerlar, hamkorlar, yangiliklar, kategoriyalar",
    editor: "Faqat kontent — yangiliklar yozish va tahrirlash",
    company: "Hamkor kabineti — o'z hamkorlik ma'lumotlarini ko'rish",
  }

  const [mutating, runMutation] = useBusy()
  const deleteRole = (r: AdminRole) => {
    if (r.is_system) return
    if (!confirm(`"${r.name}" rolini o'chirishni tasdiqlaysizmi?`)) return
    return runMutation(async () => {
      try {
        await api(`/roles/delete?id=${r.id}`, { method: "DELETE" })
        loadRoles()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Xatolik yuz berdi")
      }
    })
  }
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    const selectable = roles.filter((r) => !r.is_system)
    if (selectedIds.size === selectable.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(selectable.map((r) => r.id)))
  }
  const bulkRemove = () => {
    const ids = Array.from(selectedIds).filter((id) => !roles.find((r) => r.id === id)?.is_system)
    if (!ids.length) return
    setRoles((prev) => prev.filter((r) => !ids.includes(r.id)))
    setSelectedIds(new Set())
    return runMutation(() => Promise.allSettled(ids.map((id) => api(`/roles/delete?id=${id}`, { method: "DELETE" }))).then(() => loadRoles()))
  }

  const resourceLabel: Record<string, string> = {
    auth: "Auth",
    profiles: "Profillar",
    bloggers: "Blogerlar",
    partners: "Hamkorlar",
    news: "Yangiliklar",
    stats: "Statistika",
    socials: "Ijtimoiy tarmoqlar",
    videos: "Videolar",
    contact: "Aloqa",
    newsletter: "Newsletter",
    media: "Media",
    storage: "Storage",
    settings: "Sozlamalar",
    "feature-flags": "Feature Flaglar",
    system: "Tizim",
    ai: "AI",
    workers: "Workerlar",
    queue: "Navbat",
    monitoring: "Monitoring",
    analytics: "Analitika",
    social: "Social",
    cron: "Cron",
    functions: "Funksiyalar",
    deployment: "Deployment",
    notifications: "Bildirishnomalar",
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Rollar va Ruxsatlar</h2>
          <p className="mt-1 text-sm text-muted">Rol yaratish, tahrirlash va ruxsatlarni boshqarish.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
          <Icon d={I.plus} className="h-4 w-4" /> Yangi foydalanuvchi
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading && <SkeletonTable rows={6} cols={5} />}
        {!loading && selectedIds.size > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-sm font-semibold text-red-700">{selectedIds.size} ta rol tanlandi</span>
            <button onClick={bulkRemove} disabled={mutating} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white shadow transition-transform hover:scale-105 disabled:opacity-60">
              <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /> Tanlanganlarni o'chirish
            </button>
          </div>
        )}
        {!loading && roles.length === 0 && <div className="py-8 text-center text-muted">Rollar topilmadi.</div>}
        {!loading && roles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="pb-3 font-semibold w-10">
                    <input type="checkbox" checked={roles.length > 0 && selectedIds.size === roles.length} onChange={toggleAll} className="h-4 w-4 rounded border-green/30 text-green accent-green" />
                  </th>
                  <th className="pb-3 font-semibold">Rol nomi</th>
                  <th className="pb-3 font-semibold">Tavsif</th>
                  <th className="pb-3 font-semibold">Priority</th>
                  <th className="pb-3 font-semibold">Turi</th>
                  <th className="pb-3 font-semibold">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-t border-green/8 text-sm">
                      <td className="py-3 pr-3 w-10">
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} disabled={r.is_system} className="h-4 w-4 rounded border-green/30 text-green accent-green disabled:opacity-30" />
                      </td>
                      <td className="py-3 pr-3 font-semibold">{r.name}</td>
                      <td className="py-3 pr-3 text-muted">{r.description || "—"}</td>
                      <td className="py-3 pr-3">{r.priority}</td>
                      <td className="py-3 pr-3">
                        {r.is_system
                          ? <span className="rounded-md bg-soft px-2 py-1 text-[11px] font-bold text-muted">Tizim</span>
                          : <span className="rounded-md bg-green/10 px-2 py-1 text-[11px] font-bold text-green">Maxsus</span>}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleExpand(r.id)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${expandedRole === r.id ? "bg-green text-white border-green" : "border-green/20 text-green hover:bg-green hover:text-white"}`}>
                            Ruxsatlar
                          </button>
                          {!r.is_system && (
                            <>
                              <button className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-500 hover:bg-blue-50">
                                <Icon d={I.gear} className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => deleteRole(r)} disabled={mutating} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 disabled:opacity-50">
                                <Icon d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1z" className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRole === r.id && (
                      <tr key={`${r.id}-perms`}>
                        <td colSpan={6} className="bg-[#fafdf7] px-4 pb-4">
                          <div className="rounded-xl border border-green/10 bg-white p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="font-display text-sm font-bold">Ruxsatlar: <span className="text-green">{r.name}</span></h4>
                              <button onClick={savePerms} disabled={savingPerms} className="inline-flex items-center gap-1.5 rounded-lg bg-green px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-green-deep disabled:opacity-60">
                                {savingPerms ? "Saqlanmoqda..." : "Ruxsatlarni saqlash"}
                              </button>
                            </div>
                            {/* Ilgari bu shart yuklanish VA xato holatini birga
                                ifodalardi: so'rov muvaffaqiyatsiz bo'lsa matn abadiy turardi. */}
                            {permsLoading && <div className="py-4"><SkeletonTable rows={4} cols={3} /></div>}
                            {!permsLoading && Object.keys(groupedPerms).length === 0 && (
                              <div className="py-4 text-center text-sm text-red-600">Ruxsatlar ro'yxatini yuklab bo'lmadi.</div>
                            )}
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {!permsLoading && Object.entries(groupedPerms).map(([resource, perms]) => (
                                <div key={resource} className="rounded-lg border border-green/8 bg-[#fafdf7] p-3">
                                  <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">{resourceLabel[resource] || resource}</h5>
                                  <div className="space-y-1.5">
                                    {perms.map((p) => (
                                      <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-green/5">
                                        <input
                                          type="checkbox"
                                          checked={rolePermIds.has(p.id)}
                                          onChange={() => togglePerm(p.id)}
                                          className="h-3.5 w-3.5 rounded border-green/30 text-green accent-green"
                                        />
                                        <span className="font-medium">{p.name}</span>
                                        <span className="ml-auto text-[10px] text-muted">{p.action}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-extrabold">Yangi foydalanuvchi qo'shish</h3>
            <form onSubmit={saveUser} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Rolni tanlang</label>
                <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green">
                  {["super_admin", "admin", "editor", "company"].map((r) => (
                    <option key={r} value={r}>{r.replace("_", " ")}</option>
                  ))}
                </select>
                {userRole && <p className="mt-1.5 text-xs text-muted">{roleInfo[userRole]}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Ism</label>
                <input value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" placeholder="Foydalanuvchi ismi" required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Email</label>
                <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} type="email" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" placeholder="email@example.com" required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Parol</label>
                <input value={userPassword} onChange={(e) => setUserPassword(e.target.value)} type="password" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" placeholder="Kamida 6 belgi" required />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border-2 border-green/30 px-6 py-2.5 text-sm font-bold text-ink transition-colors hover:border-green hover:text-green">Bekor qilish</button>
                <button type="submit" disabled={savingUser} className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105 disabled:opacity-60">
                  {savingUser && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {savingUser ? "Yaratilmoqda…" : "Yaratish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const EDITOR_SECTIONS = ["Yangiliklar", "Kategoriyalar", "Bosh sahifa", "Manbalar", "Statistika", "Monitoring", "Topshiriqlar"]
const ADMIN_HIDDEN = ["Rollar", "Foydalanuvchilar"]
const roleLabels: Record<string, string> = { super_admin: "Super Admin", admin: "Administrator", editor: "Muharrir" }

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const adminRole = user?.adminRole || "super_admin"
  const visibleNav =
    adminRole === "editor" ? nav.filter((n) => EDITOR_SECTIONS.includes(n.label))
    : adminRole === "admin" ? nav.filter((n) => !ADMIN_HIDDEN.includes(n.label))
    : nav
  const [active, setActive] = useState(visibleNav[0]?.label || "Dashboard")
  const nav2 = useNavigate()
  const initials = (user?.name || "AD").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const doLogout = () => { logout(); nav2("/kirish") }

  const renderSection = () => {
    // Ruxsat yo'q bo'limga kirilsa — birinchi ruxsatli bo'limga qaytarish
    if (!visibleNav.some((n) => n.label === active)) return null
    switch (active) {
      case "Dashboard": return <Overview />
      case "Bloggerlar": return <Bloggers />
      case "Topshiriqlar": return <AdminTasks />
      case "Hamkorlar": return <AdminPartners />
      case "Yangiliklar": return <AdminNews />
      case "Kategoriyalar": return <AdminCategories />
      case "Rollar": return <AdminRoles />
      case "Bosh sahifa": return <AdminHomepage />
      case "Manbalar": return <AdminNewsSources />
      case "Foydalanuvchilar": return <AdminUsers />
      case "Xabarlar": return <AdminContacts />
      case "Obunachilar": return <AdminSubscribers />
      case "Jamoa": return <AdminTeam />
      case "Statistika": return <StatsEditor />
      case "Sozlamalar": return <AdminSettings />
      case "Monitoring": return <AdminMonitoring />
      default: return <Placeholder title={active} />
    }
  }

  return (
    <DashboardLayout nav={visibleNav} active={active} onNav={setActive} onLogout={doLogout} user={{ name: user?.name || "Admin", role: roleLabels[adminRole] || "Admin", initials }}>
      {renderSection()}
    </DashboardLayout>
  )
}
