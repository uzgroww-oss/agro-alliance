import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { logo, Icon, I } from "../lib/ui"

export default function Register() {
  const nav = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirm) {
      setError("Parollar mos kelmaydi")
      return
    }
    if (password.length < 6) {
      setError("Parol kamida 6 ta belgi bo'lishi kerak")
      return
    }
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() || email.split("@")[0] },
        },
      })
      if (error) throw error

      // Agar session bo'lsa — avtomatik login
      if (data?.session) {
        nav("/")
        return
      }

      // Session yo'q bo'lsa — avtomatik signIn qilish
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) throw signInError
      nav("/")
    } catch (err: any) {
      setError(err?.message || "Ro'yxatdan o'tishda xatolik")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-soft p-4 lg:p-6">
      <div className="mx-auto max-w-[500px] rounded-3xl bg-white p-8 shadow-[0_20px_70px_rgba(91,180,32,0.18)]">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-6">
          <img src={logo} alt="Agro Alliance" className="h-11 w-11 object-contain" />
          <span className="font-display text-lg font-extrabold tracking-tight">AGRO <span className="text-green">ALLIANCE</span></span>
        </Link>
        <h2 className="text-center text-2xl font-bold mb-6">Ro'yxatdan o'tish</h2>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v4 M12 16h.01" className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium text-sm">Ism</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ismingizni kiriting"
              className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-sm">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-sm">Parol</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Kamida 6 ta belgi"
              className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-sm">Parolni tasdiqlang</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Parolni qaytadan kiriting"
              className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-green px-6 py-3 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            <Icon d={I.login} className="h-5 w-5" /> {busy ? "Ro'yxatdan o'tayapti..." : "RO'YXATDAN O'TISH"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Allaqachon hisobingiz bormi?{' '}
          <Link to="/kirish" className="text-green font-semibold hover:underline">
            Kirish
          </Link>
        </p>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted">
          <Icon d={I.shield} className="h-4 w-4 text-green" /> Ma'lumotlaringiz xavfsiz va himoyalangan
        </p>
      </div>
    </div>
  )
}
