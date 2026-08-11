import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Icon, I, logo, Skeleton, SkeletonStatGrid, ErrorState } from "../../lib/ui"
import { api } from "../../lib/api"
import { useAuth } from "../../lib/auth"
import { tr } from "../../lib/i18n"

/**
 * HAMKOR KABINETI — FAQAT VIDEOLAR STATISTIKASI.
 *
 * Ilgari yetti bo'lim va yon menyu bor edi: Umumiy, Kompaniya
 * profili, Shartnoma, Videolar, Topshiriqlar, Hisobot, Sozlamalar.
 * Hammasi olib tashlandi — kompaniyaga ulardan hech biri kerak
 * emasligi aytildi.
 *
 * Qoladigan yagona narsa: bloger o'z profiliga video qo'shayotib shu
 * kompaniyani belgilagan bo'lsa, o'sha videolarning KO'RSATKICHLARI.
 * Videolar ro'yxatining o'zi ham kerak emas — faqat raqamlar va
 * diagrammalar.
 *
 * Bitta sahifa qolgani uchun yon menyu ham yo'q (pastdagi izohga
 * qarang).
 */

type Task = { id: number; title: string; status: "done" | "progress" | "pending" }
type Partner = {
  id: number; name: string; sphere: string; contractNo: string
  amount: number; signedDate: string; status: string; tasks: Task[]
}
type PartnerVideo = {
  id: string; name: string; link: string; views: string; likes: string; comments: string
  duration: string; description: string; channel: string
  plats: string[]; date: string; thumbnail: string | null
  /** Blogerning asosiy viloyati — reklama qaysi hududga tushgani */
  viloyat: string
  blogger: { id: string; name: string; slug: string | null; avatar: string | null }
}
type TopBlogger = {
  id: string; name: string; slug: string | null; avatar: string | null
  videos: number; views: number; likes: number; comments: number
}
type VideoStats = {
  total: number; views: number; likes: number; comments: number
  bloggers: number; platforms: Record<string, number>
  platformViews: Record<string, number>
  monthly: { oy: string; views: number; videos: number }[]
  daily: { kun: string; views: number; likes: number; videos: number }[]
  regions: { viloyat: string; videos: number; views: number; likes: number }[]
  topBloggers: TopBlogger[]
  lastDate: string
}

/* ==========================================================================
   DIAGRAMMA RANGLARI
   ==========================================================================
   Ranglar KO'ZDAN emas, tekshiruvdan o'tkazib tanlangan: har juftlik
   rangni ajrata olmaydigan odam uchun ham (deutan/protan/tritan), oddiy
   ko'rish uchun ham yetarlicha farq qiladi.

   Tarmoqlarning O'Z brend ranglari ishlatilmadi: Telegram va Facebook
   ikkalasi ham ko'k, YouTube va Instagram esa qizil-pushti — donut
   bo'laklari bir-biriga qo'shilib ketardi. Shuning uchun rang faqat
   yordamchi belgi, ASOSIY belgi — yozuv: har bo'lak nomi va foizi
   bilan birga ko'rsatiladi.
   ========================================================================== */
const PLATFORMA_RANG: Record<string, string> = {
  YouTube: "#e34948",
  Telegram: "#2a78d6",
  Instagram: "#eda100",
  Facebook: "#4a3aa7",
}
/** Ro'yxatda yo'q tarmoq uchun — kulrang, "boshqa" ma'nosida */
const BOSHQA_RANG = "#6b7280"
const rangOl = (nom: string) => PLATFORMA_RANG[nom] || BOSHQA_RANG

/** Ustunlar rangi — bitta qator, shuning uchun bitta rang */
const USTUN_RANG = "#2f7d1f"

/**
 * Katta sonni qisqartiradi: 1 250 -> "1.3K", 12 500 -> "13K".
 *
 * Chegara YAXLITLANGAN qiymat bo'yicha tekshiriladi, xom son bo'yicha
 * emas. Ilgari 999 999 "1000K" bo'lib chiqardi (999.999 yaxlitlanib
 * 1000 bo'lardi, prefiks esa "K" bo'lib qolardi), 1 000 000 esa
 * "1.0M" — ya'ni bitta ko'rish farqda yozuv sakrab ketardi. Xuddi
 * shunday 9 999 "10.0K", 10 000 esa "10K" bo'lardi.
 */
const qisqaSon = (n: number): string => {
  const birlik = (v: number, belgi: string) => {
    const r = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10
    return `${r >= 10 ? r.toFixed(0) : r.toFixed(1)}${belgi}`
  }
  if (n >= 999_500_000) return birlik(n / 1_000_000_000, "B")
  if (n >= 999_500) return birlik(n / 1_000_000, "M")
  if (n >= 999.5) return birlik(n / 1_000, "K")
  return String(Math.round(n))
}

/**
 * Foizlarni yig'indisi ANIQ 100 bo'ladigan qilib yaxlitlaydi.
 *
 * Oddiy `Math.round` da 56 + 28 + 14 + 3 = 101 chiqardi va bu
 * diagrammada darrov ko'zga tashlanadi. Eng katta qoldiqli
 * bo'laklarga bittadan qo'shib, farq yopiladi.
 */
function foizlar(qiymatlar: number[]): number[] {
  const jami = qiymatlar.reduce((s, n) => s + n, 0)
  if (jami <= 0) return qiymatlar.map(() => 0)
  const aniq = qiymatlar.map((n) => (n / jami) * 100)
  const past = aniq.map(Math.floor)
  let qoldiq = 100 - past.reduce((s, n) => s + n, 0)
  const tartib = aniq
    .map((n, i) => ({ i, kasr: n - Math.floor(n) }))
    .sort((a, b) => b.kasr - a.kasr)
  for (const { i } of tartib) {
    if (qoldiq <= 0) break
    past[i] += 1
    qoldiq -= 1
  }
  return past
}

/**
 * Ko'rishlar matn sifatida saqlanadi va manbaga qarab har xil
 * ko'rinishda bo'ladi: "12500", "12.5K", "1,2M". Hisoblashdan oldin
 * songa keltiriladi (serverdagi `sonGa` bilan bir xil qoida).
 */
function songa(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  if (typeof v !== "string") return 0
  const s = v.trim().replace(/\s/g, "").replace(",", ".")
  const m = s.match(/^([\d.]+)\s*([KkMmBb])?$/)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return 0
  const k = (m[2] || "").toLowerCase()
  return Math.round(n * (k === "k" ? 1e3 : k === "m" ? 1e6 : k === "b" ? 1e9 : 1))
}

type Korsatkich = {
  total: number; views: number; likes: number; comments: number
  platforms: Record<string, number>
  platformViews: Record<string, number>
}

/**
 * Ko'rsatkichlarni BERILGAN videolar to'plamidan hisoblaydi.
 *
 * Oy tanlanganda hammasi qaytadan hisoblanishi kerak — serverdan
 * yangi so'rov yubormaymiz, chunki videolar allaqachon qo'lda.
 */
function hisobla(list: PartnerVideo[]): Korsatkich {
  const platforms: Record<string, number> = {}
  const platformViews: Record<string, number> = {}
  let views = 0, likes = 0, comments = 0

  for (const v of list) {
    const k = songa(v.views), y = songa(v.likes), i = songa(v.comments)
    views += k; likes += y; comments += i
    // Bir video bir nechta tarmoqda bo'lsa BIRINCHISIGA yoziladi —
    // aks holda ulushlar yig'indisi 100% dan oshib ketardi
    const asosiy = v.plats[0] || "Boshqa"
    platforms[asosiy] = (platforms[asosiy] || 0) + 1
    platformViews[asosiy] = (platformViews[asosiy] || 0) + k
  }

  /* Bloger kesimi HISOBLANMAYDI: kompaniyaga video natijasi kerak,
     kim joylagani emas — "Eng samarali blogerlar" bo'limi bilan
     birga olib tashlandi. */
  return { total: list.length, views, likes, comments, platforms, platformViews }
}

const OY_NOMI = [tr("Yan"), tr("Fev"), tr("Mar"), tr("Apr"), tr("May"), tr("Iyn"), tr("Iyl"), tr("Avg"), tr("Sen"), tr("Okt"), tr("Noy"), tr("Dek")]
const oyYorlig = (oy: string) => {
  const [y, m] = oy.split("-")
  return { nom: OY_NOMI[Number(m) - 1] || m, yil: y }
}

const partnerStatusMeta: Record<string, { label: string; cls: string }> = {
  active: { label: tr("Faol"), cls: "bg-green/10 text-green" },
  pending: { label: tr("Kutilmoqda"), cls: "bg-orange-100 text-orange-600" },
  completed: { label: tr("Yakunlangan"), cls: "bg-blue-100 text-blue-600" },
}
/**
 * Kartalarning umumiy uslubi.
 * `rounded-3xl` + kuchliroq soya: bloklar fondan aniq ajralib tursin,
 * chunki sahifada endi yon menyu yo'q va tuzilishni faqat kartalar
 * beradi.
 */
const card = "min-w-0 rounded-3xl border border-green/10 bg-white p-6 shadow-[0_8px_30px_rgba(91,180,32,0.07)]"

export default function PartnerDashboard() {
  const [partner, setPartner] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const { user, logout } = useAuth()
  const nav2 = useNavigate()

  const reload = () => {
    // Qayta urinishda eski xato va skeleton to'g'ri tiklanishi kerak
    setLoading(true)
    setErr("")
    api<{ partner: Partner }>("/me/partner")
      .then((d) => setPartner(d.partner))
      .catch((e) => setErr(e?.message || "Ma'lumotni yuklab bo'lmadi"))
      .finally(() => setLoading(false))
    /* `/client/partner` so'rovi OLIB TASHLANDI — u faqat kompaniya
       profili formasi uchun kerak edi, forma esa endi yo'q. */
  }
  useEffect(() => { reload() }, [])


  const initials = (user?.name || "HK").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const doLogout = () => { logout(); nav2("/kirish") }
  const ps = partner ? (partnerStatusMeta[partner.status] || partnerStatusMeta.active) : null

  return (
    /**
     * YON MENYU YO'Q.
     *
     * Kabinetda bitta sahifa qoldi — tanlanadigan bo'lim yo'q, ya'ni
     * yon panel faqat joy egallab, bitta yoqilgan tugmani ko'rsatib
     * turardi. O'rniga ixcham yuqori panel: kompaniya nomi va chiqish.
     *
     * `DashboardLayout` shu sababdan ishlatilmaydi — u nav ro'yxati
     * atrofida qurilgan.
     */
    <div className="min-h-screen bg-[#f7faf4]">
      <header className="sticky top-0 z-30 border-b border-green/10 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="" width={88} height={88} className="h-8 w-8 object-contain" />
            <span className="font-display text-base font-extrabold tracking-tight">
              AGRO <span className="text-green">ALLIANCE</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-bold leading-tight">{user?.name || tr("Hamkor")}</div>
              <div className="text-[11px] text-muted">{tr("Hamkor kompaniya")}</div>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green/10 text-sm font-bold text-green">{initials}</span>
            <button onClick={doLogout} title={tr("Chiqish")} aria-label={tr("Chiqish")}
              className="grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:bg-soft hover:text-ink">
              <Icon d={I.login} className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        {loading && (
          <div className="space-y-6">
            <SkeletonStatGrid />
            <Skeleton className="h-80 w-full rounded-3xl" />
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-64 w-full rounded-3xl" />
              <Skeleton className="h-64 w-full rounded-3xl" />
            </div>
          </div>
        )}

        {err && !loading && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="font-semibold text-red-600">{err}</p>
            <p className="mt-1 text-sm text-red-500">{tr("Internet aloqasini tekshiring yoki qaytadan kiring.")}</p>
            <button onClick={reload}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white">
              <Icon d={I.refresh} className="h-4 w-4" /> {tr("Qayta urinish")}
            </button>
          </div>
        )}

        {!loading && !err && !partner && (
          <div className="grid min-h-[50vh] place-items-center text-center">
            <div>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-soft text-green"><Icon d={I.building} className="h-8 w-8" /></span>
              <h2 className="mt-4 font-display text-xl font-bold">{tr("Kompaniya topilmadi")}</h2>
              <p className="mt-2 text-muted">{tr("Hisobingizga biriktirilgan hamkor kompaniya topilmadi. Administrator bilan bog'laning.")}</p>
            </div>
          </div>
        )}

        {partner && (
          <>
            {/* Kompaniya sarlavhasi — kimning paneli ekani ko'rinib tursin */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-green/10 text-green">
                <Icon d={I.building} className="h-6 w-6" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-extrabold tracking-tight">{partner.name}</h1>
                  {ps && <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${ps.cls}`}>{ps.label}</span>}
                </div>
                <p className="mt-0.5 text-sm text-muted">{partner.sphere || tr("Hamkor kompaniya")}</p>
              </div>
            </div>

            <PartnerVideos partnerId={String(partner.id)} />
          </>
        )}
      </main>
    </div>
  )
}










/* ---------- Diagrammalar ---------- */

/**
 * OYLIK KO'RSATKICH — bir yillik, oylar bo'yicha ustunlar.
 *
 * Bitta qator (ko'rishlar), shuning uchun BITTA rang va afsona
 * (legend) yo'q — sarlavha nima chizilganini aytadi. Har ustunga
 * raqam yozilmaydi: eng kattasi belgilanadi, qolganlari sichqoncha
 * ustiga kelganda ko'rinadi.
 *
 * Video yo'q oylar ham qoladi — ular tashlab ketilsa vaqt o'qi
 * buzilib, tanaffuslar ko'rinmasdi.
 */
function OylikGrafik({ data, tanlangan, onTanla }: {
  data: VideoStats["monthly"]
  /** Tanlangan oy ("YYYY-MM") yoki null — jami */
  tanlangan: string | null
  onTanla: (oy: string | null) => void
}) {
  const [ustida, setUstida] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.views))
  const engKattaIdx = data.reduce((eng, d, i) => (d.views > data[eng].views ? i : eng), 0)
  const jami = data.reduce((s, d) => s + d.views, 0)

  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{tr("Oylik ko'rishlar")}</h3>
        <span className="text-xs text-muted">{tr("so'nggi 12 oy")} · {qisqaSon(jami)}</span>
      </div>
      {/* Raqam nimani anglatishini AYTAMIZ: ijtimoiy tarmoqlar
          ko'rishlarning kunlik tarixini bermaydi, faqat joriy jami
          raqamni. Shusiz kompaniya buni "shu oyda shuncha ko'rildi"
          deb o'qib, noto'g'ri xulosa chiqarardi. */}
      <p className="mt-0.5 text-xs text-muted">
        {tr("Shu oyda chiqarilgan videolar bugungi kunga yig'gan ko'rishlar")}
        {" · "}
        <span className="font-semibold">{tr("oyni bosing")}</span>
      </p>

      <div className="relative mt-5">
        {/* Yuqori chegara chizig'i — o'qsiz ham masshtab bilinsin */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-green/15" />
        <span className="pointer-events-none absolute -top-2 right-0 bg-white px-1 text-[10px] text-muted">
          {qisqaSon(max)}
        </span>

        <div className="flex h-44 items-end gap-[2px]">
          {data.map((d, i) => {
            const bal = Math.round((d.views / max) * 100)
            const faol = ustida === i
            const tanlandi = tanlangan === d.oy
            /**
             * Videosi yo'q oy tanlanmaydi: bosilsa ekrandagi hamma
             * raqam nolga aylanib, foydalanuvchi nima bo'lganini
             * tushunmasdi.
             */
            const bosiladi = d.videos > 0
            return (
              <div
                key={d.oy}
                role={bosiladi ? "button" : undefined}
                tabIndex={bosiladi ? 0 : undefined}
                title={bosiladi ? (tanlandi ? tr("Jamiga qaytish") : tr("Shu oyni ko'rish")) : undefined}
                onClick={() => bosiladi && onTanla(tanlandi ? null : d.oy)}
                onKeyDown={(e) => {
                  if (!bosiladi || (e.key !== "Enter" && e.key !== " ")) return
                  e.preventDefault()
                  onTanla(tanlandi ? null : d.oy)
                }}
                className={`group relative flex h-full flex-1 items-end justify-center rounded-t ${bosiladi ? "cursor-pointer" : "cursor-default"} ${tanlandi ? "bg-green/8" : ""}`}
                onMouseEnter={() => setUstida(i)}
                onMouseLeave={() => setUstida(null)}
              >
                {/* Eng katta oy doim belgilangan — hikoya shunda */}
                {(i === engKattaIdx || faol) && d.views > 0 && (
                  <span
                    className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white"
                    /**
                     * Baland ustunda yorliq USTUNNING ICHIGA tushadi.
                     * Ustidan qo'yilsa u grafik chegarasidan chiqib
                     * ketardi — eng katta oy, ya'ni aynan ko'rsatilishi
                     * kerak bo'lgan raqam kesilib qolardi.
                     */
                    style={bal > 80 ? { bottom: `calc(${bal}% - 22px)` } : { bottom: `calc(${bal}% + 6px)` }}
                  >
                    {qisqaSon(d.views)}
                    {faol && <span className="font-normal"> · {d.videos} {tr("video")}</span>}
                  </span>
                )}
                <div
                  className="w-full max-w-[26px] rounded-t-lg transition-[height,opacity]"
                  style={{
                    height: d.views > 0 ? `max(${bal}%, 3px)` : "2px",
                    // Gradient: ustun tagi to'q, uchi ochroq — tekis
                    // rangga qaraganda balandlik yaxshiroq o'qiladi
                    background: d.views > 0 ? `linear-gradient(180deg, #6cc02c 0%, ${USTUN_RANG} 100%)` : "#e5e7eb",
                    // Oy tanlanganda faqat o'sha ustun to'liq rangda —
                    // qaysi oy ko'rilayotgani bir qarashda bilinsin
                    opacity: tanlangan ? (tanlandi ? 1 : 0.3) : (ustida === null || faol ? 1 : 0.55),
                  }}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex gap-[2px]">
          {data.map((d) => {
            const { nom, yil } = oyYorlig(d.oy)
            return (
              <div key={d.oy} className="min-w-0 flex-1 text-center">
                <div className="truncate text-[10px] text-muted">{nom}</div>
                {/* Yil faqat yanvarda — takrorlanish shovqin qiladi */}
                {d.oy.endsWith("-01") && <div className="text-[9px] text-muted/70">{yil}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * PLATFORMA ULUSHI — donut.
 *
 * Ko'rishlar bo'yicha, video soni bo'yicha emas: kompaniya uchun 2 ta
 * video 100 000 ko'rish bergan tarmoq 10 ta video 500 ko'rish
 * bergandan qimmatliroq.
 *
 * Rang yagona belgi EMAS — har bo'lak afsonada nomi, foizi va aniq
 * raqami bilan turadi. Bo'laklar orasida 2px oq tirqish: qo'shni
 * ranglar bir-biriga qo'shilib ketmasin.
 */
function PlatformaDonut({ stats }: { stats: Korsatkich }) {
  const [ustida, setUstida] = useState<string | null>(null)

  const qatorlar = Object.entries(stats.platformViews || {})
    .map(([nom, views]) => ({ nom, views, videos: stats.platforms[nom] || 0 }))
    .sort((a, b) => b.views - a.views)
  const jami = qatorlar.reduce((s, r) => s + r.views, 0)

  // Ko'rish raqami umuman yo'q bo'lsa donut ma'nosiz — video soniga o'tamiz
  const korishBor = jami > 0
  const asos = korishBor
    ? qatorlar
    : qatorlar.map((r) => ({ ...r, views: r.videos })).sort((a, b) => b.views - a.views)
  const asosJami = asos.reduce((s, r) => s + r.views, 0)
  if (asosJami === 0) return null

  const R = 56
  const QALINLIK = 18
  const C = 2 * Math.PI * R
  const TIRQISH = 2

  /**
   * Har bo'lakning aylanadagi boshlanish nuqtasi — undan oldingi
   * bo'laklar uzunligining yig'indisi. `reduce` ichida to'plangani
   * uchun render paytida o'zgaruvchi qayta yozilmaydi.
   */
  const foiz = foizlar(asos.map((r) => r.views))
  const boklaklar = asos.reduce<Array<typeof asos[number] & { ulush: number; foiz: number; uzunlik: number; siljish: number }>>(
    (acc, r, i) => {
      const oldingi = acc.length ? acc[acc.length - 1] : null
      const siljish = oldingi ? oldingi.siljish + oldingi.ulush * C : 0
      const ulush = r.views / asosJami
      /**
       * Uzunlik BO'LAK ULUSHIDAN OSHMASLIGI kerak.
       *
       * Ilgari faqat pastki chegara (0.5px) bor edi. Ulushi nolga
       * teng bo'lak — masalan ko'rishlari o'qilmagan tarmoq —
       * o'sha 0.5px ni olib, aylanadan chiqib ketardi va
       * dashoffset davri bo'yicha aylanib, BIRINCHI bo'lakning
       * ustiga, boshqa rangdagi chiziqcha bo'lib tushardi.
       */
      const uzunlik = Math.min(Math.max(ulush * C - TIRQISH, 0.5), ulush * C)
      acc.push({ ...r, ulush, foiz: foiz[i], uzunlik, siljish })
      return acc
    },
    [],
  )

  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{tr("Platformalar ulushi")}</h3>
        <span className="text-xs text-muted">{korishBor ? tr("ko'rishlar bo'yicha") : tr("videolar soni bo'yicha")}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="relative shrink-0">
          <svg width={2 * (R + QALINLIK / 2)} height={2 * (R + QALINLIK / 2)} role="img"
            aria-label={tr("Platformalar ulushi diagrammasi")}>
            <g transform={`translate(${R + QALINLIK / 2} ${R + QALINLIK / 2}) rotate(-90)`}>
              {boklaklar.map((b) => (
                <circle
                  key={b.nom}
                  r={R} fill="none"
                  stroke={rangOl(b.nom)}
                  strokeWidth={QALINLIK}
                  strokeDasharray={`${b.uzunlik} ${C - b.uzunlik}`}
                  strokeDashoffset={-b.siljish}
                  opacity={ustida === null || ustida === b.nom ? 1 : 0.4}
                  onMouseEnter={() => setUstida(b.nom)}
                  onMouseLeave={() => setUstida(null)}
                  style={{ transition: "opacity .15s" }}
                />
              ))}
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            {ustida ? (
              <div>
                <div className="font-display text-lg font-extrabold">
                  {boklaklar.find((b) => b.nom === ustida)!.foiz}%
                </div>
                <div className="max-w-[80px] truncate text-[10px] text-muted">{ustida}</div>
              </div>
            ) : (
              <div>
                <div className="font-display text-lg font-extrabold">{qisqaSon(asosJami)}</div>
                <div className="text-[10px] text-muted">{korishBor ? tr("ko'rish") : tr("video")}</div>
              </div>
            )}
          </div>
        </div>

        {/* Afsona — RANG YOLG'IZ BELGI EMAS: nom, foiz va raqam */}
        <ul className="min-w-[180px] flex-1 space-y-2">
          {boklaklar.map((b) => (
            <li key={b.nom}
              className="flex items-center gap-2"
              onMouseEnter={() => setUstida(b.nom)}
              onMouseLeave={() => setUstida(null)}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: rangOl(b.nom) }} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{b.nom}</span>
              <span className="shrink-0 text-sm font-bold">{b.foiz}%</span>
              <span className="w-14 shrink-0 text-right text-xs text-muted">{qisqaSon(b.views)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * ENG SAMARALI BLOGERLAR.
 *
 * Nomlar tabiiy tartibga ega emas, shuning uchun har blogerga
 * alohida rang berilmaydi — hammasi bitta rangda. Uzunlik allaqachon
 * kattalikni ko'rsatib turibdi, rangga ikkinchi marta yuklash
 * ma'lumot qo'shmaydi.
 */

/* ---------- Taqqoslash ---------- */

/**
 * O'zgarish belgisi: +38% yoki -12%.
 *
 * Oldingi davr NOL bo'lsa foiz chiqarilmaydi — nolga bo'linish
 * cheksizlik beradi va "+∞%" foydalanuvchiga hech narsa aytmaydi.
 * O'sha holatda "yangi" deb yoziladi.
 */
function Ozgarish({ hozir, oldin }: { hozir: number; oldin: number }) {
  if (oldin === 0) {
    if (hozir === 0) return null
    return <span className="text-[11px] font-semibold text-green">{tr("yangi")}</span>
  }
  const foiz = Math.round(((hozir - oldin) / oldin) * 100)
  if (foiz === 0) return <span className="text-[11px] font-semibold text-muted">{tr("o'zgarmadi")}</span>
  const osdi = foiz > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${osdi ? "text-green" : "text-red-500"}`}>
      {/* Strelka — rang yolg'iz belgi bo'lib qolmasin */}
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {osdi ? <path d="M12 19V5 M5 12l7-7 7 7" /> : <path d="M12 5v14 M5 12l7 7 7-7" />}
      </svg>
      {Math.abs(foiz)}%
    </span>
  )
}

/* ---------- Izohlar tahlili ---------- */

type IzohTahlil = {
  ijobiy: number; salbiy: number; savol: number; neytral: number
  savollar: { matn: string; soni: number }[]
  shikoyatlar: { matn: string; soni: number }[]
  brend: string[]
  xulosa: string
}
type TahlilJavob = { tahlil: IzohTahlil | null; izohlar?: number; videolar?: number; sabab?: string }

/**
 * Ohang ranglari — HOLAT palitrasi, kategoriya emas.
 *
 * Yashil/qizil bu yerda "yaxshi/yomon" ma'nosini bildiradi, shuning
 * uchun ular diagrammalardagi qator ranglaridan alohida turadi. Rang
 * yolg'iz belgi emas: har bo'lak nomi va soni bilan ko'rsatiladi.
 */
const OHANG: { kalit: keyof Pick<IzohTahlil, "ijobiy" | "savol" | "neytral" | "salbiy">; nom: string; rang: string }[] = [
  { kalit: "ijobiy", nom: tr("Ijobiy"), rang: "#1e7a4d" },
  { kalit: "savol", nom: tr("Savol"), rang: "#2a78d6" },
  { kalit: "neytral", nom: tr("Neytral"), rang: "#9ca3af" },
  { kalit: "salbiy", nom: tr("Salbiy"), rang: "#c23b3b" },
]

const TAHLIL_KESH = "aa_izoh_tahlil_"

function IzohlarTahlili({ partnerId }: { partnerId: string }) {
  /**
   * Natija BRAUZERDA saqlanadi. AI chaqiruvi sekin va kvota talab
   * qiladi — sahifa har ochilganda qayta yugurtirish bekorga sarf
   * bo'lardi. Yangilash kerak bo'lsa tugma bor.
   *
   * Kesh effektda emas, boshlang'ich qiymatda o'qiladi: effekt
   * ortiqcha render keltirib, natija bir zumga yo'q bo'lib turardi.
   */
  const [kesh] = useState(() => {
    try {
      const xom = localStorage.getItem(TAHLIL_KESH + partnerId)
      if (xom) return JSON.parse(xom) as { javob: TahlilJavob; vaqt: string }
    } catch { /* buzuq kesh — e'tiborsiz qoldiramiz */ }
    return null
  })
  const [javob, setJavob] = useState<TahlilJavob | null>(kesh?.javob ?? null)
  const [vaqt, setVaqt] = useState<string>(kesh?.vaqt ?? "")
  const [band, setBand] = useState(false)
  const [xato, setXato] = useState("")

  const yugurt = async () => {
    setBand(true); setXato("")
    try {
      const d = await api<TahlilJavob>("/me/partner?action=comment-analysis")
      const v = new Date().toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      setJavob(d); setVaqt(v)
      try { localStorage.setItem(TAHLIL_KESH + partnerId, JSON.stringify({ javob: d, vaqt: v })) } catch { /* joy yo'q */ }
    } catch (e) {
      setXato(e instanceof Error ? e.message : tr("Tahlil qilib bo'lmadi"))
    } finally {
      setBand(false)
    }
  }

  const t = javob?.tahlil
  const jami = t ? t.ijobiy + t.salbiy + t.savol + t.neytral : 0

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold">{tr("Izohlar tahlili")}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {vaqt ? `${tr("oxirgi tahlil")}: ${vaqt}` : tr("Odamlar videolar ostida nima yozayotganini AI ko'rib chiqadi")}
          </p>
        </div>
        <button onClick={yugurt} disabled={band}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green px-4 py-2 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100">
          {band
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : <Icon d={I.brain} className="h-4 w-4" />}
          {band ? tr("Tahlil qilinmoqda…") : javob ? tr("Yangilash") : tr("Tahlil qilish")}
        </button>
      </div>

      {xato && <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{xato}</div>}
      {javob && !t && javob.sabab && (
        <div className="mt-3 rounded-xl bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700">{javob.sabab}</div>
      )}

      {t && jami > 0 && (
        <>
          <p className="mt-4 text-sm">
            <b>{javob?.izohlar}</b> {tr("ta izoh")} · <b>{javob?.videolar}</b> {tr("ta video")}
          </p>

          {/* Ohang nisbati — 2px oq tirqish bilan ajratilgan bo'laklar */}
          <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-full">
            {OHANG.map((o) => {
              const n = t[o.kalit]
              if (n <= 0) return null
              return <div key={o.kalit} style={{ width: `${(n / jami) * 100}%`, background: o.rang }} title={`${tr(o.nom)}: ${n}`} />
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {OHANG.map((o) => (
              <span key={o.kalit} className="inline-flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: o.rang }} />
                <span className="font-semibold">{tr(o.nom)}</span>
                <span className="text-muted">{t[o.kalit]} ({Math.round((t[o.kalit] / jami) * 100)}%)</span>
              </span>
            ))}
          </div>

          {t.xulosa && (
            <p className="mt-4 rounded-xl bg-[#fafdf7] p-3 text-sm leading-relaxed">{t.xulosa}</p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TahlilRoyxat
              sarlavha="Eng ko'p so'ralgan savollar"
              bosh="Savol berilmagan"
              rang="text-blue-600"
              elementlar={t.savollar}
            />
            <TahlilRoyxat
              sarlavha="Eng ko'p uchragan shikoyatlar"
              bosh="Shikoyat yo'q"
              rang="text-red-500"
              elementlar={t.shikoyatlar}
            />
          </div>

          {t.brend.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold text-muted">{tr("Kompaniyangiz tilga olingan izohlar")}</h4>
              <div className="mt-2 space-y-1.5">
                {t.brend.map((b, i) => (
                  <p key={i} className="rounded-lg border-l-2 border-green bg-[#fafdf7] px-3 py-2 text-xs leading-relaxed">{b}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TahlilRoyxat({ sarlavha, bosh, rang, elementlar }: {
  sarlavha: string; bosh: string; rang: string
  elementlar: { matn: string; soni: number }[]
}) {
  return (
    <div>
      <h4 className="text-xs font-bold text-muted">{tr(sarlavha)}</h4>
      {elementlar.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{tr(bosh)}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {elementlar.map((e, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg bg-[#fafdf7] px-3 py-2">
              <span className={`shrink-0 font-display text-xs font-extrabold ${rang}`}>{e.soni}×</span>
              <span className="min-w-0 flex-1 text-xs leading-relaxed">{e.matn}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


/* ---------- Viloyatlar kesimi ---------- */
/**
 * Reklama qaysi hududlarga tushdi.
 *
 * Viloyat VIDEONING o'zida yo'q — u blogerdan olinadi (`blogger_regions`
 * dagi asosiy hudud). Bloger bir nechta viloyatda ishlasa ham video
 * BITTA viloyatga yoziladi: aks holda bitta ko'rish bir necha marta
 * sanalib, yig'indi haqiqiy raqamdan oshib ketardi.
 */
function Viloyatlar({ list }: { list: { viloyat: string; videos: number; views: number; likes: number }[] }) {
  const son = (n: number) => n.toLocaleString("ru-RU")
  const eng = Math.max(1, ...list.map((r) => r.views))
  const jamiKorish = list.reduce((a, r) => a + r.views, 0)
  return (
    <div className={card}>
      <h3 className="font-display text-lg font-extrabold">{tr("Viloyatlar bo'yicha")}</h3>
      <p className="mt-1 text-xs text-muted">
        {tr("Har bir video bitta viloyatga yoziladi.")}
      </p>
      <ul className="mt-5 space-y-4">
        {list.map((r, i) => (
          <li key={r.viloyat} className="flex items-start gap-3">
            {/* Tartib raqami — reyting bir qarashda o'qilsin */}
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-green/10 text-[11px] font-extrabold text-green">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-bold">{r.viloyat}</span>
                <span className="shrink-0 font-display text-base font-extrabold text-green">{son(r.views)}</span>
              </div>
              {/* Ustun uzunligi eng katta viloyatga nisbatan — mutlaq
                  songa emas, aks holda kichik viloyatlar ko'rinmasdi */}
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-soft">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(3, (r.views / eng) * 100)}%`,
                    background: "linear-gradient(90deg, #6cc02c 0%, #2f7d1f 100%)",
                  }}
                />
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted">
                <span>{r.videos} {tr("video")}</span>
                <span>{son(r.likes)} {tr("layk")}</span>
                <span>{jamiKorish > 0 ? Math.round((r.views / jamiKorish) * 100) : 0}%</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- Kunlik grafik ---------- */
/**
 * Oxirgi 30 kun.
 *
 * ⚠️ BU "BUGUN QANCHA KO'RISH QO'SHILDI" EMAS. Ko'rishlarning kunlik
 * tarixi bazada saqlanmaydi — ijtimoiy tarmoq faqat JORIY jami
 * raqamni beradi. Ya'ni ustun "o'sha kuni CHIQARILGAN videolar
 * bugungacha qancha ko'rish yig'gan" degani.
 *
 * Sarlavha ostida shu ochiq yozilgan: aks holda kompaniya raqamni
 * "kunlik o'sish" deb o'qib, noto'g'ri xulosa chiqarardi.
 */
function KunlikGrafik({ data }: { data: { kun: string; views: number; likes: number; videos: number }[] }) {
  const son = (n: number) => n.toLocaleString("ru-RU")
  const eng = Math.max(1, ...data.map((d) => d.views))
  const jami = data.reduce((s, d) => s + d.views, 0)
  const videoKunlari = data.filter((d) => d.videos > 0).length
  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-extrabold">{tr("Oxirgi 30 kun")}</h3>
        <span className="text-sm font-bold text-green">{son(jami)} {tr("ko'rish")}</span>
      </div>
      <p className="mt-1 text-xs text-muted">
        {tr("Ustun — o'sha kuni chiqarilgan videolar bugungacha yig'gan ko'rish. Bu kunlik o'sish emas.")}
      </p>
      {videoKunlari === 0 ? (
        <p className="mt-6 text-sm text-muted">{tr("Oxirgi 30 kunda video chiqarilmagan.")}</p>
      ) : (
        <div className="mt-4 flex h-32 items-end gap-[3px]">
          {data.map((d) => (
            <div key={d.kun} className="group relative flex-1" title={`${d.kun}: ${son(d.views)} ko'rish, ${d.videos} video`}>
              <div
                className="w-full rounded-t transition-opacity hover:opacity-80"
                /* Gradient — oylik grafikdagi bilan bir xil til */
                /* Video yo'q kunlar ham ko'rinib tursin — vaqt o'qi
                   uzilib qolmasligi kerak */
                style={{
                  height: `${Math.max(d.views > 0 ? 6 : 2, (d.views / eng) * 100)}%`,
                  background: d.videos > 0 ? "linear-gradient(180deg, #6cc02c 0%, #2f7d1f 100%)" : "#eef2ec",
                }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{data[0]?.kun.slice(5)}</span>
        <span>{data[data.length - 1]?.kun.slice(5)}</span>
      </div>
    </div>
  )
}

/* ---------- Videolar ---------- */
/**
 * BLOGERLAR SHU KOMPANIYA UCHUN BELGILAGAN VIDEOLAR.
 *
 * Bloger video qo'shayotganda qaysi hamkor kompaniya uchun ekanini
 * belgilaydi. Shu yerda o'sha videolar to'liq statistikasi bilan
 * ko'rinadi: umumiy ko'rishlar, platformalar bo'yicha taqsimot va
 * qaysi bloger tayyorlagani.
 */
function PartnerVideos({ partnerId }: { partnerId: string }) {
  const [videos, setVideos] = useState<PartnerVideo[]>([])
  const [stats, setStats] = useState<VideoStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  /** Grafikda tanlangan oy ("YYYY-MM") yoki null — jami */
  const [oy, setOy] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setFailed(false)
    api<{ videos: PartnerVideo[]; stats: VideoStats }>("/me/partner?action=videos")
      .then((d) => { setVideos(d.videos || []); setStats(d.stats) })
      // Xato "video yo'q" degani emas — ikkalasi bir xil ko'rinmasin
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  /**
   * OY FILTRI butun bo'limga qo'llanadi: ko'rsatkichlar va
   * platformalar taqsimoti shu oyga tegishli bo'ladi. Faqat oylik
   * grafikning O'ZI to'liq yil bo'lib qoladi, chunki u filtrning
   * boshqaruvchisi.
   */
  const oyVideolari = useMemo(
    () => (oy ? videos.filter((v) => String(v.date || "").startsWith(oy)) : videos),
    [videos, oy],
  )
  // Serverdan kelgan `stats` butun davr uchun — oy tanlansa
  // ko'rsatkichlar shu yerda qaytadan hisoblanadi
  const korsatkich = useMemo(() => hisobla(oyVideolari), [oyVideolari])

  const oyNomi = oy ? `${oyYorlig(oy).nom} ${oyYorlig(oy).yil}` : ""

  /**
   * TAQQOSLASH — "12K ko'rish" o'zi hech narsa anglatmaydi, "o'tgan
   * oyga nisbatan +38%" esa anglatadi.
   *
   * Oy tanlanganda oldingi oy bilan solishtiriladi. "Jami" holatida
   * solishtiradigan oldingi davr yo'q, shuning uchun kartochkalarda
   * o'zgarish ko'rsatilmaydi — uning o'rniga oxirgi TO'LIQ oy
   * alohida qatorda beriladi (joriy oy hali tugamagan, uni oldingisi
   * bilan solishtirish adolatsiz).
   */
  const oldingiOy = useMemo(() => {
    if (!oy) return null
    const [y, m] = oy.split("-").map(Number)
    const d = new Date(Date.UTC(y, m - 2, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  }, [oy])

  const oldingiKorsatkich = useMemo(
    () => (oldingiOy ? hisobla(videos.filter((v) => String(v.date || "").startsWith(oldingiOy))) : null),
    [videos, oldingiOy],
  )

  /** "Jami" holatidagi qator uchun: oxirgi tugagan oy va undan oldingisi */
  const oxirgiToliq = useMemo(() => {
    const m = stats?.monthly
    if (!m || m.length < 3) return null
    // Oxirgi element — JORIY oy, u hali tugamagan
    return { oy: m[m.length - 2], oldin: m[m.length - 3] }
  }, [stats])

  const son = (n: number) => n.toLocaleString("ru-RU")

  if (loading) {
    return (
      <div className="mt-6 space-y-6">
        <SkeletonStatGrid />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }
  if (failed) {
    return <div className={`mt-6 ${card}`}><ErrorState onRetry={load} message="Videolarni yuklab bo'lmadi." /></div>
  }

  return (
    <div className="mt-6 space-y-6">
      {/*
        FILTR HOLATI — qaysi davr ko'rilayotgani va "Jami" ga
        qaytish tugmasi. Usiz foydalanuvchi raqamlar nega
        o'zgarganini tushunmasdi: ko'rsatkichlar jimgina kichrayardi.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOy(null)}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${oy ? "border border-green/25 text-green hover:bg-green/5" : "bg-green text-white"}`}
        >
          {tr("Jami")}
        </button>
        {oy && (
          <span className="inline-flex items-center gap-2 rounded-xl bg-green/10 px-3 py-2 text-sm font-bold text-green">
            {oyNomi}
            <span role="button" tabIndex={0} title={tr("Filtrni olib tashlash")}
              onClick={() => setOy(null)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOy(null) } }}
              className="cursor-pointer opacity-70 hover:opacity-100">
              <Icon d="M18 6L6 18 M6 6l12 12" className="h-3.5 w-3.5" />
            </span>
          </span>
        )}
        <span className="text-xs text-muted">
          {oy ? tr("faqat shu oy ko'rsatkichlari") : tr("butun davr bo'yicha")}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: I.media, t: tr("Videolar"), v: son(korsatkich.total), sub: tr("shu kompaniya uchun"), n: korsatkich.total, oldin: oldingiKorsatkich?.total ?? 0, rang: "#2f7d1f" },
          { icon: I.eye, t: "Ko'rishlar", v: son(korsatkich.views), sub: tr("barcha platformalar"), n: korsatkich.views, oldin: oldingiKorsatkich?.views ?? 0, rang: "#5bb420" },
          { icon: I.star, t: tr("Yoqtirishlar"), v: son(korsatkich.likes), sub: tr("like"), n: korsatkich.likes, oldin: oldingiKorsatkich?.likes ?? 0, rang: "#e8a33d" },
          { icon: I.message, t: "Izohlar", v: son(korsatkich.comments), sub: tr("komment"), n: korsatkich.comments, oldin: oldingiKorsatkich?.comments ?? 0, rang: "#3b82c4" },
        ].map((s) => (
          /* Har ko'rsatkichga o'z rangi — to'rtta bir xil yashil karta
             bir-biriga qo'shilib ketardi va ko'z qaysi raqamni
             qidirayotganini topolmasdi */
          <div key={s.t} className="relative min-w-0 overflow-hidden rounded-3xl border border-green/10 bg-white p-5 shadow-[0_8px_30px_rgba(91,180,32,0.07)]">
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: s.rang }} />
            <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: `${s.rang}1a`, color: s.rang }}>
              <Icon d={s.icon} className="h-5 w-5" />
            </span>
            <div className="mt-3 text-xs text-muted">{tr(s.t)}</div>
            <div className="mt-1 truncate font-display text-3xl font-extrabold leading-tight">{s.v}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-green">{tr(s.sub)}</span>
              {/* O'zgarish faqat oy tanlanganda — solishtiradigan davr o'shanda bor */}
              {oldingiKorsatkich && <Ozgarish hozir={s.n} oldin={s.oldin} />}
            </div>
          </div>
        ))}
      </div>

      {/*
        "Jami" holatida kartochkalarda o'zgarish yo'q — butun davrni
        solishtiradigan oldingi davr yo'q. O'rniga oxirgi TUGAGAN oy
        beriladi: joriy oy hali tugamagan va uni to'liq oy bilan
        solishtirish har doim "tushib ketdi" degan yolg'on chiqarardi.
      */}
      {!oy && oxirgiToliq && oxirgiToliq.oy.videos > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-green/10 bg-white px-5 py-3 text-sm shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
          <span className="text-muted">{tr("Oxirgi tugagan oy")}</span>
          <b>{oyYorlig(oxirgiToliq.oy.oy).nom} {oyYorlig(oxirgiToliq.oy.oy).yil}</b>
          <span className="font-display font-extrabold">{son(oxirgiToliq.oy.views)}</span>
          <span className="text-muted">{tr("ko'rish")}</span>
          <Ozgarish hozir={oxirgiToliq.oy.views} oldin={oxirgiToliq.oldin.views} />
          <span className="text-xs text-muted">{tr("o'tgan oyga nisbatan")}</span>
        </div>
      )}

      {/*
        Shart massiv uzunligiga EMAS, ma'lumot borligiga qaraydi:
        backend har doim 12 oy qaytaradi (bo'shlari ham), shuning
        uchun `length > 0` hech qachon false bo'lmasdi va videosi
        yo'q hamkorga "Video topilmadi" yozuvi ustida bo'm-bo'sh
        grafik chizilardi.
      */}
      {stats?.monthly?.some((m) => m.videos > 0) && (
        <OylikGrafik data={stats.monthly} tanlangan={oy} onTanla={setOy} />
      )}

      {/* Kunlik va viloyat yonma-yon — keng ekranda bo'sh joy
          qolmasin, torda esa ustma-ust tushadi */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {stats?.daily && <KunlikGrafik data={stats.daily} />}
        {stats?.regions && stats.regions.length > 0 && <Viloyatlar list={stats.regions} />}
      </div>

      <IzohlarTahlili partnerId={partnerId} />

      {Object.keys(korsatkich.platforms).length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <PlatformaDonut stats={korsatkich} />
        </div>
      )}

      {/* VIDEOLAR RO'YXATI OLIB TASHLANDI — kompaniyaga umumiy
          ko'rsatkichlar kerak, har bir videoning kartochkasi emas.
          Kartochka bilan birga to'liq ma'lumot oynasi va platforma
          filtri ham ketdi (ular faqat ro'yxat uchun edi).

          Video UMUMAN bo'lmaganda tushuntirish QOLADI: aks holda
          hamkor bo'sh panel va nollarni ko'rib, sababini bilmasdi. */}
      {videos.length === 0 && (
        <div className={`${card} py-10 text-center`}>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-green"><Icon d={I.media} className="h-7 w-7" /></span>
          <p className="mt-3 text-sm font-semibold">{tr("Video topilmadi")}</p>
          <p className="mt-1 text-xs text-muted">{tr("Bloger video qo'shayotganda kompaniyangizni belgilasa, u shu yerda paydo bo'ladi.")}</p>
        </div>
      )}
    </div>
  )
}


/* ---------- Topshiriqlar (TZ) ---------- */





/**
 * TANLANGAN JADVALNI ODDIY SO'Z BILAN AYTADI.
 *
 * "kunlik + 2soat" degan sozlama o'zi hech narsa anglatmaydi.
 * Foydalanuvchi yuborishdan OLDIN aynan nima bo'lishini ko'rishi
 * kerak — aks holda noto'g'ri jadval bilan yuborilgan TZ ni keyin
 * tuzatib bo'lmaydi.
 */


/* ---------- E'tirozlar (shikoyatlar) ---------- */




/**
 * E'TIROZLAR BO'LIMI.
 *
 * Bloger TZ ni noto'g'ri bajarsa yoki video yoqmasa, hamkorning
 * ayta oladigan joyi yo'q edi: telefon qilardi, admin og'zaki
 * yetkazardi va bu hech qayerda qolmasdi — bloger aynan NIMA
 * noto'g'ri ekanini bilmasdi va xato takrorlanaverardi.
 */

/* ---------- Hisobot ---------- */


/**
 * Tayyor davrlar.
 *
 * NEGA KERAK: hisobot doim BIR DAVR uchun tuziladi — chorak, oy, yil.
 * Ilgari hisobot faqat "boshidan beri" edi va rahbariyatga "avgust
 * oyida nima qildik?" degan savolga javob bera olmasdi.
 */



/* ==========================================================================
   HUJJAT — A4 formatidagi rasmiy hisobot
   ==========================================================================
   NEGA ALOHIDA: paneldagi hisobot EKRAN uchun — kartochkalar, ranglar,
   bosiladigan diagrammalar. Qog'ozda bularning hech biri kerak emas va
   ular hujjatni chalkashtiradi.

   Hujjat esa RASMIY: sarlavha, raqamlangan bo'limlar, jadvallar va
   imzo joyi. Uni rahbariyatga yoki buxgalteriyaga berish mumkin.

   PDF: brauzerning O'Z "PDF sifatida saqlash" imkoniyati ishlatiladi.
   Tashqi kutubxona qo'shilmadi va buning sababi bor — jsPDF kabi
   kutubxonalar kirill va xitoy shriftlarini o'zi bilan olib yurishi
   kerak (megabaytlar), matn esa rasmga aylanib, nusxa olib bo'lmaydigan
   va qidirib bo'lmaydigan bo'lib qolardi. Brauzer eksporti esa haqiqiy
   matn beradi.
   ========================================================================== */



