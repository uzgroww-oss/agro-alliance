import { useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "../lib/supabase"

export default function ResetPassword() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (error) throw error
      setSent(true)
    } catch (err: any) {
      setError(err?.message || "Parolni tiklashda xatolik")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-soft p-4 lg:p-6">
      <div className="mx-auto max-w-[500px] rounded-3xl bg-white p-8 shadow-[0_20px_70px_rgba(91,180,32,0.18)]">
        <h2 className="text-center text-2xl font-bold mb-6">Parolni tiklash</h2>
        {error && <div className="mb-4 rounded bg-red-50 p-2 text-red-600">{error}</div>}
        {sent ? (
          <div className="text-center text-green font-medium">Parol tiklash havolasi emailga yuborildi.</div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-green px-6 py-3 font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Yuborilmoqda…' : 'Parolni tiklash'}
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted">
          <Link to="/kirish" className="text-green font-semibold hover:underline">Kirish</Link>
        </p>
      </div>
    </div>
  )
}
