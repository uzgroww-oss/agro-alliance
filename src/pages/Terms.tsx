import { Link } from "react-router-dom"
import { Reveal } from "../lib/ui"
import { useStaticSeo } from "../lib/seo"
import { LEGAL_UPDATED } from "../lib/legal"
import { useT } from "../lib/i18n"

/**
 * Huquqiy matn JSX ichida sochilib yotgan edi — har bir band alohida
 * <section> bo'lib, ko'p qatorli matn bilan. Tarjima uchun (va matnni
 * tahrirlash uchun) uni MA'LUMOT sifatida saqlash qulayroq:
 * har band bitta qator, ya'ni t() kaliti aniq mos keladi.
 *
 * `link` — bandning oxiriga qo'shiladigan havola (ba'zi bandlarda bor).
 */
const BANDLAR: { h: string; p: string; link?: { to: string; matn: string; keyin: string } }[] = [
  {
    h: "1. Umumiy qoidalar",
    p: "AGRO ALLIANCE platformasiga kirish orqali siz ushbu foydalanish shartlariga rozilik bildirasiz. Agar shartlarga rozi bo'lmasangiz, platformadan foydalanmangiz.",
  },
  {
    h: "2. Hisob yaratish",
    p: "Platformadan foydalanish uchun hisob yaratishingiz kerak. Hisob ma'lumotlaringiz xavfsiz saqlanadi va faqat sizning ruxsatingiz bilan boshqalar bilan baham ko'riladi. Hisobingiz xavfsizligini ta'minlash sizning zimmangizda.",
  },
  {
    h: "3. Kontent qoidalari",
    p: "Platformaga joylashtirilgan kontent mualliflik huquqi bilan himoyalangan. Boshqa foydalanuvchilarning kontentini ruxsatsiz ko'chirish yoki tarqatish taqiqlanadi. Agro soha bo'yicha foydali va haqiqiy kontent yaratishni tavsiya qilamiz.",
  },
  {
    h: "4. Maxfiylik",
    p: "Shaxsiy ma'lumotlaringiz faqat platforma xizmatlarini ko'rsatish uchun ishlatiladi. Batafsil ma'lumot uchun",
    link: { to: "/maxfiylik", matn: "Maxfiylik siyosati", keyin: "ni o'qing." },
  },
  {
    h: "5. Javobgarlik",
    p: "AGRO ALLIANCE platformasi foydalanuvchilar tomonidan yaratilgan kontent uchun javobgar emas. Foydalanuvchilar o'z kontentlari uchun shaxsiy javobgar.",
  },
  {
    h: "6. Aloqa",
    p: "Savollaringiz bo'lsa,",
    link: { to: "/aloqa", matn: "Aloqa sahifasi", keyin: "orqali biz bilan bog'laning." },
  },
]

export default function Terms() {
  useStaticSeo("/shartlar")
  const t = useT()
  return (
    <div className="mx-auto max-w-[820px] px-5 pt-7 pb-16 lg:px-8">
      <Reveal>
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
          <Link to="/" className="hover:text-green">{t("Bosh sahifa")}</Link>
          <span>/</span>
          <span className="font-semibold text-green">{t("Foydalanish shartlari")}</span>
        </nav>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("Foydalanish shartlari")}</h1>
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
                    {" "}{t(b.link.keyin)}
                  </>
                )}
              </p>
            </section>
          ))}
        </div>
      </Reveal>
    </div>
  )
}
