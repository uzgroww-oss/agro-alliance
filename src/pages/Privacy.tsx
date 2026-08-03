import { Link } from "react-router-dom"
import { Reveal } from "../lib/ui"
import { useStaticSeo } from "../lib/seo"
import { LEGAL_UPDATED } from "../lib/legal"
import { useT } from "../lib/i18n"

/**
 * Terms.tsx dagi kabi: huquqiy matn MA'LUMOT sifatida saqlanadi.
 * Har band bitta qator — t() kaliti aniq mos keladi va matnni
 * tahrirlash ham osonroq.
 */
const BANDLAR: {
  h: string
  p: string
  royxat?: string[]
  link?: { to: string; matn: string; keyin: string }
}[] = [
  {
    h: "1. Ma'lumotlarni yig'ish",
    p: "Biz faqat xizmatlarimizni ko'rsatish uchun zarur bo'lgan ma'lumotlarni yig'amiz: ism, email manzili, telefon raqami va profil ma'lumotlari.",
  },
  {
    h: "2. Ma'lumotlarni ishlatish",
    p: "Shaxsiy ma'lumotlaringiz quyidagi maqsadlarda ishlatiladi:",
    royxat: [
      "Platforma xizmatlarini ko'rsatish va yaxshilash",
      "Siz bilan aloqa bog'lash",
      "Hisobingizni boshqarish",
      "Xavfsizlikni ta'minlash",
    ],
  },
  {
    h: "3. Ma'lumotlarni saqlash",
    p: "Shaxsiy ma'lumotlaringiz xavfsiz serverlarda saqlanadi va ruxsatsiz kirishdan himoyalangan. Biz SSL shifrlash va boshqa xavfsizlik texnologiyalaridan foydalanamiz.",
  },
  {
    h: "4. Uchinchi tomon bilan bo'lishish",
    p: "Biz shaxsiy ma'lumotlaringizni uchinchi tomonlarga sotmaymiz yoki ijaraga bermaymiz. Faqat qonuniy talablar bo'yicha va sizning ruxsatingiz bilan bo'lishish mumkin.",
  },
  {
    h: "5. Cookie fayllari",
    p: "Platforma tajribasini yaxshilash uchun cookie fayllaridan foydalanamiz. Brauzer sozlamalaringiz orqali cookie fayllarni boshqarishingiz mumkin.",
  },
  {
    h: "6. Huquqlaringiz",
    p: "Siz o'z shaxsiy ma'lumotlaringizni ko'rish, tahrirlash yoki o'chirish huquqiga egasiz. Batafsil ma'lumot uchun",
    link: { to: "/aloqa", matn: "biz bilan bog'laning", keyin: "." },
  },
]

export default function Privacy() {
  useStaticSeo("/maxfiylik")
  const t = useT()
  return (
    <div className="mx-auto max-w-[820px] px-5 pt-7 pb-16 lg:px-8">
      <Reveal>
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
          <Link to="/" className="hover:text-green">{t("Bosh sahifa")}</Link>
          <span>/</span>
          <span className="font-semibold text-green">{t("Maxfiylik siyosati")}</span>
        </nav>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("Maxfiylik siyosati")}</h1>
        <p className="mt-2 text-sm text-muted">{t("Oxirgi yangilanish:")} {LEGAL_UPDATED}</p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink/80">
          {BANDLAR.map((b) => (
            <section key={b.h}>
              <h2 className="font-display text-lg font-bold text-ink">{t(b.h)}</h2>
              <p className="mt-2">
                {t(b.p)}
                {b.link && (
                  <>
                    {" "}
                    <Link to={b.link.to} className="font-semibold text-green hover:underline">{t(b.link.matn)}</Link>
                    {t(b.link.keyin)}
                  </>
                )}
              </p>
              {b.royxat && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {b.royxat.map((r) => <li key={r}>{t(r)}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </Reveal>
    </div>
  )
}
