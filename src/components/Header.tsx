import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { logo, navLinks, Icon, I } from "../lib/ui"

export default function Header() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-green/10 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1320px] items-center gap-6 px-5 py-3 lg:px-8">
        <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
          <img src={logo} alt="Agro Alliance" className="h-11 w-11 object-contain" />
          <span className="font-display text-base font-extrabold leading-none tracking-tight sm:text-lg">
            AGRO <span className="text-green">ALLIANCE</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="mx-auto hidden items-center gap-6 xl:flex">
          {navLinks.map((n) => {
            const active = n.to === pathname
            return n.to.startsWith("/") ? (
              <Link key={n.label} to={n.to} className={`text-[13px] font-semibold tracking-wide transition-colors hover:text-green ${active ? "text-green" : "text-ink/70"}`}>
                {n.label}
              </Link>
            ) : (
              <a key={n.label} href="#" className="text-[13px] font-semibold tracking-wide text-ink/70 transition-colors hover:text-green">
                {n.label}
              </a>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 xl:ml-0">
          <Link to="/kirish" className="inline-flex items-center gap-2 rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105 sm:px-5">
            KIRISH
            <Icon d={I.login} className="h-4 w-4" />
          </Link>
          {/* Hamburger (mobile/tablet) */}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menyu"
            className="grid h-10 w-10 place-items-center rounded-lg border border-green/15 text-ink/70 transition-colors hover:border-green hover:text-green xl:hidden"
          >
            <Icon d={open ? "M6 6l12 12 M18 6L6 18" : "M3 6h18 M3 12h18 M3 18h18"} className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="border-t border-green/10 bg-white px-5 py-3 xl:hidden">
          <div className="mx-auto flex max-w-[1320px] flex-col">
            {navLinks.map((n) => {
              const active = n.to === pathname
              const cls = `rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${active ? "bg-green/10 text-green" : "text-ink/75 hover:bg-soft"}`
              return n.to.startsWith("/") ? (
                <Link key={n.label} to={n.to} onClick={() => setOpen(false)} className={cls}>{n.label}</Link>
              ) : (
                <a key={n.label} href="#" onClick={() => setOpen(false)} className={cls}>{n.label}</a>
              )
            })}
          </div>
        </nav>
      )}
    </header>
  )
}
