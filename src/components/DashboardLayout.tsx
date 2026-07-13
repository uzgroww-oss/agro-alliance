import { type ReactNode } from "react"
import { Link } from "react-router-dom"
import { logo, Icon, I } from "../lib/ui"

export type NavItem = { label: string; icon: string }

export default function DashboardLayout({
  nav,
  active,
  onNav,
  user,
  children,
  help = true,
  onLogout,
}: {
  nav: NavItem[]
  active: string
  onNav: (label: string) => void
  user: { name: string; role: string; initials: string }
  children: ReactNode
  help?: boolean
  onLogout?: () => void
}) {
  return (
    <div className="min-h-screen bg-[#f7faf4]">
      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-green/10 bg-white lg:flex">
          <Link to="/" className="flex items-center gap-2.5 px-6 py-5">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <span className="font-display text-base font-extrabold tracking-tight">AGRO <span className="text-green">ALLIANCE</span></span>
          </Link>
          <nav className="mt-2 flex-1 space-y-1 px-3">
            {nav.map((n) => {
              const on = n.label === active
              return (
                <button
                  key={n.label}
                  onClick={() => onNav(n.label)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${on ? "bg-green text-white shadow-lg shadow-green/25" : "text-ink/70 hover:bg-soft"}`}
                >
                  <Icon d={n.icon} className="h-5 w-5" />
                  {n.label}
                </button>
              )
            })}
          </nav>
          {help && (
            <div className="m-3 rounded-2xl border border-green/15 bg-soft p-5">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-bold">Yordam kerakmi?</h4>
                <Icon d={I.headset} className="h-5 w-5 text-green" />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">Savollaringiz bo'lsa, biz bilan bog'laning.</p>
              <Link to="/aloqa" className="mt-3 block rounded-lg border-2 border-green/30 bg-white py-2 text-center text-xs font-bold text-green transition-colors hover:bg-green hover:text-white">
                Yordamga murojaat
              </Link>
            </div>
          )}
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-green/10 bg-white/90 px-5 py-3 backdrop-blur lg:px-8">
            <div className="relative hidden max-w-xl flex-1 sm:block">
              <Icon d={I.search} className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input placeholder="Qidirish..." className="w-full rounded-xl border border-green/15 bg-[#f7faf4] py-2.5 pl-11 pr-4 text-sm outline-none focus:border-green" />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button className="relative grid h-10 w-10 place-items-center rounded-xl border border-green/15 text-ink/60 transition-colors hover:text-green">
                <Icon d={I.bell} className="h-5 w-5" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-green ring-2 ring-white" />
              </button>
              <div className="flex items-center gap-2.5 rounded-xl border border-green/15 py-1.5 pl-1.5 pr-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-green/15 font-display text-sm font-bold text-green">{user.initials}</span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-bold leading-tight">{user.name}</span>
                  <span className="block text-xs text-muted">{user.role}</span>
                </span>
                {onLogout && (
                  <button onClick={onLogout} title="Chiqish" className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-soft hover:text-red-500">
                    <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </header>

          <div className="p-5 lg:p-8">{children}</div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Shared dashboard chart helpers ---------- */
// Ustunli (bar) diagramma — har bir nuqta alohida gradient ustun
export function LineChart({ points, labels }: { points: number[]; labels: string[] }) {
  const max = Math.max(...points) * 1.18 || 1
  return (
    <div>
      <div className="flex h-56 items-end gap-1.5 sm:gap-2.5">
        {points.map((p, i) => (
          <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-1.5 rounded-md bg-green/10 px-1.5 py-0.5 text-[10px] font-bold text-green opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {p >= 1000 ? (p / 1000).toFixed(p % 1000 === 0 ? 0 : 1) + "K" : p}
            </span>
            <div
              className="w-full rounded-t-lg bg-green bg-gradient-to-t from-green/30 via-green/70 to-green shadow-[0_2px_8px_rgba(91,180,32,0.25)] transition-all duration-500 ease-out group-hover:to-green-deep"
              style={{ height: `${Math.max((p / max) * 100, 4)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex gap-1.5 sm:gap-2.5">
        {labels.map((l, i) => <span key={i} className="flex-1 text-center text-[11px] text-muted">{l}</span>)}
      </div>
    </div>
  )
}

export function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = 42, c = 2 * Math.PI * r
  const gap = 3
  const visible = segments.filter((s) => s.value > 0)
  const enriched = visible.map((s, i) => {
    const len = (s.value / total) * c
    const seg = Math.max(len - gap, 0.5)
    const offset = visible.slice(0, i).reduce((sum, p) => sum + (p.value / total) * c, 0)
    return { label: s.label, color: s.color, seg, offset }
  })
  return (
    <svg viewBox="0 0 110 110" className="h-44 w-44 -rotate-90">
      <circle cx="55" cy="55" r={r} fill="none" stroke="#eef4e8" strokeWidth="12" />
      {enriched.map((s) => (
        <circle
          key={s.label} cx="55" cy="55" r={r} fill="none"
          stroke={s.color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${s.seg} ${c - s.seg}`} strokeDashoffset={-s.offset}
        />
      ))}
    </svg>
  )
}
