import { Link } from "react-router-dom"
import { logo, Icon, I } from "../lib/ui"

const cols = [
  { h: "Platforma", links: [["Blogerlar", "/blogerlar"], ["Yangiliklar", "/yangiliklar"], ["Hamkorlar", "/hamkorlar"], ["Aloqa", "/aloqa"]] },
  { h: "Ma'lumot", links: [["Biz haqimizda", "/about"], ["Foydalanish shartlari", "#"], ["Maxfiylik siyosati", "#"], ["Qoidalar", "#"]] },
  { h: "Yordam", links: [["Ko'p so'raladigan savollar", "/aloqa"], ["Qo'llanma", "#"], ["Texnik yordam", "#"]] },
]

const socials = [I.facebook, I.instagram, I.telegram, I.youtube]

const aloqa = [
  { icon: I.phone, v: "+998 90 123 45 67" },
  { icon: I.mail, v: "info@agroalliance.uz" },
  { icon: I.pin, v: "Toshkent, Amir Temur ko'chasi, 123-uy" },
]

export default function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-[1320px] px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.3fr]">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo} alt="" className="h-11 w-11 object-contain" />
              <span className="font-display text-lg font-extrabold tracking-tight">AGRO <span className="text-green">ALLIANCE</span></span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
              Agro sohadagi innovatsion yechimlar va imkoniyatlarni birlashtiruvchi ishonchli media platformasi.
            </p>
            <div className="mt-5 flex gap-2.5">
              {socials.map((d, i) => (
                <a key={i} href="#" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white/80 transition-colors hover:bg-green hover:text-white">
                  <Icon d={d} className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {cols.map((c) => (
            <div key={c.h}>
              <h4 className="font-display text-sm font-bold tracking-wide">{c.h}</h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                {c.links.map(([label, to]) => (
                  <li key={label}>
                    {to.startsWith("/") ? (
                      <Link to={to} className="text-white/55 transition-colors hover:text-green">{label}</Link>
                    ) : (
                      <a href="#" className="text-white/55 transition-colors hover:text-green">{label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Aloqa */}
          <div>
            <h4 className="font-display text-sm font-bold tracking-wide">Aloqa</h4>
            <ul className="mt-4 space-y-3 text-sm">
              {aloqa.map((a) => (
                <li key={a.v} className="flex items-start gap-2.5 text-white/55">
                  <Icon d={a.icon} className="mt-0.5 h-4 w-4 shrink-0 text-green" /> {a.v}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-4 px-5 py-5 text-sm text-white/50 sm:flex-row lg:px-8">
          <p>© 2026 AGRO ALLIANCE. Barcha huquqlar himoyalangan.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="transition-colors hover:text-green">Sayt xaritasi</a>
            <span className="flex items-center gap-1.5">
              <Icon d={I.globe} className="h-4 w-4" /> O'zbek tili
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
