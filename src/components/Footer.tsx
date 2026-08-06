import { Link } from "react-router-dom"
import { logoWhite, Icon, I } from "../lib/ui"
import { usePublicSettings, useContactInfo } from "../lib/settings"
import { useHomeSections } from "../lib/sections"
import { useT, tr } from "../lib/i18n"

const cols = [
  { h: "Platforma", links: [["Blogerlar", "/blogerlar"], ["Yangiliklar", "/yangiliklar"], ["Hamkorlar", "/hamkorlar"], ["Aloqa", "/aloqa"]] },
  { h: "Ma'lumot", links: [["Biz haqimizda", "/about"], ["Foydalanish shartlari", "/shartlar"], ["Maxfiylik siyosati", "/maxfiylik"], ["Qoidalar", "/shartlar"]] },
  { h: "Yordam", links: [["Ko'p so'raladigan savollar", "/aloqa"], ["Qo'llanma", "/aloqa"], ["Texnik yordam", "/aloqa"]] },
]

const socialIcons: Record<string, { icon: string; nom: string }> = {
  facebook_url: { icon: I.facebook, nom: "Facebook" },
  instagram_url: { icon: I.instagram, nom: "Instagram" },
  telegram_url: { icon: I.telegram, nom: "Telegram" },
  youtube_url: { icon: I.youtube, nom: "YouTube" },
}
const socialIconByKey: Record<string, { icon: string; nom: string }> = {
  social_facebook: { icon: I.facebook, nom: "Facebook" },
  social_instagram: { icon: I.instagram, nom: "Instagram" },
  social_telegram: { icon: I.telegram, nom: "Telegram" },
  social_youtube: { icon: I.youtube, nom: "YouTube" },
}
type FItem = { item_key?: string; title: string; description?: string; icon?: string; link?: string }

export default function Footer() {
  const { settings } = usePublicSettings()
  const { sections } = useHomeSections()
  // /aloqa sahifasi bilan BIR XIL manba — ikkalasi ajralib ketmasin.
  const contact = useContactInfo()
  const sLoading = contact.loading

  const fsec = sections.find((s) => s.section_key === "footer") as
    | { subtitle?: string; items?: FItem[] }
    | undefined

  const brandText = fsec?.subtitle || tr("Agro sohadagi innovatsion yechimlar va imkoniyatlarni birlashtiruvchi ishonchli media platformasi.")
  const contactRows = [
    { icon: I.phone, v: contact.phone },
    { icon: I.mail, v: contact.email },
    { icon: I.pin, v: contact.address },
  ].filter((r): r is { icon: string; v: string } => Boolean(r.v))

  const seededSocials = (fsec?.items || [])
    .filter((i) => i.item_key?.startsWith("social_") && i.link && i.link !== "#")
    .map((i) => {
      const m = socialIconByKey[i.item_key as string]
      return { url: i.link as string, icon: m?.icon || I.link2, nom: m?.nom || "Ijtimoiy tarmoq" }
    })
  const settingsSocials = Object.entries(socialIcons)
    .map(([key, m]) => ({ url: settings[key], icon: m.icon, nom: m.nom }))
    .filter((s) => s.url)
  const socialLinks = seededSocials.length ? seededSocials : settingsSocials
  const t = useT()

  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-[1320px] px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.3fr]">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logoWhite} alt="" width={88} height={88} loading="lazy" className="h-11 w-11 object-contain" />
              <span className="font-display text-lg font-extrabold tracking-tight">AGRO <span className="text-green-light">ALLIANCE</span></span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
              {brandText}
            </p>
            <div className="mt-5 flex gap-2.5">
              {socialLinks.map((s, i) => (
                /**
                 * `aria-label` SHART: havola ichida faqat ikonka bor va
                 * ekran o'quvchi uni "havola" deb o'qib, qayerga
                 * olib borishini ayta olmasdi. Ko'zi ojiz foydalanuvchi
                 * to'rtta bir xil "havola" eshitardi.
                 */
                <a key={i} href={s.url} target="_blank" rel="noreferrer"
                  aria-label={s.nom} title={s.nom}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white/80 transition-colors hover:bg-green hover:text-white">
                  <Icon d={s.icon} className="h-4 w-4" />
                </a>
              ))}
              {/* Yuklanayotganda — bo'sh joy egallovchi (layout sakramasligi uchun).
                  Yuklab bo'lgach havola yo'q bo'lsa, o'lik ikonkalarni umuman chizmaymiz. */}
              {sLoading && socialLinks.length === 0 && [0, 1, 2, 3].map((i) => (
                <span key={i} className="h-9 w-9 animate-pulse rounded-lg bg-white/10" />
              ))}
            </div>
          </div>

          {/* Link columns */}
          {cols.map((c) => (
            <div key={c.h}>
              <h4 className="font-display text-sm font-bold tracking-wide">{t(c.h)}</h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                {c.links.map(([label, to]) => (
                  <li key={label}>
                    <Link to={to} className="text-white/55 transition-colors hover:text-green-light">{t(label)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Aloqa */}
          <div>
            <h4 className="font-display text-sm font-bold tracking-wide">{t("Aloqa")}</h4>
            <ul className="mt-4 space-y-3 text-sm">
              {sLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="h-4 w-40 animate-pulse rounded bg-white/10" />
                  ))
                : contactRows.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-white/55">
                      <Icon d={r.icon} className="mt-0.5 h-4 w-4 shrink-0 text-green-light" /> {r.v}
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
            <Link to="/aloqa" className="transition-colors hover:text-green-light">Sayt xaritasi</Link>
            <span className="flex items-center gap-1.5">
              <Icon d={I.globe} className="h-4 w-4" /> {tr("O'zbek tili")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
