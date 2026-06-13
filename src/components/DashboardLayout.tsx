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
export function LineChart({ points, labels }: { points: number[]; labels: string[] }) {
  const max = Math.max(...points) * 1.15
  const w = 100, h = 60
  const step = w / (points.length - 1)
  const xy = points.map((p, i) => [i * step, h - (p / max) * h] as const)
  const line = xy.map(([x, y]) => `${x},${y}`).join(" ")
  const area = `0,${h} ${line} ${w},${h}`
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-56 w-full">
        <defs>
          <linearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5bb420" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#5bb420" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#lc)" />
        <polyline points={line} fill="none" stroke="#5bb420" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill="#5bb420" stroke="#fff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        {labels.map((l) => <span key={l}>{l}</span>)}
      </div>
    </div>
  )
}

export function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = 42, c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg viewBox="0 0 110 110" className="h-44 w-44 -rotate-90">
      {segments.map((s) => {
        const len = (s.value / total) * c
        const el = <circle key={s.label} cx="55" cy="55" r={r} fill="none" stroke={s.color} strokeWidth="14" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
        offset += len
        return el
      })}
    </svg>
  )
}
