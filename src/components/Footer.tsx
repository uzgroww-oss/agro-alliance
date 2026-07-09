import { Link } from "react-router-dom"
import { logo, Icon, I } from "../lib/ui"
import { usePublicSettings } from "../lib/settings"

const cols = [
  { h: "Platforma", links: [["Blogerlar", "/blogerlar"], ["Yangiliklar", "/yangiliklar"], ["Hamkorlar", "/hamkorlar"], ["Aloqa", "/aloqa"]] },
  { h: "Ma'lumot", links: [["Biz haqimizda", "/about"], ["Foydalanish shartlari", "/shartlar"], ["Maxfiylik siyosati", "/maxfiylik"], ["Qoidalar", "/shartlar"]] },
  { h: "Yordam", links: [["Ko'p so'raladigan savollar", "/aloqa"], ["Qo'llanma", "/aloqa"], ["Texnik yordam", "/aloqa"]] },
]

const socialIcons: Record<string, string> = {
  facebook_url: I.facebook,
  instagram_url: I.instagram,
  telegram_url: I.telegram,
  youtube_url: I.youtube,
}

export default function Footer() {
  const { settings } = usePublicSettings()

  const phone = settings.contact_phone || "+998 90 123 45 67"
  const email = settings.contact_email || "info@agroalliance.uz"
  const address = settings.contact_address || "Toshkent, Amir Temur ko'chasi, 123-uy"

  const socialLinks = Object.entries(socialIcons)
    .map(([key, icon]) => ({ url: settings[key], icon }))
    .filter((s) => s.url)

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
              {socialLinks.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white/80 transition-colors hover:bg-green hover:text-white">
                  <Icon d={s.icon} className="h-4 w-4" />
                </a>
              ))}
              {socialLinks.length === 0 && [I.facebook, I.instagram, I.telegram, I.youtube].map((d, i) => (
                <span key={i} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white/40">
                  <Icon d={d} className="h-4 w-4" />
                </span>
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
                    <Link to={to} className="text-white/55 transition-colors hover:text-green">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Aloqa */}
          <div>
            <h4 className="font-display text-sm font-bold tracking-wide">Aloqa</h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2.5 text-white/55">
                <Icon d={I.phone} className="mt-0.5 h-4 w-4 shrink-0 text-green" /> {phone}
              </li>
              <li className="flex items-start gap-2.5 text-white/55">
                <Icon d={I.mail} className="mt-0.5 h-4 w-4 shrink-0 text-green" /> {email}
              </li>
              <li className="flex items-start gap-2.5 text-white/55">
                <Icon d={I.pin} className="mt-0.5 h-4 w-4 shrink-0 text-green" /> {address}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-4 px-5 py-5 text-sm text-white/50 sm:flex-row lg:px-8">
          <p>© 2026 AGRO ALLIANCE. Barcha huquqlar himoyalangan.</p>
          <div className="flex items-center gap-6">
            <Link to="/aloqa" className="transition-colors hover:text-green">Sayt xaritasi</Link>
            <span className="flex items-center gap-1.5">
              <Icon d={I.globe} className="h-4 w-4" /> O'zbek tili
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
