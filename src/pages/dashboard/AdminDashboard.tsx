import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import DashboardLayout, { LineChart } from "../../components/DashboardLayout"
import { Icon, I } from "../../lib/ui"
import { categories } from "../../lib/bloggers"
import { api } from "../../lib/api"
import { useAuth } from "../../lib/auth"

const nav = [
  { label: "Dashboard", icon: I.dashboard },
  { label: "Bloggerlar", icon: I.users },
  { label: "Hamkorlar", icon: I.handshake },
  { label: "Yangiliklar", icon: I.doc },
  { label: "Statistika", icon: I.chart },
  { label: "Sozlamalar", icon: I.gear },
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
            <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Boshlang'ich parol" type="text" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
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
type Partner = { id: number; name: string; sphere: string; contractNo: string; amount: number; signedDate: string; status: string; tasks: Task[] }

const fmtSom = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + " mlrd"
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + " mln"
  return n.toLocaleString("ru-RU")
}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Overview() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => { api<{ bloggers: any[] }>("/bloggers").then((d) => setCount(d.bloggers.length)).catch(() => {}) }, [])
  const stats = [
    { icon: I.users, t: "Jami bloggerlar", v: count === null ? "…" : String(count), delta: "real-time" },
    { icon: I.handshake, t: "Hamkorlar", v: "50", delta: "+2 bu oy" },
    { icon: I.doc, t: "Yangiliklar", v: "128", delta: "+12 bu oy" },
    { icon: I.eye, t: "Oylik tashriflar", v: "1.2M", delta: "+8.4%" },
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
          <h3 className="font-display text-lg font-bold">So'nggi harakatlar</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {[["Yangi bloger ro'yxatdan o'tdi", "Smart Agro"], ["Hamkorlik tasdiqlandi", "Syngenta"], ["Yangilik chop etildi", "Dronlar..."], ["Profil yangilandi", "Fermer Elyor"]].map(([t, s], i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green" />
                <span><span className="font-medium">{t}</span><span className="block text-xs text-muted">{s}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6"><Bloggers /></div>
    </>
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

export default function AdminDashboard() {
  const [active, setActive] = useState("Dashboard")
  const { user, logout } = useAuth()
  const nav2 = useNavigate()
  const initials = (user?.name || "AD").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const doLogout = () => { logout(); nav2("/kirish") }
  return (
    <DashboardLayout nav={nav} active={active} onNav={setActive} onLogout={doLogout} user={{ name: user?.name || "Admin", role: "Super Admin", initials }}>
      {active === "Dashboard" ? <Overview /> : active === "Bloggerlar" ? <Bloggers /> : active === "Hamkorlar" ? <AdminPartners /> : <Placeholder title={active} />}
    </DashboardLayout>
  )
}
