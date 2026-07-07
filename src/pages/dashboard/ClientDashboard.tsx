import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import DashboardLayout, { Donut } from "../../components/DashboardLayout"
import { Icon, I } from "../../lib/ui"
import { api } from "../../lib/api"
import { useAuth } from "../../lib/auth"

const nav = [
  { label: "Umumiy", icon: I.dashboard },
  { label: "Bajarilgan ishlar", icon: I.task },
  { label: "Shartnoma", icon: I.doc },
]

type Task = { id: number; title: string; status: "done" | "progress" | "pending" }
type Partner = {
  id: number; name: string; sphere: string; contractNo: string
  amount: number; signedDate: string; status: string; tasks: Task[]
}

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
const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"

/* read-only task row */
function TaskRow({ t }: { t: Task }) {
  const tm = taskMeta[t.status]
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

export default function ClientDashboard() {
  const [active, setActive] = useState("Umumiy")
  const [partner, setPartner] = useState<Partner | null>(null)
  const [err, setErr] = useState("")
  const { user, logout } = useAuth()
  const nav2 = useNavigate()

  useEffect(() => {
    api<{ partner: Partner }>("/me/partner").then((d) => setPartner(d.partner)).catch((e) => setErr(e?.message || "Yuklashda xatolik"))
  }, [])

  const counts = useMemo(() => {
    const ts = partner?.tasks || []
    return {
      total: ts.length,
      done: ts.filter((t) => t.status === "done").length,
      progress: ts.filter((t) => t.status === "progress").length,
      pending: ts.filter((t) => t.status === "pending").length,
    }
  }, [partner])

  const initials = (user?.name || "MI").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const doLogout = () => { logout(); nav2("/kirish") }

  const statCards = [
    { icon: I.task, t: "Jami ishlar", v: String(counts.total), cls: "text-green bg-soft" },
    { icon: I.check, t: "Bajarilgan", v: String(counts.done), cls: "text-green bg-green/10" },
    { icon: I.clock, t: "Jarayonda", v: String(counts.progress), cls: "text-orange-600 bg-orange-100" },
    { icon: I.dots, t: "Kutilayotgan", v: String(counts.pending), cls: "text-slate-500 bg-slate-100" },
  ]

  const ps = partner ? (partnerStatusMeta[partner.status] || partnerStatusMeta.active) : null

  return (
    <DashboardLayout
      nav={nav}
      active={active}
      onNav={setActive}
      onLogout={doLogout}
      user={{ name: user?.name || "Mijoz", role: "Buyurtmachi", initials }}
    >
      {err && <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-600">{err}</div>}
      {!partner && !err && <div className="grid min-h-[50vh] place-items-center text-muted">Yuklanmoqda…</div>}

      {partner && (
        <>
          {/* header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-green/10 text-green"><Icon d={I.building} className="h-7 w-7" /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-extrabold tracking-tight">{partner.name}</h1>
                  {ps && <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${ps.cls}`}>{ps.label}</span>}
                </div>
                <p className="mt-0.5 text-sm text-muted">{partner.sphere || "Hamkorlik loyihasi"} • Siz uchun qilingan ishlar</p>
              </div>
            </div>
          </div>

          {active === "Umumiy" && (
            <>
              {/* stat cards */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((s) => (
                  <div key={s.t} className="min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
                    <span className={`grid h-10 w-10 place-items-center rounded-xl ${s.cls}`}><Icon d={s.icon} className="h-5 w-5" /></span>
                    <div className="mt-3 text-xs text-muted">{s.t}</div>
                    <div className="mt-1 font-display text-2xl font-extrabold">{s.v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
                {/* progress donut */}
                <div className={card}>
                  <h3 className="font-display text-lg font-bold">Ishlar holati</h3>
                  {counts.total === 0 ? (
                    <p className="mt-6 text-center text-sm text-muted">Hozircha vazifa qo'shilmagan.</p>
                  ) : (
                    <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:justify-around">
                      <div className="relative grid place-items-center">
                        <Donut segments={[
                          { label: "Bajarilgan", value: counts.done, color: "#5bb420" },
                          { label: "Jarayonda", value: counts.progress, color: "#f97316" },
                          { label: "Kutilayotgan", value: counts.pending, color: "#cbd5e1" },
                        ]} />
                        <div className="absolute text-center">
                          <div className="font-display text-2xl font-extrabold leading-none">{Math.round((counts.done / counts.total) * 100)}%</div>
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

                {/* contract summary */}
                <div className={card}>
                  <h3 className="font-display text-lg font-bold">Shartnoma ma'lumotlari</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">Shartnoma raqami</div><div className="mt-0.5 font-display font-bold">{partner.contractNo}</div></div>
                    <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">Summa</div><div className="mt-0.5 font-display font-bold text-green">{fmtSom(partner.amount)} so'm</div></div>
                    <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">Imzolangan sana</div><div className="mt-0.5 font-display font-bold">{partner.signedDate}</div></div>
                    <div className="rounded-xl bg-[#fafdf7] p-4"><div className="text-xs text-muted">Yo'nalish</div><div className="mt-0.5 font-display font-bold">{partner.sphere || "—"}</div></div>
                  </div>
                  <div className="mt-5"><ProgressBar done={counts.done} total={counts.total} /></div>
                </div>
              </div>

              {/* recent tasks */}
              <div className={`mt-6 ${card}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">So'nggi ishlar</h3>
                  {counts.total > 4 && <button onClick={() => setActive("Bajarilgan ishlar")} className="text-sm font-semibold text-green hover:underline">Barchasi →</button>}
                </div>
                <div className="mt-4 space-y-2">
                  {partner.tasks.length === 0 && <p className="py-6 text-center text-sm text-muted">Hozircha ish qo'shilmagan.</p>}
                  {partner.tasks.slice(0, 5).map((t) => <TaskRow key={t.id} t={t} />)}
                </div>
              </div>
            </>
          )}

          {active === "Bajarilgan ishlar" && (
            <div className={`mt-6 ${card}`}>
              <h3 className="font-display text-lg font-bold">Siz uchun rejalashtirilgan ishlar</h3>
              <p className="mt-1 text-sm text-muted">Har bir ishning joriy holati: bajarilgan, jarayonda yoki kutilayotgan.</p>
              <div className="mt-4"><ProgressBar done={counts.done} total={counts.total} /></div>
              <div className="mt-5 space-y-2">
                {partner.tasks.length === 0 && <p className="py-6 text-center text-sm text-muted">Hozircha ish qo'shilmagan.</p>}
                {partner.tasks.map((t) => <TaskRow key={t.id} t={t} />)}
              </div>
            </div>
          )}

          {active === "Shartnoma" && (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className={card}>
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-soft text-green"><Icon d={I.doc} className="h-6 w-6" /></span>
                  <div>
                    <h3 className="font-display text-lg font-bold">Shartnoma № {partner.contractNo}</h3>
                    {ps && <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${ps.cls}`}>{ps.label}</span>}
                  </div>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  {[["Tashkilot", partner.name], ["Yo'nalish", partner.sphere || "—"], ["Shartnoma summasi", fmtSom(partner.amount) + " so'm"], ["Imzolangan sana", partner.signedDate]].map(([l, v]) => (
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
          )}
        </>
      )}
    </DashboardLayout>
  )
}
