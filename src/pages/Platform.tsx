import { Link } from "react-router-dom"
import { Reveal, Icon, I } from "../lib/ui"

const mascot = "/mascot.webp"

const heroStats = [
  { icon: I.users, v: "120+", l: "Faol blogerlar" },
  { icon: I.sprout, v: "50+", l: "Hamkor kompaniyalar" },
  { icon: I.play, v: "1M+", l: "Ko'rilishlar" },
  { icon: I.building, v: "20+", l: "Hududlarda faoliyat" },
]

const capabilities = [
  { icon: I.users, t: "CREATOR MARKETPLACE", d: "Agro blogerlar bilan hamkorlik qiling, kampaniyalar yarating va brendingizni rivojlantiring." },
  { icon: I.robot, t: "AI ASSISTANT", d: "AI yordamchimiz sizga kontent g'oyalari, tahlil, matn yozish va strategiya tuzishda yordam beradi." },
  { icon: I.doc, t: "CONTRACT CENTER", d: "Xavfsiz shartnomalar tuzing, imzolang va barcha bitimlaringizni bir joyda boshqaring." },
  { icon: I.chart, t: "ANALYTICS", d: "Kengaytirilgan tahlillar, ko'rsatkichlar va hisobotlar orqali samaradorlikni oshiring." },
  { icon: I.cap, t: "AGRO ACADEMY", d: "Agro soha bo'yicha bilim oling, kurslar va vebinarlarda qatnashing, malakangizni oshiring." },
  { icon: I.megaphone, t: "CAMPAIGN MANAGEMENT", d: "Kampaniyalarni rejalashtiring, blogerlarni tanlang, natijalarni kuzating va boshqaring." },
  { icon: I.task, t: "TASK MANAGER", d: "Vazifalarni yaratish, taqsimlash va bajarilishini nazorat qilish oson va samarali." },
  { icon: I.media, t: "MEDIA HUB", d: "Barcha video, rasm va kontentlaringizni saqlang, boshqaring va jamoa bilan ulashing." },
  { icon: I.wallet, t: "TO'LOVLAR VA HISOB-KITOB", d: "Xavfsiz to'lovlar, avtomatik hisob-kitoblar va shaffof moliyaviy boshqaruv tizimi." },
]

const bigStats = [
  { icon: I.users, v: "120+", l: "Faol blogerlar" },
  { icon: I.sprout, v: "50+", l: "Hamkor kompaniyalar" },
  { icon: I.play, v: "1M+", l: "Ko'rilishlar" },
  { icon: I.building, v: "20+", l: "Hududlarda faoliyat" },
]

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <img src="/hero-bg.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-white/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/65 to-white/35" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
      </div>
      <div className="mx-auto max-w-[1320px] px-5 pt-7 lg:px-8">
        <Reveal>
          <nav className="flex items-center gap-2 text-sm text-muted">
            <Link to="/" className="flex items-center gap-1.5 hover:text-green">
              <Icon d="M3 12l9-9 9 9 M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" className="h-4 w-4" />
              Bosh sahifa
            </Link>
            <span>/</span>
            <span className="font-semibold text-green">Platforma</span>
          </nav>
        </Reveal>

        <div className="grid gap-8 pt-8 pb-10 xl:grid-cols-[1fr_0.7fr_320px]">
          {/* Left */}
          <div className="flex flex-col justify-center">
            <Reveal>
              <h1 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.05] tracking-[-0.02em]">
                BARCHA AGRO IMKONIYATLAR<br />
                <span className="text-ink">BIR </span><span className="text-green">PLATFORMADA</span>
              </h1>
            </Reveal>
            <Reveal delay={90}>
              <p className="mt-5 max-w-md leading-relaxed text-muted">
                Agro Alliance вЂ” agro blogerlar, fermerlar, kompaniyalar va texnologiyalarni
                birlashtiruvchi innovatsion media va xizmatlar platformasi.
              </p>
            </Reveal>
            <Reveal delay={160}>
              <div className="mt-7 flex flex-wrap gap-4">
                <Link to="#" className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
                  <Icon d={I.shield} className="h-5 w-5" /> PLATFORMAGA KIRISH
                </Link>
                <a href="#imkoniyatlar" className="inline-flex items-center gap-2 rounded-xl border-2 border-green/30 bg-white px-6 py-3.5 font-bold text-ink transition-colors hover:border-green hover:text-green">
                  <Icon d={I.play} className="h-5 w-5" /> PLATFORMA IMKONIYATLARI
                </a>
              </div>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 grid max-w-xl grid-cols-2 gap-5 sm:grid-cols-4">
                {heroStats.map((s) => (
                  <div key={s.l} className="flex items-center gap-2.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-green/20 text-green">
                      <Icon d={s.icon} className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-display text-lg font-extrabold leading-none">{s.v}</div>
                      <div className="mt-0.5 text-[11px] text-muted">{s.l}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Center mascot */}
          <div className="relative hidden items-center justify-center xl:flex">
            <img src={mascot} alt="Agro Alliance" className="animate-float relative w-full max-w-[360px] object-contain drop-shadow-2xl" />
          </div>

          {/* Right quote card */}
          <Reveal delay={160}>
            <div className="flex h-full flex-col justify-center rounded-3xl border border-green/10 bg-white p-7 shadow-[0_12px_44px_rgba(91,180,32,0.10)]">
              <Icon d={I.quote} className="h-8 w-8 text-green/40" sw={2.2} />
              <p className="mt-4 text-lg font-medium leading-relaxed text-ink/80">
                Bizning platforma sizga vaqtni tejash, daromadni oshirish va maqsadlaringizga
                tezroq yetishishda yordam beradi!
              </p>
              <a href="#" className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-soft px-5 py-2.5 text-sm font-bold text-green transition-colors hover:bg-green hover:text-white">
                <Icon d={I.sprout} className="h-4 w-4" /> BIZ BILAN O'SING
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Capabilities() {
  return (
    <section id="imkoniyatlar" className="mx-auto max-w-[1320px] px-5 py-14 lg:px-8">
      <Reveal>
        <div className="mb-12 text-center">
          <h2 className="font-display text-[clamp(1.8rem,5vw,2.8rem)] font-extrabold tracking-tight">
            PLATFORMA <span className="text-green">IMKONIYATLARI</span>
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-green/40" />
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Biz sizga agro sohada muvaffaqiyatga erishishingiz uchun barcha kerakli vositalarni taqdim etamiz.
          </p>
        </div>
      </Reveal>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {capabilities.map((c, i) => (
          <Reveal key={c.t} delay={(i % 3) * 80}>
            <div className="group flex h-full flex-col rounded-2xl border border-green/10 bg-white p-7 shadow-[0_4px_24px_rgba(91,180,32,0.06)] transition-all hover:-translate-y-1 hover:border-green/30 hover:shadow-[0_16px_44px_rgba(91,180,32,0.14)]">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-soft text-green transition-colors group-hover:bg-green group-hover:text-white">
                <Icon d={c.icon} className="h-7 w-7" />
              </span>
              <h3 className="mt-5 font-display text-lg font-bold tracking-wide">{c.t}</h3>
              <p className="mt-2 flex-1 leading-relaxed text-muted">{c.d}</p>
              <a href="#" className="mt-5 inline-flex items-center gap-2 font-display text-sm font-bold text-green">
                BATAFSIL <Icon d={I.arrow} className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function BigStats() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-8 lg:px-8">
      <Reveal>
        <div className="grid items-center gap-8 rounded-3xl border border-green/10 bg-soft px-8 py-10 shadow-[0_10px_40px_rgba(91,180,32,0.08)] lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h3 className="font-display text-2xl font-extrabold leading-tight tracking-tight">
              BIRGALIKDA KATTA<br />NATIJALARGA ERISHAYLIK!
            </h3>
            <p className="mt-3 max-w-sm leading-relaxed text-muted">
              Platformamiz orqali minglab blogerlar va kompaniyalar hamkorlik qilib, agro sohani birga rivojlantirmoqda.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {bigStats.map((s) => (
              <div key={s.l} className="text-center">
                <Icon d={s.icon} className="mx-auto h-8 w-8 text-green" />
                <div className="mt-2 font-display text-3xl font-extrabold">{s.v}</div>
                <div className="mt-1 text-xs text-muted">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function JoinCta() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-16 lg:px-8">
      <Reveal>
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-green/15 bg-white px-8 py-9 shadow-[0_10px_40px_rgba(91,180,32,0.08)] lg:flex-row lg:justify-between">
          <div>
            <h3 className="font-display text-2xl font-extrabold tracking-tight">PLATFORMAGA QO'SHILING</h3>
            <p className="mt-2 max-w-lg leading-relaxed text-muted">
              Agro sohada o'sish, rivojlanish va ko'proq imkoniyatlarga ega bo'lish uchun hoziroq platformamizga qo'shiling!
            </p>
          </div>
          <a href="#" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green px-8 py-4 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105">
            <Icon d={I.login} className="h-5 w-5" /> PLATFORMAGA KIRISH
          </a>
        </div>
      </Reveal>
    </section>
  )
}

export default function Platform() {
  return (
    <>
      <Hero />
      <Capabilities />
      <BigStats />
      <JoinCta />
    </>
  )
}
