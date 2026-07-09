import { Link } from "react-router-dom"
import { Reveal } from "../lib/ui"

export default function Privacy() {
  return (
    <div className="mx-auto max-w-[820px] px-5 pt-7 pb-16 lg:px-8">
      <Reveal>
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
          <Link to="/" className="hover:text-green">Bosh sahifa</Link>
          <span>/</span>
          <span className="font-semibold text-green">Maxfiylik siyosati</span>
        </nav>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Maxfiylik siyosati</h1>
        <p className="mt-2 text-sm text-muted">Oxirgi yangilanish: 2024-yil, 1-yanvar</p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink/80">
          <section>
            <h2 className="font-display text-lg font-bold text-ink">1. Ma'lumotlarni yig'ish</h2>
            <p className="mt-2">
              Biz faqat xizmatlarimizni ko'rsatish uchun zarur bo'lgan ma'lumotlarni yig'amiz:
              ism, email manzili, telefon raqami va profil ma'lumotlari.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">2. Ma'lumotlarni ishlatish</h2>
            <p className="mt-2">
              Shaxsiy ma'lumotlaringiz quyidagi maqsadlarda ishlatiladi:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Platforma xizmatlarini ko'rsatish va yaxshilash</li>
              <li>Siz bilan aloqa bog'lash</li>
              <li>Hisobingizni boshqarish</li>
              <li>Xavfsizlikni ta'minlash</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">3. Ma'lumotlarni saqlash</h2>
            <p className="mt-2">
              Shaxsiy ma'lumotlaringiz xavfsiz serverlarda saqlanadi va ruxsatsiz
              kirishdan himoyalangan. Biz SSL shifrlash va boshqa xavfsizlik texnologiyalaridan foydalanamiz.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">4. Uchinchi tomon bilan bo'lishish</h2>
            <p className="mt-2">
              Biz shaxsiy ma'lumotlaringizni uchinchi tomonlarga sotmaymiz yoki
              ijaraga bermaymiz. Faqat qonuniy talablar bo'yicha va sizning ruxsatingiz bilan
              bo'lishish mumkin.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">5. Cookie fayllari</h2>
            <p className="mt-2">
              Platforma tajribasini yaxshilash uchun cookie fayllaridan foydalanamiz.
              Brauzer sozlamalaringiz orqali cookie fayllarni boshqarishingiz mumkin.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">6. Huquqlaringiz</h2>
            <p className="mt-2">
              Siz o'z shaxsiy ma'lumotlaringizni ko'rish, tahrirlash yoki o'chirish huquqiga egasiz.
              Batafsil ma'lumot uchun{" "}
              <Link to="/aloqa" className="font-semibold text-green hover:underline">biz bilan bog'laning</Link>.
            </p>
          </section>
        </div>
      </Reveal>
    </div>
  )
}
