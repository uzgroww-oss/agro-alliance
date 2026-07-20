import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Reveal, Icon, I, Skeleton, ErrorState } from "../lib/ui"
import { api } from "../lib/api"
import { useContactInfo } from "../lib/settings"
import { useHomeSection } from "../lib/sections"
import { useStaticSeo } from "../lib/seo"

const mascot = "/mascot-contact.webp"

type Office = { name: string; main: boolean; addr: string; phone: string; email: string }
type Faq = { q: string; a: string }

const features = [
  { icon: I.headset, t: "Tezkor javob", d: "24 soat ichida javob berishga harakat qilamiz" },
  { icon: I.users, t: "Professional jamoa", d: "Sizga tajribali mutaxassislar ko'maklashadi" },
  { icon: I.shield, t: "Ishonchlilik", d: "Ma'lumotlaringiz maxfiy saqlanadi" },
  { icon: I.handshake, t: "Hamkorlik", d: "Uzoq muddatli va samarali hamkorlikni qadrlaymiz" },
]


const topics = ["Tanlang", "Hamkorlik", "Texnik yordam", "Umumiy savol", "Reklama va marketing"]

function Hero() {
  // Footer bilan BIR XIL manba (useContactInfo). Ilgari bu sahifa faqat
  // Sozlamalarni o'qigani uchun footerni tahrirlaganda shu yer o'zgarmasdi.
  const contact = useContactInfo()
  const sLoading = contact.loading
  const h = useHomeSection("contact_hero", { title: "Biz bilan bog'laning!", subtitle: "Savollaringiz, takliflaringiz yoki hamkorlik bo'yicha murojaatlaringiz uchun biz doimo ochiqmiz. Siz bilan hamkorlik qilishdan mamnunmiz!" })
  const hParts = h.title.split(" ")

  // Qattiq yozilgan "namuna" qiymat yo'q — bo'sh bo'lsa qator chizilmaydi.
  const contactInfo = [
    { icon: I.phone, t: "Telefon", v: contact.phone },
    { icon: I.mail, t: "Email", v: contact.email },
    { icon: I.pin, t: "Manzil", v: contact.address },
    { icon: I.clock, t: "Ish vaqti", v: contact.hours },
  ].filter((c): c is { icon: string; t: string; v: string } => Boolean(c.v))
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <img src="/hero-bg.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-white/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-white/50" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
      </div>
      <div className="mx-auto max-w-[1320px] px-5 pt-7 lg:px-8">
        <Reveal>
          <nav className="flex items-center gap-2 text-sm text-muted">
            <Link to="/" className="flex items-center gap-1.5 hover:text-green">
              <Icon d="M3 12l9-9 9 9 M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" className="h-4 w-4" /> Bosh sahifa
            </Link>
            <span>/</span><span className="font-semibold text-green">Aloqa</span>
          </nav>
        </Reveal>

        <div className="grid gap-10 py-8 lg:grid-cols-2">
          {/* Left: info */}
          <div>
            <Reveal>
              <span className="inline-block rounded-lg bg-green/10 px-3 py-1 text-xs font-bold tracking-widest text-green">ALOQA</span>
            </Reveal>
            <Reveal delay={70}>
              <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4rem)] font-extrabold leading-[1] tracking-[-0.03em]">
                {hParts.slice(0, -1).join(" ")} <span className="text-green">{hParts[hParts.length - 1]}</span>
              </h1>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-4 max-w-md leading-relaxed text-muted">{h.subtitle}</p>
            </Reveal>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <div className="relative hidden sm:block">
                <img src={mascot} alt="Agro Alliance" className="animate-float w-full max-w-[180px] object-contain drop-shadow-2xl" />
              </div>
              <div className="flex flex-col gap-5">
                {sLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                        <div className="flex-1 space-y-2 pt-1">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                      </div>
                    ))
                  : contactInfo.map((c, i) => (
                      <Reveal key={c.t} delay={i * 70}>
                        <div className="flex items-start gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-soft text-green"><Icon d={c.icon} className="h-5 w-5" /></span>
                          <div>
                            <div className="font-display text-sm font-bold">{c.t}</div>
                            <div className="mt-0.5 whitespace-pre-line text-sm text-muted">{c.v}</div>
                          </div>
                        </div>
                      </Reveal>
                    ))}
              </div>
            </div>
          </div>

          {/* Right: form */}
          <Reveal delay={120}>
            <ContactForm />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function ContactForm() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", topic: "Tanlang", message: "" })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError("")
    setBusy(true)
    try {
      await api("/contact-submit", {
        method: "POST",
        body: JSON.stringify({ name: form.name, email: form.email, subject: form.topic, message: form.message }),
      })
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Yuborishda xatolik")
    } finally {
      setBusy(false)
    }
  }
  const inputCls = "w-full rounded-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none transition-colors hover:border-green/40 focus:border-green"

  return (
    <div className="rounded-3xl border border-green/10 bg-white p-7 shadow-[0_12px_44px_rgba(91,180,32,0.10)]">
      <h2 className="font-display text-xl font-extrabold tracking-tight">Bizga xabar yuboring</h2>
      <p className="mt-2 text-sm text-muted">Quyidagi formani to'ldirib, bizga xabar yuboring. Tez orada siz bilan bog'lanamiz.</p>

  {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">{error}</div>}
  {sent ? (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-soft py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-green text-white"><Icon d="M9 12l2 2 4-4" className="h-7 w-7" sw={2.5} /></span>
      <h3 className="font-display text-lg font-bold">Xabaringiz yuborildi!</h3>
      <p className="max-w-xs text-sm text-muted">Rahmat, {form.name || "do'st"}! Tez orada siz bilan bog'lanamiz.</p>
      <button onClick={() => { setSent(false); setForm({ name: "", email: "", topic: "Tanlang", message: "" }) }} className="mt-2 text-sm font-bold text-green hover:underline">Yana xabar yuborish</button>
    </div>
  ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ismingiz" className={inputCls} />
            <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="E-mail manzilingiz" className={inputCls} />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Mavzu</span>
            <div className="relative">
              <select value={form.topic} onChange={(e) => set("topic", e.target.value)} className={`${inputCls} appearance-none pr-9`}>
                {topics.map((t) => <option key={t}>{t}</option>)}
              </select>
              <Icon d={I.chevDown} className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </label>
          <textarea required value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="Xabaringiz" rows={5} className={`${inputCls} resize-none`} />
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green px-6 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100">
            {busy ? "YUBORILMOQDA…" : <>XABARNI YUBORISH <Icon d={I.send} className="h-5 w-5" /></>}
          </button>
        </form>
      )}
    </div>
  )
}

function Features() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-4 lg:px-8">
      <Reveal>
        <div className="grid gap-6 rounded-3xl border border-green/10 bg-soft px-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.t} className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-green shadow-sm"><Icon d={f.icon} className="h-5 w-5" /></span>
              <div>
                <h3 className="font-display text-sm font-bold">{f.t}</h3>
                <p className="mt-1 text-xs leading-snug text-muted">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  )
}

function Offices({ offices, loading, failed, onRetry }: { offices: Office[] | null; loading: boolean; failed: boolean; onRetry: () => void }) {
  // Ma'lumot ham yo'q, yuklanmayapti ham, xato ham emas -> bo'limni chizmaymiz.
  if (!loading && !failed && !offices?.length) return null
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <Reveal>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">Bizning ofislarimiz</h2>
            <p className="mt-2 max-w-md leading-relaxed text-muted">
              Siz bizning ofisimizga tashrif buyurishingiz mumkin. Oldindan qo'ng'iroq qilib kelishingizni tavsiya qilamiz.
            </p>
          </Reveal>
          <div className="mt-6 space-y-4">
            {loading && Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-green/10 bg-white p-5">
                <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-5 w-36" /></div>
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-3 h-4 w-48" />
              </div>
            ))}
            {!loading && failed && <ErrorState onRetry={onRetry} message="Ofis ma'lumotlarini yuklab bo'lmadi." />}
            {!loading && !failed && (offices ?? []).map((o, i) => (
              <Reveal key={o.name} delay={i * 80}>
                <div className="rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.06)]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft text-green"><Icon d={I.building} className="h-5 w-5" /></span>
                    <h3 className="font-display font-bold">{o.name}</h3>
                    {o.main && <span className="rounded-md bg-green/10 px-2 py-0.5 text-[11px] font-bold text-green">Asosiy ofis</span>}
                  </div>
                  <p className="mt-3 text-sm text-muted">{o.addr}</p>
                  <div className="mt-3 flex flex-col gap-1.5 text-sm">
                    <span className="flex items-center gap-2 text-muted"><Icon d={I.phone} className="h-4 w-4 text-green" /> {o.phone}</span>
                    <span className="flex items-center gap-2 text-muted"><Icon d={I.mail} className="h-4 w-4 text-green" /> {o.email}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={100}>
          <MapEmbed />
        </Reveal>
      </div>
    </section>
  )
}

function MapEmbed() {
  // rolikda zoom bo'lib ketmasligi uchun: bosilmaguncha xarita "passiv" (pointer-events yo'q),
  // sichqoncha chiqib ketsa yana himoyalanadi
  const [active, setActive] = useState(false)
  return (
    <div
      onMouseLeave={() => setActive(false)}
      className="relative h-full min-h-[360px] overflow-hidden rounded-3xl border border-green/10 shadow-[0_8px_30px_rgba(91,180,32,0.08)]"
    >
      <iframe
        title="Xarita"
        className={`h-full w-full ${active ? "" : "pointer-events-none"}`}
        style={{ border: 0, minHeight: 360 }}
        loading="lazy"
        src="https://www.openstreetmap.org/export/embed.html?bbox=69.25%2C41.30%2C69.33%2C41.34&layer=mapnik&marker=41.32%2C69.28"
      />
      {!active && (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="group absolute inset-0 grid place-items-center bg-ink/0 transition-colors hover:bg-ink/5"
          aria-label="Xaritani faollashtirish"
        >
          <span className="flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-ink shadow-lg ring-1 ring-green/15 backdrop-blur transition-transform group-hover:scale-105">
            <Icon d={I.pin} className="h-4 w-4 text-green" /> Xarita bilan ishlash uchun bosing
          </span>
        </button>
      )}
    </div>
  )
}

function Faq({ faqs, loading }: { faqs: Faq[] | null; loading: boolean }) {
  const [open, setOpen] = useState<number | null>(0)
  if (!loading && !faqs?.length) return null
  return (
    <div>
      <Reveal>
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Ko'p so'raladigan savollar</h2>
      </Reveal>
      <div className="mt-6 space-y-3">
        {loading && Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-2xl" />
        ))}
        {!loading && (faqs ?? []).map((f, i) => {
          const active = open === i
          return (
            <Reveal key={f.q} delay={i * 60}>
              <div className="overflow-hidden rounded-2xl border border-green/10 bg-white shadow-[0_4px_20px_rgba(91,180,32,0.05)]">
                <button onClick={() => setOpen(active ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="font-medium">{f.q}</span>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-green text-white" : "bg-soft text-green"}`}>
                    <Icon d={active ? "M5 12h14" : I.plus} className="h-4 w-4" sw={2.4} />
                  </span>
                </button>
                <div className={`grid transition-all duration-300 ${active ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
    </div>
  )
}

function FaqSection({ faqs, loading }: { faqs: Faq[] | null; loading: boolean }) {
  if (!loading && !faqs?.length) return null
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10 lg:px-8">
      <Faq faqs={faqs} loading={loading} />
    </section>
  )
}

export default function Contact() {
  useStaticSeo("/aloqa")
  // MUHIM: bu yerda "namuna" ofis/FAQ ishlatilmaydi. Ilgari sahifa o'ylab
  // topilgan 2 ta ofis (soxta manzil va telefon) bilan ochilar, API ishlamasa
  // esa shu soxta ma'lumot butunlay qolib ketardi.
  const [offices, setOffices] = useState<Office[] | null>(null)
  const [faqs, setFaqs] = useState<Faq[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setFailed(false)
    api<{ settings: Record<string, string> }>("/public/settings").then((d) => {
      const s = d.settings
      if (s.offices) { try { setOffices(JSON.parse(s.offices)) } catch { /* invalid JSON */ } }
      if (s.faqs) { try { setFaqs(JSON.parse(s.faqs)) } catch { /* invalid JSON */ } }
    }).catch(() => setFailed(true)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <Hero />
      <Features />
      <Offices offices={offices} loading={loading} failed={failed} onRetry={load} />
      <FaqSection faqs={faqs} loading={loading} />
    </>
  )
}
