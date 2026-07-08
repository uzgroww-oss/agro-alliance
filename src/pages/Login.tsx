import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { logo, Icon, I } from "../lib/ui"
import { roleHome } from "../lib/roles"

const mascot = "/mascot.webp"
import { useAuth } from "../lib/auth"

const features = [
  { icon: I.sprout, t: "Ishonchli hamkorlik", d: "Platforma orqali xavfsiz va shaffof hamkorlik qiling." },
  { icon: I.chart, t: "Keng imkoniyatlar", d: "AI vositalari, tahlillar va marketing yechimlaridan foydalaning." },
  { icon: I.shield, t: "Natijaga yo'naltirilgan", d: "Maqsadli hamkorlik va samarali natijalarga erishing." },
]

/* Google multicolor mark */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8.1z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2a11 11 0 0 0 0 9.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2 7.1l3.7 2.8C6.6 7.4 9.1 5.4 12 5.4z" />
    </svg>
  )
}

export default function Login() {
  const nav = useNavigate()
  const { login } = useAuth()
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      const u = await login(email.trim(), password)
      nav(roleHome(u.role))
    } catch (err: any) {
      setError(err?.message || "Kirishda xatolik")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-soft p-4 lg:p-6">
      <div className="mx-auto grid max-w-[1200px] overflow-hidden rounded-3xl bg-white shadow-[0_20px_70px_rgba(91,180,32,0.18)] lg:grid-cols-2">
        {/* Left panel */}
        <div className="relative hidden overflow-hidden p-10 text-ink lg:flex lg:flex-col">
          <img src="/hero-bg.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/92 via-white/85 to-soft/90" />
          <div className="relative flex h-full flex-col">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo} alt="" className="h-11 w-11 object-contain" />
              <span className="font-display text-lg font-extrabold tracking-tight">AGRO <span className="text-green">ALLIANCE</span></span>
            </Link>

            <div className="mt-10">
              <h1 className="font-display text-[clamp(2.2rem,4vw,3.2rem)] font-extrabold leading-[1.05] tracking-tight">
                AGRO ALLIANCE<br /><span className="text-green">Platform</span>
              </h1>
              <p className="mt-4 max-w-sm leading-relaxed text-muted">
                Agro bloggerlar, fermerlar va kompaniyalarni birlashtiruvchi innovatsion ekotizim.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-5">
              {features.map((f) => (
                <div key={f.t} className="flex items-start gap-3.5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green text-white shadow-lg shadow-green/30"><Icon d={f.icon} className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-display font-bold">{f.t}</h3>
                    <p className="mt-0.5 max-w-xs text-sm text-muted">{f.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <img src={mascot} alt="" className="animate-float pointer-events-none absolute bottom-20 right-2 hidden h-56 object-contain drop-shadow-2xl lg:block" />

            <div className="mt-auto flex items-center gap-3 rounded-2xl bg-ink/90 p-4 text-white backdrop-blur">
              <Icon d={I.users} className="h-5 w-5 shrink-0 text-green" />
              <p className="text-sm">Allaqachon platformada bo'lsangiz, hozir kirib imkoniyatlardan foydalaning!</p>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex flex-col p-7 sm:p-10 lg:p-12">
          <div className="flex items-center justify-end gap-5 text-sm">
            <button className="inline-flex items-center gap-1.5 rounded-full border border-green/15 px-3 py-1.5 font-semibold text-ink/70 transition-colors hover:border-green hover:text-green">
              UZ <Icon d={I.chevDown} className="h-3.5 w-3.5" />
            </button>
            <Link to="/platforma" className="flex items-center gap-1.5 text-muted transition-colors hover:text-green">
              Platforma haqida <Icon d={I.question} className="h-4 w-4" />
            </Link>
          </div>

          <div className="mx-auto mt-6 w-full max-w-sm">
            <div className="text-center">
              <h2 className="font-display text-3xl font-extrabold tracking-tight">Platformaga kirish</h2>
              <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-green" />
              <p className="mx-auto mt-4 max-w-xs leading-relaxed text-muted">
                Xush kelibsiz! Hisobingizga kiring va imkoniyatlardan foydalanishni davom eting.
              </p>
            </div>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Telefon raqami yoki email</label>
                <div className="relative">
                  <Icon d={I.user} className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Telefon raqami yoki email kiriting" className="w-full rounded-xl border border-green/15 bg-white py-3.5 pl-12 pr-4 text-sm outline-none transition-colors hover:border-green/40 focus:border-green" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Parol</label>
                <div className="relative">
                  <Icon d={I.lock} className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input required type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Parolingizni kiriting" className="w-full rounded-xl border border-green/15 bg-white py-3.5 pl-12 pr-12 text-sm outline-none transition-colors hover:border-green/40 focus:border-green" />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-green" aria-label="Parolni ko'rsatish">
                    <Icon d={show ? I.eyeOff : I.eye} className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <span onClick={() => setRemember((r) => !r)} className={`grid h-5 w-5 place-items-center rounded-md border transition-colors ${remember ? "border-green bg-green text-white" : "border-green/30 bg-white"}`}>
                    {remember && <Icon d="M9 12l2 2 4-4" className="h-3.5 w-3.5" sw={3} />}
                  </span>
                  <span className="text-ink/70">Meni eslab qol</span>
                </label>
                <a href="#" className="font-semibold text-green hover:underline">Parolni unutdingiz?</a>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v4 M12 16h.01" className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green px-6 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-[1.02] disabled:opacity-60">
                <Icon d={I.login} className="h-5 w-5" /> {busy ? "Kirilmoqda…" : "KIRISH"}
              </button>

              <button type="button" onClick={() => { setEmail("admin@agroalliance.uz"); setPassword("admin123") }} className="w-full text-center text-xs text-muted hover:text-green">
                Demo: admin@agroalliance.uz / admin123 · elyor@agroalliance.uz / elyor123
              </button>
            </form>

            <div className="my-6 flex items-center gap-4 text-xs text-muted">
              <span className="h-px flex-1 bg-green/15" /> yoki <span className="h-px flex-1 bg-green/15" />
            </div>

            <div className="space-y-3">
              <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-green/15 bg-white py-3.5 text-sm font-semibold transition-colors hover:border-green/40 hover:bg-soft">
                <GoogleMark /> Google bilan kirish
              </button>
              <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-green/15 bg-white py-3.5 text-sm font-semibold transition-colors hover:border-green/40 hover:bg-soft">
                <Icon d={I.telegram} className="h-5 w-5 text-[#229ED9]" /> Telegram bilan kirish
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-muted">
              Profilingiz yo'qmi? <a href="#" className="inline-flex items-center gap-1 font-bold text-green hover:underline">Ro'yxatdan o'ting <Icon d={I.arrow} className="h-4 w-4" /></a>
            </p>
            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted">
              <Icon d={I.shield} className="h-4 w-4 text-green" /> Ma'lumotlaringiz xavfsiz va himoyalangan
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
