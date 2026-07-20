import { Link } from "react-router-dom"
import { Reveal } from "../lib/ui"
import { useStaticSeo } from "../lib/seo"

export default function Terms() {
  useStaticSeo("/shartlar")
  return (
    <div className="mx-auto max-w-[820px] px-5 pt-7 pb-16 lg:px-8">
      <Reveal>
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
          <Link to="/" className="hover:text-green">Bosh sahifa</Link>
          <span>/</span>
          <span className="font-semibold text-green">Foydalanish shartlari</span>
        </nav>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Foydalanish shartlari</h1>
        <p className="mt-2 text-sm text-muted">Oxirgi yangilanish: 2024-yil, 1-yanvar</p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink/80">
          <section>
            <h2 className="font-display text-lg font-bold text-ink">1. Umumiy qoidalar</h2>
            <p className="mt-2">
              AGRO ALLIANCE platformasiga kirish orqali siz ushbu foydalanish shartlariga rozilik bildirasiz.
              Agar shartlarga rozi bo'lmasangiz, platformadan foydalanmangiz.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">2. Hisob yaratish</h2>
            <p className="mt-2">
              Platformadan foydalanish uchun hisob yaratishingiz kerak. Hisob ma'lumotlaringiz xavfsiz saqlanadi
              va faqat sizning ruxsatingiz bilan boshqalar bilan baham ko'riladi. Hisobingiz xavfsizligini
              ta'minlash sizning zimmangizda.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">3. Kontent qoidalari</h2>
            <p className="mt-2">
              Platformaga joylashtirilgan kontent mualliflik huquqi bilan himoyalangan.
              Boshqa foydalanuvchilarning kontentini ruxsatsiz ko'chirish yoki tarqatish taqiqlanadi.
              Agro soha bo'yicha foydali va haqiqiy kontent yaratishni tavsiya qilamiz.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">4. Maxfiylik</h2>
            <p className="mt-2">
              Shaxsiy ma'lumotlaringiz faqat platforma xizmatlarini ko'rsatish uchun ishlatiladi.
              Batafsil ma'lumot uchun{" "}
              <Link to="/maxfiylik" className="font-semibold text-green hover:underline">Maxfiylik siyosati</Link>
              ni o'qing.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">5. Javobgarlik</h2>
            <p className="mt-2">
              AGRO ALLIANCE platformasi foydalanuvchilar tomonidan yaratilgan kontent uchun
              javobgar emas. Foydalanuvchilar o'z kontentlari uchun shaxsiy javobgar.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">6. Aloqa</h2>
            <p className="mt-2">
              Savollaringiz bo'lsa, <Link to="/aloqa" className="font-semibold text-green hover:underline">Aloqa sahifasi</Link> orqali
              biz bilan bog'laning.
            </p>
          </section>
        </div>
      </Reveal>
    </div>
  )
}
