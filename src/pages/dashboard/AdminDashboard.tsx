import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import DashboardLayout, { LineChart } from "../../components/DashboardLayout"
import { Icon, I, statIcon, type StatItem, fmtSom } from "../../lib/ui"
import { categories } from "../../lib/bloggers"
import { api } from "../../lib/api"
import { useAuth } from "../../lib/auth"

const nav = [
  { label: "Dashboard", icon: I.dashboard },
  { label: "Bloggerlar", icon: I.users },
  { label: "Hamkorlar", icon: I.handshake },
  { label: "Yangiliklar", icon: I.doc },
  { label: "Kategoriyalar", icon: I.grid },
  { label: "Bosh sahifa", icon: I.dashboard },
  { label: "Manbalar", icon: I.globe },
  { label: "Foydalanuvchilar", icon: I.users },
  { label: "Xabarlar", icon: I.doc },
  { label: "Obunachilar", icon: I.users },
  { label: "Statistika", icon: I.chart },
  { label: "Sozlamalar", icon: I.gear },
  { label: "Monitoring", icon: I.chart },
]

const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"
const catLabel = (k: string) => categories.find((c) => c.key === k)?.label ?? k

type Row = { id: number; name: string; cat: string; region: string; email: string; status: string }

/* ---------- Blogger management ---------- */
function Bloggers() {
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const blank = { name: "", email: "", cat: "fermerlik", region: "", password: "" }
  const [form, setForm] = useState(blank)

  const reload = () => api<{ bloggers: Row[] }>("/bloggers").then((d) => setRows(d.bloggers)).catch(() => {})
  useEffect(() => { reload() }, [])

  const list = useMemo(
    () => rows.filter((r) => !query.trim() || r.name.toLowerCase().includes(query.toLowerCase()) || r.email.toLowerCase().includes(query.toLowerCase())),
    [rows, query],
  )

  const register = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { setError("Ism, email va parol majburiy"); return }
    try {
      await api("/bloggers", { method: "POST", body: JSON.stringify({ name: form.name, email: form.email, password: form.password, region: form.region, niche: form.cat }) })
      setForm(blank); setAdding(false); reload()
    } catch (err: any) { setError(err?.message || "Xatolik") }
  }
  const remove = async (id: number) => {
    if (!confirm("Bu blogerni o'chirishni tasdiqlaysizmi?")) return
    await api(`/bloggers/${id}`, { method: "DELETE" }); reload()
  }
  const toggle = async (r: Row) => {
    await api(`/bloggers/${r.id}/status`, { method: "PATCH", body: JSON.stringify({ status: r.status === "active" ? "pending" : "active" }) })
    reload()
  }

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

      {adding && (
        <form onSubmit={register} className="mt-5 rounded-2xl border border-green/15 bg-soft p-5">
          {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Bloger ismi" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <input value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="Hudud" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <select value={form.cat} onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))} className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none">
              {categories.filter((c) => c.key !== "all").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Boshlang'ich parol" type="password" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <button type="submit" className="rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white">Ro'yxatdan o'tkazish</button>
          </div>
        </form>
      )}

      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        <div className="relative mb-4 max-w-sm">
          <Icon d={I.search} className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Bloger qidirish..." className="w-full rounded-xl border border-green/15 bg-[#f7faf4] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-green" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="pb-3 font-semibold">Bloger</th>
                <th className="pb-3 font-semibold">Yo'nalish</th>
                <th className="pb-3 font-semibold">Hudud</th>
                <th className="pb-3 font-semibold">Holati</th>
                <th className="pb-3 font-semibold">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-muted">Bloger yo'q. "Yangi bloger qo'shish" orqali qo'shing.</td></tr>
              )}
              {list.map((r) => (
                <tr key={r.id} className="border-t border-green/8 text-sm">
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green/10 font-display text-xs font-bold text-green">{r.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                      <span><span className="block font-semibold">{r.name}</span><span className="block text-xs text-muted">{r.email}</span></span>
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-muted">{catLabel(r.cat)}</td>
                  <td className="py-3 pr-3 text-muted">{r.region || "—"}</td>
                  <td className="py-3 pr-3">
                    <button onClick={() => toggle(r)} title="Holatni o'zgartirish">
                      {r.status === "active"
                        ? <span className="inline-flex items-center gap-1 rounded-md bg-green/10 px-2 py-1 text-[11px] font-bold text-green"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Faol</span>
                        : <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-600"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Kutilmoqda</span>}
                    </button>
                  </td>
                  <td className="py-3">
                    <span className="flex gap-1.5">
                      <button className="grid h-8 w-8 place-items-center rounded-lg border border-green/15 text-muted hover:text-green" title="Tahrirlash"><Icon d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" className="h-4 w-4" /></button>
                      <button onClick={() => remove(r.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500" title="O'chirish"><Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /></button>
                    </span>
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

/* ---------- Partners (hamkorlar) management ---------- */
type Task = { id: number; title: string; status: "done" | "progress" | "pending" }
type PartnerClient = { id: number; name: string; email: string }
type Partner = { id: number; name: string; sphere: string; contractNo: string; amount: number; signedDate: string; status: string; tasks: Task[]; client: PartnerClient | null }

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
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const [taskDrafts, setTaskDrafts] = useState<Record<number, string>>({})
  const [clientDrafts, setClientDrafts] = useState<Record<number, { email: string; password: string }>>({})
  const [openClient, setOpenClient] = useState<Record<number, boolean>>({})
  const [clientErr, setClientErr] = useState<Record<number, string>>({})
  const blank = { name: "", sphere: "", contractNo: "", amount: "", status: "active" }
  const [form, setForm] = useState(blank)

  const reload = () => api<{ partners: Partner[] }>("/partners").then((d) => setList(d.partners)).catch(() => {})
  useEffect(() => { reload() }, [])

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
    e.preventDefault(); setError("")
    if (!form.name.trim() || !form.contractNo.trim()) { setError("Tashkilot nomi va shartnoma raqami majburiy"); return }
    try {
      await api("/partners", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount) || 0 }) })
      setForm(blank); setAdding(false); reload()
    } catch (err: any) { setError(err?.message || "Xatolik") }
  }
  const remove = async (id: number) => { if (confirm("Hamkorni o'chirishni tasdiqlaysizmi?")) { await api(`/partners/${id}`, { method: "DELETE" }); reload() } }
  const cycleTask = async (pid: number, tid: number) => { await api(`/partners/${pid}/tasks/${tid}`, { method: "PATCH", body: "{}" }); reload() }
  const removeTask = async (pid: number, tid: number) => { await api(`/partners/${pid}/tasks/${tid}`, { method: "DELETE" }); reload() }
  const addTask = async (pid: number) => {
    const title = (taskDrafts[pid] || "").trim(); if (!title) return
    await api(`/partners/${pid}/tasks`, { method: "POST", body: JSON.stringify({ title }) })
    setTaskDrafts((d) => ({ ...d, [pid]: "" })); reload()
  }
  const createClient = async (p: Partner) => {
    const draft = clientDrafts[p.id] || { email: "", password: "" }
    if (!draft.email.trim() || !draft.password.trim()) { setClientErr((e) => ({ ...e, [p.id]: "Email va parol majburiy" })); return }
    try {
      await api(`/partners/${p.id}/client`, { method: "POST", body: JSON.stringify({ name: p.name, email: draft.email, password: draft.password }) })
      setClientDrafts((d) => ({ ...d, [p.id]: { email: "", password: "" } }))
      setClientErr((e) => ({ ...e, [p.id]: "" })); setOpenClient((o) => ({ ...o, [p.id]: false })); reload()
    } catch (err: any) { setClientErr((e) => ({ ...e, [p.id]: err?.message || "Xatolik" })) }
  }
  const removeClient = async (pid: number) => {
    if (!confirm("Mijoz loginini o'chirishni tasdiqlaysizmi?")) return
    await api(`/partners/${pid}/client`, { method: "DELETE" }); reload()
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

      {/* add form */}
      {adding && (
        <form onSubmit={add} className="mt-5 rounded-2xl border border-green/15 bg-soft p-5">
          {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tashkilot nomi" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <input value={form.sphere} onChange={(e) => setForm((f) => ({ ...f, sphere: e.target.value }))} placeholder="Yo'nalish (masalan: O'g'itlar)" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <input value={form.contractNo} onChange={(e) => setForm((f) => ({ ...f, contractNo: e.target.value }))} placeholder="Shartnoma raqami" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Summa (so'm)" type="number" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none">
              <option value="active">Faol</option>
              <option value="pending">Kutilmoqda</option>
              <option value="completed">Yakunlangan</option>
            </select>
            <button type="submit" className="rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white">Qo'shish</button>
          </div>
        </form>
      )}

      {/* partner cards */}
      <div className="mt-5 space-y-4">
        {list.length === 0 && <div className="rounded-2xl border border-green/10 bg-white py-12 text-center text-muted">Hamkor yo'q. "Yangi hamkor qo'shish" orqali qo'shing.</div>}
        {list.map((p) => {
          const ps = partnerStatusMeta[p.status] || partnerStatusMeta.active
          const done = p.tasks.filter((t) => t.status === "done").length
          const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0
          return (
            <div key={p.id} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-soft text-green"><Icon d={I.building} className="h-6 w-6" /></span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold">{p.name}</h3>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${ps.cls}`}>{ps.label}</span>
                    </div>
                    <p className="text-sm text-muted">{p.sphere}</p>
                  </div>
                </div>
                <button onClick={() => remove(p.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500" title="O'chirish">
                  <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" />
                </button>
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
                        <button onClick={() => cycleTask(p.id, t.id)} title="Holatni o'zgartirish" className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold ${tm.cls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tm.dot}`} /> {tm.label}
                        </button>
                        <span className={`flex-1 text-sm ${t.status === "done" ? "text-muted line-through" : ""}`}>{t.title}</span>
                        <button onClick={() => removeTask(p.id, t.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-red-400 hover:bg-red-50"><Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" /></button>
                      </div>
                    )
                  })}
                </div>
                {/* add task */}
                <div className="mt-2 flex gap-2">
                  <input value={taskDrafts[p.id] || ""} onChange={(e) => setTaskDrafts((d) => ({ ...d, [p.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addTask(p.id)} placeholder="Yangi vazifa qo'shish..." className="flex-1 rounded-lg border border-green/15 bg-white px-3 py-2 text-sm outline-none focus:border-green" />
                  <button onClick={() => addTask(p.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-green/20 px-3 py-2 text-xs font-bold text-green hover:bg-green hover:text-white"><Icon d={I.plus} className="h-4 w-4" /> Vazifa</button>
                </div>
              </div>

              {/* client (buyurtmachi) login */}
              <div className="mt-4 rounded-xl border border-green/15 bg-[#fafdf7] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-green/10 text-green"><Icon d={I.user} className="h-5 w-5" /></span>
                    <div>
                      <div className="text-sm font-bold">Mijoz kabineti</div>
                      <div className="text-xs text-muted">{p.client ? "Buyurtmachi ishlarini kuzata oladi" : "Login yarating — buyurtmachi o'ziga qilingan ishlarni ko'radi"}</div>
                    </div>
                  </div>
                  {p.client ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-green/10 px-2.5 py-1 text-xs font-bold text-green"><Icon d={I.check} className="h-3.5 w-3.5" /> {p.client.email}</span>
                      <button onClick={() => removeClient(p.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500" title="Loginni o'chirish"><Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" /></button>
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
                      <input value={clientDrafts[p.id]?.email || ""} onChange={(e) => setClientDrafts((d) => ({ ...d, [p.id]: { ...(d[p.id] || { email: "", password: "" }), email: e.target.value } }))} placeholder="Mijoz emaili" type="email" className="rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green" />
                      <input value={clientDrafts[p.id]?.password || ""} onChange={(e) => setClientDrafts((d) => ({ ...d, [p.id]: { ...(d[p.id] || { email: "", password: "" }), password: e.target.value } }))} placeholder="Boshlang'ich parol" type="password" className="rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green" />
                      <button onClick={() => createClient(p)} className="rounded-lg bg-green px-4 py-2 text-sm font-bold text-white">Yaratish</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Overview() {
  const [bloggerCount, setBloggerCount] = useState<number | null>(null)
  const [partnerCount, setPartnerCount] = useState<number | null>(null)
  const [newsCount, setNewsCount] = useState<number | null>(null)
  const [subscribers, setSubscribers] = useState<number | null>(null)
  const [recentNews, setRecentNews] = useState<{ title: string; created_at: string }[]>([])

  useEffect(() => {
    api<{ bloggers: unknown[] }>("/bloggers").then((d) => setBloggerCount(d.bloggers.length)).catch(() => {})
    api<{ partners: unknown[] }>("/partners").then((d) => setPartnerCount(d.partners.length)).catch(() => {})
    api<{ pagination: { total: number } }>("/news?per_page=1").then((d) => setNewsCount(d.pagination?.total || 0)).catch(() => {})
    api<{ subscribers: unknown[] }>("/subscribers").then((d) => setSubscribers(d.subscribers.length)).catch(() => {})
    api<{ news: { title: string; created_at: string }[] }>("/news?per_page=4").then((d) => setRecentNews(d.news || [])).catch(() => {})
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
          <div className="mt-4"><LineChart points={[40, 55, 70, 85, 100, 128]} labels={["Noy", "Dek", "Yan", "Fev", "Mar", "Apr"]} /></div>
        </div>
        <div className={card}>
          <h3 className="font-display text-lg font-bold">So'nggi yangiliklar</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {recentNews.length > 0 ? recentNews.map((n, i) => (
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
  const [loading, setLoading] = useState(false)

  const load = (p = page) => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(p), per_page: "12" })
    if (query.trim()) q.set("search", query.trim())
    api<{ data: NewsArticle[]; pagination: { total: number } }>(`/news?${q}`)
      .then((d) => { setArticles(d.data || []); setTotal(d.pagination?.total || 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1); setPage(1) }, [query])
  useEffect(() => { load() }, [page])

  const remove = async (id: string) => {
    if (!confirm("Yangilikni o'chirishni tasdiqlaysizmi?")) return
    await api(`/news/${id}`, { method: "DELETE" })
    load()
  }

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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Yangilik qidirish..." className="w-full rounded-xl border border-green/15 bg-[#f7faf4] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-green" />
        </div>

        {loading && <div className="py-8 text-center text-muted">Yuklanmoqda…</div>}

        {!loading && articles.length === 0 && (
          <div className="py-8 text-center text-muted">Yangiliklar topilmadi.</div>
        )}

        {!loading && articles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
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
                      <button onClick={() => remove(a.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500" title="O'chirish">
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
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = () => {
    setLoading(true)
    api<{ settings: Setting[] }>("/settings")
      .then((d) => setSettings(d.settings || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const set = (i: number, field: "value", v: string) =>
    setSettings((arr) => arr.map((s, idx) => (idx === i ? { ...s, [field]: v } : s)))

  const save = async () => {
    for (const s of settings) {
      await api(`/settings/${s.id}`, { method: "PATCH", body: JSON.stringify({ value: s.value }) })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Sozlamalar</h2>
          <p className="mt-1 text-sm text-muted">Platforma sozlamalarini boshqarish.</p>
        </div>
        <button onClick={save} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60">
          <Icon d={I.check} className="h-4 w-4" /> Saqlash
        </button>
      </div>

      {saved && <div className="mt-4 flex items-center gap-2 rounded-xl bg-green/10 px-4 py-3 text-sm font-semibold text-green"><Icon d={I.check} className="h-4 w-4" /> Saqlandi!</div>}

      {loading && <div className="py-8 text-center text-muted">Yuklanmoqda…</div>}

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

/* ---------- Monitoring ---------- */
function AdminMonitoring() {
  const [newsJobs, setNewsJobs] = useState<{ id: string; job_type: string; status: string; created_at: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [engineBusy, setEngineBusy] = useState(false)
  const [engineResult, setEngineResult] = useState("")

  const load = () => {
    setLoading(true)
    api<{ jobs: { id: string; job_type: string; status: string; created_at: string }[] }>("/news/jobs")
      .then((d) => setNewsJobs(d.jobs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const retry = async (id: string) => {
    await api(`/news/jobs/${id}/retry`, { method: "POST" })
    load()
  }

  const runEngine = async () => {
    setEngineBusy(true)
    setEngineResult("")
    try {
      const d = await api<{ published: number; target: number; fetched: number; results: string[] }>(
        "/ai-news-engine",
        { method: "POST" }
      )
      setEngineResult(`✅ ${d.published} ta yangilik yaratildi (${d.fetched} ta manbadan). Kunlik target: ${d.target}`)
      load()
    } catch (e: any) {
      setEngineResult(`❌ Xatolik: ${e?.message || "Noma'lum xatolik"}`)
    } finally {
      setEngineBusy(false)
    }
  }

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
          <button onClick={runEngine} disabled={engineBusy} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60">
            <Icon d={I.bolt} className="h-4 w-4" /> {engineBusy ? "Yuklanmoqda…" : "AI Yangiliklar Yig'ish"}
          </button>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 px-4 py-2 text-sm font-bold transition-colors hover:border-green hover:text-green">
            <Icon d={I.refresh} className="h-4 w-4" /> Yangilash
          </button>
        </div>
      </div>
      {engineResult && (
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${engineResult.startsWith("✅") ? "bg-green/10 text-green" : "bg-red-50 text-red-600"}`}>{engineResult}</div>
      )}

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
        {loading && <div className="py-8 text-center text-muted">Yuklanmoqda…</div>}
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
                  <button onClick={() => retry(j.id)} className="rounded-lg border border-green/20 px-2.5 py-1 text-xs font-bold text-green hover:bg-green hover:text-white">Qayta</button>
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

  const reload = () => api<{ sources: NewsSource[] }>("/news-sources").then((d) => setSources(d.sources || [])).catch(() => {})
  useEffect(() => { reload() }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError("")
    if (!form.name.trim() || !form.url.trim()) { setError("Nomi va URL majburiy"); return }
    try {
      await api("/news-sources", { method: "POST", body: JSON.stringify(form) })
      setForm(blank); setAdding(false); reload()
    } catch (err: any) { setError(err?.message || "Xatolik") }
  }
  const remove = async (id: string) => {
    if (!confirm("Manbani o'chirishni tasdiqlaysizmi?")) return
    await api(`/news-sources/${id}`, { method: "DELETE" }); reload()
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
            <button type="submit" className="rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white">Qo'shish</button>
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
              {sources.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-muted">Manba yo'q. "Yangi manba qo'shish" orqali qo'shing.</td></tr>
              )}
              {sources.map((s) => (
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

function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    api<{ users: AdminUser[] }>("/users")
      .then((d) => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const toggleStatus = async (u: AdminUser) => {
    const newStatus = u.status === "active" ? "suspended" : "active"
    await api(`/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) })
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
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 px-4 py-2 text-sm font-bold transition-colors hover:border-green hover:text-green">
          <Icon d={I.refresh} className="h-4 w-4" /> Yangilash
        </button>
      </div>
      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading && <div className="py-8 text-center text-muted">Yuklanmoqda…</div>}
        {!loading && users.length === 0 && <div className="py-8 text-center text-muted">Foydalanuvchilar topilmadi.</div>}
        {!loading && users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
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
                    <td className="py-3 pr-3"><span className={`rounded-md px-2 py-1 text-[11px] font-bold ${roleColors[u.role] || "bg-slate-100 text-slate-500"}`}>{u.role}</span></td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${u.status === "active" ? "bg-green/10 text-green" : "bg-red-100 text-red-500"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${u.status === "active" ? "bg-green" : "bg-red-500"}`} />
                        {u.status === "active" ? "Faol" : "To'xtatilgan"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-muted text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString("uz") : "—"}</td>
                    <td className="py-3">
                      <button onClick={() => toggleStatus(u)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${u.status === "active" ? "border-red-200 text-red-500 hover:bg-red-50" : "border-green/20 text-green hover:bg-green hover:text-white"}`}>
                        {u.status === "active" ? "To'xtatish" : "Faollashtirish"}
                      </button>
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
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ContactMessage | null>(null)

  const load = () => {
    setLoading(true)
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

  const remove = async (id: string) => {
    if (!confirm("Xabarni o'chirishni tasdiqlaysizmi?")) return
    await api(`/messages/${id}`, { method: "DELETE" })
    setSelected(null)
    load()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Aloqa xabarlari</h2>
          <p className="mt-1 text-sm text-muted">Foydalanuvchilardan kelgan xabarlar.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 px-4 py-2 text-sm font-bold transition-colors hover:border-green hover:text-green">
          <Icon d={I.refresh} className="h-4 w-4" /> Yangilash
        </button>
      </div>
      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading && <div className="py-8 text-center text-muted">Yuklanmoqda…</div>}
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
                      <button onClick={() => remove(m.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500"><Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /></button>
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    api<{ subscribers: Subscriber[] }>("/subscribers")
      .then((d) => setSubs(d.subscribers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const remove = async (id: string) => {
    if (!confirm("Obunachini o'chirishni tasdiqlaysizmi?")) return
    await api(`/subscribers/${id}`, { method: "DELETE" })
    load()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Obunachilar</h2>
          <p className="mt-1 text-sm text-muted">Newsletter obunachilari ro'yxati.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 px-4 py-2 text-sm font-bold transition-colors hover:border-green hover:text-green">
          <Icon d={I.refresh} className="h-4 w-4" /> Yangilash
        </button>
      </div>
      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading && <div className="py-8 text-center text-muted">Yuklanmoqda…</div>}
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
                      <button onClick={() => remove(s.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500"><Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /></button>
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
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const blank = { key: "", name_uz: "", name_ru: "", name_en: "" }
  const [form, setForm] = useState(blank)

  const load = () => api<{ categories: NewsCategory[] }>("/categories").then((d) => setCats(d.categories || [])).catch(() => {})
  useEffect(() => { load() }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError("")
    if (!form.key.trim() || !form.name_uz.trim()) { setError("Kalit va nomi majburiy"); return }
    try {
      await api("/categories", { method: "POST", body: JSON.stringify(form) })
      setForm(blank); setAdding(false); load()
    } catch (err: any) { setError(err?.message || "Xatolik") }
  }
  const remove = async (id: string) => {
    if (!confirm("Kategoriyani o'chirishni tasdiqlaysizmi?")) return
    await api(`/categories/${id}`, { method: "DELETE" }); load()
  }
  const toggle = async (c: NewsCategory) => {
    await api(`/categories/${c.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !c.is_active }) })
    load()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Kategoriyalar</h2>
          <p className="mt-1 text-sm text-muted">Yangiliklar kategoriyalarini boshqarish.</p>
        </div>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105">
          <Icon d={I.plus} className="h-4 w-4" /> Yangi kategoriya
        </button>
      </div>
      {adding && (
        <form onSubmit={add} className="mt-5 rounded-2xl border border-green/15 bg-soft p-5">
          {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} placeholder="Kalit (masalan: texnologiya)" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <input value={form.name_uz} onChange={(e) => setForm((f) => ({ ...f, name_uz: e.target.value }))} placeholder="Nomi (uz)" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <input value={form.name_ru} onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))} placeholder="Nomi (ru)" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <input value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} placeholder="Nomi (en)" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
            <button type="submit" className="rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white">Qo'shish</button>
          </div>
        </form>
      )}
      <div className="mt-5 min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="pb-3 font-semibold">Kalit</th>
                <th className="pb-3 font-semibold">Nomi (uz)</th>
                <th className="pb-3 font-semibold">Nomi (ru)</th>
                <th className="pb-3 font-semibold">Nomi (en)</th>
                <th className="pb-3 font-semibold">Holat</th>
                <th className="pb-3 font-semibold">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {cats.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted">Kategoriya yo'q.</td></tr>}
              {cats.map((c) => (
                <tr key={c.id} className="border-t border-green/8 text-sm">
                  <td className="py-3 pr-3 font-mono text-xs text-muted">{c.key}</td>
                  <td className="py-3 pr-3 font-semibold">{c.name_uz}</td>
                  <td className="py-3 pr-3 text-muted">{c.name_ru}</td>
                  <td className="py-3 pr-3 text-muted">{c.name_en}</td>
                  <td className="py-3 pr-3">
                    <button onClick={() => toggle(c)}>
                      {c.is_active
                        ? <span className="inline-flex items-center gap-1 rounded-md bg-green/10 px-2 py-1 text-[11px] font-bold text-green"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Faol</span>
                        : <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Nofaol</span>}
                    </button>
                  </td>
                  <td className="py-3">
                    <button onClick={() => remove(c.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500"><Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6" className="h-4 w-4" /></button>
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

/* ---------- Homepage Management ---------- */
type HomepageSection = { id: string; section_key: string; title: string; is_visible: boolean; items: HomepageItem[] }
type HomepageItem = { id: string; section_id: string; title: string; subtitle: string; value: string; icon: string; image_url: string; sort_order: number; is_visible: boolean }

function AdminHomepage() {
  const [sections, setSections] = useState<HomepageSection[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    api<{ sections: HomepageSection[] }>("/homepage")
      .then((d) => setSections(d.sections || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const toggleSection = async (s: HomepageSection) => {
    await api(`/homepage/sections/${s.id}`, { method: "PATCH", body: JSON.stringify({ is_visible: !s.is_visible }) })
    load()
  }
  const toggleItem = async (item: HomepageItem) => {
    await api(`/homepage/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ is_visible: !item.is_visible }) })
    load()
  }
  const updateSection = async (s: HomepageSection, title: string) => {
    await api(`/homepage/sections/${s.id}`, { method: "PATCH", body: JSON.stringify({ title }) })
  }
  const updateItem = async (item: HomepageItem, field: string, value: string) => {
    await api(`/homepage/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ [field]: value }) })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Bosh sahifa boshqaruvi</h2>
          <p className="mt-1 text-sm text-muted">Bosh sahifadagi bo'limlar va elementlarni boshqarish.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 px-4 py-2 text-sm font-bold transition-colors hover:border-green hover:text-green">
          <Icon d={I.refresh} className="h-4 w-4" /> Yangilash
        </button>
      </div>
      {loading && <div className="mt-5 py-8 text-center text-muted">Yuklanmoqda…</div>}
      {!loading && sections.length === 0 && <div className="mt-5 rounded-2xl border border-green/10 bg-white py-12 text-center text-muted">Bo'limlar topilmadi.</div>}
      <div className="mt-5 space-y-4">
        {sections.map((s) => (
          <div key={s.id} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => toggleSection(s)}>
                  {s.is_visible
                    ? <span className="inline-flex items-center gap-1 rounded-md bg-green/10 px-2 py-1 text-[11px] font-bold text-green"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Ko'rinadi</span>
                    : <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Yashirin</span>}
                </button>
                <div>
                  <h3 className="font-display font-bold">{s.title || s.section_key}</h3>
                  <span className="text-xs text-muted">{s.section_key}</span>
                </div>
              </div>
              <span className="text-xs text-muted">{s.items?.length || 0} ta element</span>
            </div>
            {s.items && s.items.length > 0 && (
              <div className="mt-4 space-y-2">
                {s.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-green/8 bg-[#fafdf7] px-3 py-2.5">
                    <button onClick={() => toggleItem(item)} className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${item.is_visible ? "bg-green/10 text-green" : "bg-slate-100 text-slate-500"}`}>
                      {item.is_visible ? "Ko'rinadi" : "Yashirin"}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium">{item.title || item.subtitle || item.value || item.section_id}</span>
                      {item.subtitle && <span className="block text-xs text-muted">{item.subtitle}</span>}
                    </div>
                    {item.icon && <span className="rounded-md bg-soft px-2 py-0.5 text-[10px] font-bold text-muted">{item.icon}</span>}
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

export default function AdminDashboard() {
  const [active, setActive] = useState("Dashboard")
  const { user, logout } = useAuth()
  const nav2 = useNavigate()
  const initials = (user?.name || "AD").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const doLogout = () => { logout(); nav2("/kirish") }

  const renderSection = () => {
    switch (active) {
      case "Dashboard": return <Overview />
      case "Bloggerlar": return <Bloggers />
      case "Hamkorlar": return <AdminPartners />
      case "Yangiliklar": return <AdminNews />
      case "Kategoriyalar": return <AdminCategories />
      case "Bosh sahifa": return <AdminHomepage />
      case "Manbalar": return <AdminNewsSources />
      case "Foydalanuvchilar": return <AdminUsers />
      case "Xabarlar": return <AdminContacts />
      case "Obunachilar": return <AdminSubscribers />
      case "Statistika": return <StatsEditor />
      case "Sozlamalar": return <AdminSettings />
      case "Monitoring": return <AdminMonitoring />
      default: return <Placeholder title={active} />
    }
  }

  return (
    <DashboardLayout nav={nav} active={active} onNav={setActive} onLogout={doLogout} user={{ name: user?.name || "Admin", role: "Super Admin", initials }}>
      {renderSection()}
    </DashboardLayout>
  )
}
