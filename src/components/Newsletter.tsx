import { useState } from "react"
import { Icon, I } from "../lib/ui"
import { api } from "../lib/api"

export default function Newsletter({ variant = "default" }: { variant?: "default" | "dark" }) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError("")
    setBusy(true)
    try {
      await api("/newsletter-subscribe", { method: "POST", body: JSON.stringify({ email: email.trim() }) })
      setSent(true)
      setEmail("")
    } catch (err: any) {
      setError(err?.message || "Obunada xatolik")
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <section className="mx-auto max-w-[1320px] px-5 pb-16 lg:px-8">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-green/15 bg-soft px-8 py-9 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-green text-white">
            <Icon d="M9 12l2 2 4-4" className="h-7 w-7" sw={2.5} />
          </span>
          <h3 className="font-display text-xl font-extrabold">Obuna muvaffaqiyatli!</h3>
          <p className="text-sm text-muted">Eng so'nggi yangiliklar va imkoniyatlarni email orqali olib boring.</p>
          <button onClick={() => setSent(false)} className="text-sm font-bold text-green hover:underline">Yana obuna bo'lish</button>
        </div>
      </section>
    )
  }

  if (variant === "dark") {
    return (
      <section className="mx-auto max-w-[1320px] px-5 pb-16 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-ink p-8 text-white lg:p-10">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-green/20 blur-3xl" />
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-green/15 text-green"><Icon d={I.mail} className="h-7 w-7" /></span>
              <div>
                <h3 className="font-display text-xl font-extrabold leading-tight">Yangiliklardan birinchilardan bo'lib xabardor bo'ling!</h3>
                <p className="mt-1 text-sm text-white/60">Eng so'nggi yangiliklar va maqolalarni email orqali oling.</p>
              </div>
            </div>
            <form onSubmit={submit} className="flex w-full gap-3 lg:w-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email manzilingiz"
                className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-green lg:w-64"
              />
              <button type="submit" disabled={busy} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green px-6 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105 disabled:opacity-60">
                {busy ? "..." : <><Icon d={I.send} className="h-5 w-5" /> OBUNA</>}
              </button>
            </form>
          </div>
          {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-16 lg:px-8">
      <div className="flex flex-col items-center gap-6 rounded-3xl border border-green/15 bg-soft px-8 py-9 lg:flex-row lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-green/15 text-green"><Icon d={I.mail} className="h-7 w-7" /></span>
          <div>
            <h3 className="font-display text-xl font-extrabold leading-tight">Yangiliklardan xabardor bo'lib boring!</h3>
            <p className="mt-1 text-sm text-muted">Eng so'nggi yangiliklar va takliflar haqida birinchilardan bo'lib xabar oling.</p>
          </div>
        </div>
        <form onSubmit={submit} className="flex w-full gap-3 lg:w-auto">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email manzilingiz"
            className="w-full rounded-xl border border-green/15 bg-white px-4 py-3.5 text-sm outline-none focus:border-green lg:w-64"
          />
          <button type="submit" disabled={busy} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green px-6 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105 disabled:opacity-60">
            {busy ? "..." : <><Icon d={I.send} className="h-5 w-5" /> OBUNA</>}
          </button>
        </form>
      </div>
      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
    </section>
  )
}
