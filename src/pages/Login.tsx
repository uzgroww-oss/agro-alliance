import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { logo, Icon, I, Mascot } from "../lib/ui"
import { roleHome } from "../lib/roles"
import { setRememberPref } from "../lib/api"
import { useAuth } from "../lib/auth"
import { useStaticSeo } from "../lib/seo"
import { useT, tr } from "../lib/i18n"


const features = [
  { icon: I.sprout, t: tr("Ishonchli hamkorlik"), d: tr("Platforma orqali xavfsiz va shaffof hamkorlik qiling.") },
  { icon: I.chart, t: "Keng imkoniyatlar", d: tr("AI vositalari, tahlillar va marketing yechimlaridan foydalaning.") },
  { icon: I.shield, t: tr("Natijaga yo'naltirilgan"), d: tr("Maqsadli hamkorlik va samarali natijalarga erishing.") },
]

export default function Login() {
  const t = useT()
  useStaticSeo("/kirish")
  const navigate = useNavigate()
  const { login, user, loading } = useAuth()
  // Allaqachon kirgan bo'lsa — to'g'ridan-to'g'ri o'z kabinetiga (native ilovada doimiy login uchun muhim)
  useEffect(() => {
    if (!loading && user) navigate(roleHome(user.role), { replace: true })
  }, [user, loading, navigate])
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
      setRememberPref(remember)
      const user = await login(email, password)
      navigate(roleHome(user.role), { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("Kirishda xatolik"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-soft p-4 lg:p-6">
      {/* Balandlik ATAYLAB qat'iy: 859px — Google va Telegram tugmalari
            olib tashlanganda karta 682px gacha kichrayib, chap tomondagi
            rasm va maskot siqilib qolardi. O'lcham o'sha-o'shaligicha
            qoldirildi, bo'shagan joyni forma markazlashib egallaydi. */}
        <div className="mx-auto grid max-w-[1200px] overflow-hidden rounded-3xl bg-white shadow-[0_20px_70px_rgba(91,180,32,0.18)] lg:min-h-[859px] lg:grid-cols-2">
        {/* Left panel */}
        <div className="relative hidden overflow-hidden p-10 text-ink lg:flex lg:flex-col">
          {/* Fon rasmi: oddiy ekranga 1280px, katta/retina ekranga
             1536px. Ilgari hammaga 1536px ketardi va oddiy noutbukda
             piksellarning bir qismi bekorga yuklanardi. Ustidan oq
             parda tushgani uchun sifat farqi ko'zga ilinmaydi. */}
        <img src="/hero-bg-1280.webp" srcSet="/hero-bg-1280.webp 1280w, /hero-bg.webp 1536w" sizes="100vw" alt="" width={1280} height={853} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/92 via-white/85 to-soft/90" />
          <div className="relative flex h-full flex-col">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo} alt="" width={88} height={88} className="h-11 w-11 object-contain" />
              <span className="font-display text-lg font-extrabold tracking-tight">AGRO <span className="text-green">ALLIANCE</span></span>
            </Link>

            <div className="mt-10">
              <h1 className="font-display text-[clamp(2.2rem,4vw,3.2rem)] font-extrabold leading-[1.05] tracking-tight">AGRO ALLIANCE<br /><span className="text-green">Platform</span></h1>
              <p className="mt-4 max-w-sm leading-relaxed text-muted">{tr("Agro bloggerlar, fermerlar va kompaniyalarni birlashtiruvchi innovatsion ekotizim.")}</p>
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

            <Mascot className="animate-float absolute bottom-20 right-2 hidden h-56 w-auto object-contain drop-shadow-2xl lg:block" />

            <div className="mt-auto flex items-center gap-3 rounded-2xl bg-ink/90 p-4 text-white backdrop-blur">
              <Icon d={I.users} className="h-5 w-5 shrink-0 text-green" />
              <p className="text-sm">{tr("Allaqachon platformada bo'lsangiz, hozir kirib imkoniyatlardan foydalaning!")}</p>
            </div>
          </div>
        </div>

        {/* Right panel - form */}
        <div className="flex flex-col p-7 sm:p-10 lg:p-12">
          <div className="flex items-center justify-end gap-5 text-sm">
            <Link to="/platforma" className="flex items-center gap-1.5 text-muted transition-colors hover:text-green">Platforma haqida <Icon d={I.question} className="h-4 w-4" /></Link>
          </div>

          <div className="mx-auto mt-6 w-full max-w-sm lg:my-auto">
            <div className="text-center">
              <h2 className="font-display text-3xl font-extrabold tracking-tight">{tr("Platformaga kirish")}</h2>
              <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-green" />
              <p className="mx-auto mt-4 max-w-xs leading-relaxed text-muted">{tr("Xush kelibsiz! Hisobingizga kiring va imkoniyatlardan foydalanishni davom eting.")}</p>
            </div>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Telefon raqami yoki email</label>
                <div className="relative">
                  <Icon d={I.user} className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("Telefon raqami yoki email kiriting")} className="w-full rounded-xl border border-green/15 bg-white py-3.5 pl-12 pr-4 text-sm outline-none transition-colors hover:border-green/40 focus:border-green" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Parol</label>
                <div className="relative">
                  <Icon d={I.lock} className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input required type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("Parolingizni kiriting")} className="w-full rounded-xl border border-green/15 bg-white py-3.5 pl-12 pr-12 text-sm outline-none transition-colors hover:border-green/40 focus:border-green" />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-green" aria-label="Parolni korishtirish">
                    <Icon d={show ? I.eyeOff : I.eye} className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <span onClick={() => { const next = !remember; setRememberPref(next); setRemember(next) }} className={`grid h-5 w-5 place-items-center rounded-md border transition-colors ${remember ? "border-green bg-green text-white" : "border-green/30 bg-white"}`}>{remember && <Icon d="M9 12l2 2 4-4" className="h-3.5 w-3.5" sw={3} />}</span>
                  <span className="text-ink/70">Meni eslab qol</span>
                </label>
                <Link to="/reset-password" className="font-semibold text-green hover:underline">{t("Parolni unutdingiz?")}</Link>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v4 M12 16h.01" className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green px-6 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-[1.02] disabled:opacity-60">
                <Icon d={I.login} className="h-5 w-5" /> {busy ? t("Kirilmoqda...") : t("KIRISH")}
              </button>

            </form>

            <p className="mt-6 text-center text-xs text-muted">
              <Icon d={I.shield} className="inline h-4 w-4 text-green" /> Ma'lumotlaringiz xavfsiz va himoyalangan
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
