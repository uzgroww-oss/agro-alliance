import { Link } from "react-router-dom"
import { Reveal, Icon, I } from "../lib/ui"

const mascot = "/mascot-partners.png"

const stats = [
  { icon: I.users, v: "200+", l: "Faol hamkorlar" },
  { icon: I.building, v: "15+", l: "Mamlakatlarda hamkorlik" },
  { icon: I.handshake, v: "50+", l: "Strategik hamkorlar" },
  { icon: I.globe, v: "1M+", l: "Birgalikda qamrov" },
  { icon: I.star, v: "5+", l: "Yillik tajriba" },
]

const directions = [
  { icon: I.sprout, t: "Agro texnologiyalar", d: "Zamonaviy agro texnologiya yechimlarini joriy etish va ishlab chiqaruvchilar bilan hamkorlik." },
  { icon: I.shield, t: "O'g'it va himoya vositalari", d: "Yuqori sifatli o'g'itlar, urug'lar va o'simliklarni himoya qilish vositalari yetkazib beruvchilar." },
  { icon: I.tractor, t: "Qishloq xo'jaligi texnikasi", d: "Zamonaviy qishloq xo'jaligi texnikalari va uskunalarni yetkazib beruvchi kompaniyalar." },
  { icon: I.cap, t: "Ta'lim va konsultatsiya", d: "Agro soha bo'yicha ta'lim, trening va konsultatsiya xizmatlarini ko'rsatuvchi tashkilotlar." },
  { icon: I.megaphone, t: "Media va marketing", d: "Marketing, reklama, PR va media sohasida faoliyat yurituvchi hamkorlarimiz." },
]

const partners = [
  "UZ-GROW", "AGRO MARKET", "Syngenta", "BAYER", "CORTEVA",
  "YARA", "avgust", "JOHN DEERE", "CASE IH", "MASSEY FERGUSON",
  "FMC", "ADAMA", "BASF", "VALLEY", "NETAFIM",
]

const benefits = [
  { icon: I.handshake, t: "O'zaro manfaatli", d: "Win-win strategiyasiga asoslangan hamkorlik." },
  { icon: I.shield, t: "Ishonch va sifat", d: "Yuqori standartlar va ishonchli aloqalar." },
  { icon: I.globe, t: "Keng qamrov", d: "Katta auditoriya va keng imkoniyatlar." },
  { icon: I.sprout, t: "Innovatsion yondashuv", d: "Yangi g'oyalar va zamonaviy yechimlar bilan ishlash." },
]

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <img src="/hero-bg.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-white/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/65 to-white/35" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
      </div>
      <div className="mx-auto max-w-[1320px] px-5 pt-7 lg:px-8">
        <Reveal>
          <nav className="flex items-center gap-2 text-sm text-muted">
            <Link to="/" className="flex items-center gap-1.5 hover:text-green">
              <Icon d="M3 12l9-9 9 9 M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" className="h-4 w-4" /> Bosh sahifa
            </Link>
            <span>/</span><span className="font-semibold text-green">Hamkorlar</span>
          </nav>
        </Reveal>
        <div className="grid items-center gap-8 py-8 lg:grid-cols-2">
          <div>
            <Reveal>
              <h1 className="font-display text-[clamp(2.4rem,6vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
                BIRGA <span className="text-green">O'SAYLIK,</span><br />BIRGA YUTAYLIK!
              </h1>
            </Reveal>
            <Reveal delay={90}>
              <p className="mt-5 max-w-md leading-relaxed text-muted">
                Agro Alliance — agro sohadagi innovatsion yechimlar va imkoniyatlarni
                birlashtiruvchi ishonchli hamkor platformasi.
              </p>
            </Reveal>
            <Reveal delay={160}>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="#" className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
                  <Icon d={I.handshake} className="h-5 w-5" /> HAMKOR BO'LISH
                </a>
                <a href="#yonalishlar" className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 bg-white px-6 py-3.5 font-bold text-ink transition-colors hover:border-green hover:text-green">
                  <Icon d={I.play} className="h-5 w-5" /> HAMKORLIK HAQIDA
                </a>
              </div>
            </Reveal>
          </div>
          <div className="relative hidden items-center justify-center lg:flex">
            <img src={mascot} alt="Agro Alliance" className="animate-float relative w-full max-w-[360px] object-contain drop-shadow-2xl" />
          </div>
        </div>
      </div>
    </section>
  )
}

function StatsRow() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-4 lg:px-8">
      <Reveal>
        <div className="grid grid-cols-2 gap-y-7 rounded-3xl border border-green/10 bg-white px-6 py-8 shadow-[0_10px_40px_rgba(91,180,32,0.08)] sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.l} className="flex items-center gap-3 px-2">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-green/20 text-green"><Icon d={s.icon} className="h-5 w-5" /></span>
              <div>
                <div className="font-display text-2xl font-extrabold leading-none">{s.v}</div>
                <div className="mt-1 text-xs font-medium text-muted">{s.l}</div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  )
}

function Directions() {
  return (
    <section id="yonalishlar" className="mx-auto max-w-[1320px] px-5 py-14 lg:px-8">
      <Reveal>
        <div className="mb-12 text-center">
          <h2 className="font-display text-[clamp(1.8rem,5vw,2.8rem)] font-extrabold tracking-tight">
            HAMKORLIK <span className="text-green">YO'NALISHLARI</span>
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-green/40" />
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Biz turli yo'nalishlarda yetakchi kompaniya va tashkilotlar bilan hamkorlik qilamiz.
            Quyidagi sohalarda o'zaro manfaatli hamkorlikni yo'lga qo'yganmiz.
          </p>
        </div>
      </Reveal>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {directions.map((c, i) => (
          <Reveal key={c.t} delay={(i % 5) * 70}>
            <div className="group h-full rounded-2xl border border-green/10 bg-white p-6 text-center shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:border-green/30 hover:shadow-[0_16px_44px_rgba(91,180,32,0.14)]">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-soft text-green transition-colors group-hover:bg-green group-hover:text-white">
                <Icon d={c.icon} className="h-8 w-8" />
              </span>
              <h3 className="mt-5 font-display font-bold">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function PartnerLogos() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8">
      <Reveal>
        <div className="mb-10 text-center">
          <h2 className="font-display text-[clamp(1.8rem,5vw,2.8rem)] font-extrabold tracking-tight">
            BIZNING <span className="text-green">HAMKORLARIMIZ</span>
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-green/40" />
          <p className="mx-auto mt-4 max-w-xl text-muted">Biz bilan birga ishlayotgan ba'zi hamkorlarimiz.</p>
        </div>
      </Reveal>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {partners.map((p, i) => (
          <Reveal key={p} delay={(i % 5) * 50}>
            <div className="grid h-24 place-items-center rounded-2xl border border-green/10 bg-white px-4 text-center font-display text-base font-extrabold tracking-tight text-ink/75 shadow-[0_4px_20px_rgba(91,180,32,0.05)] transition-all hover:-translate-y-1 hover:text-green hover:shadow-[0_12px_32px_rgba(91,180,32,0.12)]">
              {p}
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-10 text-center">
        <a href="#" className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 bg-white px-7 py-3.5 font-bold text-ink transition-colors hover:border-green hover:text-green">
          BARCHA HAMKORLARNI KO'RISH <Icon d={I.arrow} className="h-5 w-5" />
        </a>
      </div>
    </section>
  )
}

function CtaBanner() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-ink p-8 text-white lg:p-12">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-green/20 blur-3xl" />
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight">Hamkorlikka tayyormisiz?</h2>
              <p className="mt-3 max-w-md leading-relaxed text-white/70">
                Biz bilan hamkorlik qilib, agro sohada yangi imkoniyatlarni birga yarating!
              </p>
              <a href="#" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-green px-7 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
                HAMKOR BO'LISH <Icon d={I.send} className="h-5 w-5" />
              </a>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {benefits.map((b) => (
                <div key={b.t} className="flex gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-green"><Icon d={b.icon} className="h-5 w-5" /></span>
                  <div>
                    <h4 className="font-display font-bold">{b.t}</h4>
                    <p className="mt-1 text-sm leading-snug text-white/60">{b.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function Newsletter() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-16 lg:px-8">
      <Reveal>
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-green/15 bg-soft px-8 py-9 lg:flex-row lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-green/15 text-green"><Icon d={I.mail} className="h-7 w-7" /></span>
            <div>
              <h3 className="font-display text-xl font-extrabold leading-tight">Yangi hamkorlik va imkoniyatlardan xabardor bo'lib boring!</h3>
              <p className="mt-1 text-sm text-muted">Yangiliklar va takliflar haqida birinchilardan bo'lib xabar oling.</p>
            </div>
          </div>
          <div className="flex w-full gap-3 lg:w-auto">
            <input placeholder="Email manzilingiz" className="w-full rounded-xl border border-green/15 bg-white px-4 py-3.5 text-sm outline-none focus:border-green lg:w-64" />
            <button className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green px-6 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
              OBUNA BO'LISH <Icon d={I.send} className="h-5 w-5" />
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

export default function Partners() {
  return (
    <>
      <Hero />
      <StatsRow />
      <Directions />
      <PartnerLogos />
      <CtaBanner />
      <Newsletter />
    </>
  )
}
