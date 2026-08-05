import { useCallback, useEffect, useRef, useState } from "react"
import { Icon, I, useBusy, SkeletonCard, useBodyScrollLock } from "../../lib/ui"
import { api } from "../../lib/api"
import { tr } from "../../lib/i18n"

/**
 * Marketing tahlili.
 *
 * BITTA TUGMA. Foydalanuvchi hech narsa kiritmaydi va sozlamaydi:
 * Google News uch tilda so'nggi yangiliklarni beradi, o'z hisoblarimiz
 * ko'rsatkichlari Graph API dan olinadi — natijada kontent reja.
 *
 * Raqobatchilarni qidirish OLIB TASHLANDI: u sekin edi va Instagram
 * business_discovery ko'p hisoblarni ko'ra olmagani uchun natija
 * to'liq bo'lmasdi.
 */

const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"

/* Maydonlar unknown: AI shakli kafolatlanmaydi, chizishdan oldin
   txt() orqali matnga aylantiriladi. */
type PlanItem = {
  kun: number; mavzu: unknown; format: unknown; platforma: unknown
  vaqt?: unknown; maqsad?: unknown
}
type Plan = {
  sotuv: unknown
  /** Tarmoqni o'stirish yo'llari */
  osish?: unknown
  /** Qanday kontent turlari ishlaydi va nega */
  kontent_turlari?: unknown
  /** Bajarilgan kunlar */
  done?: unknown
  /** Yozilgan to'liq rejalar: kun -> tafsilot */
  details?: unknown
  reja: PlanItem[]
}
type NetStat = { platform: string; name: string; followers: number | null; avgLikes: number | null; error?: string }
/** Reja bandining TO'LIQ ijro rejasi — modalda ko'rsatiladi */
type PlanDetail = {
  nega?: unknown; auditoriya?: unknown; hook?: unknown; tezislar?: unknown
  matn_namuna?: unknown; muqova?: unknown; joylash?: unknown
  hashtaglar?: unknown; kutilgan_natija?: unknown; keyingi_qadam?: unknown
  // video uchun
  ssenariy?: unknown; video_mazmuni?: unknown; suratga_olish?: unknown
  // rasm uchun
  tasvir_mazmuni?: unknown; kompozitsiya?: unknown
}
type WebHit = { title: string; snippet: string; url: string; source?: string; date?: string }
/** Foydalanuvchi kiritgan marketing manbasi */
type Source = {
  id: string; name: string; url: string; is_active: boolean
  last_error?: string | null; last_read_at?: string | null
}

/**
 * AI ba'zan matn o'rniga obyekt qaytaradi. React obyektni chiza
 * olmaydi va BUTUN sahifa yiqiladi ("Objects are not valid as a React
 * child"). Server buni endi to'g'rilaydi, lekin bazada eski buzuq
 * rejalar qolgan bo'lishi mumkin — shuning uchun bu yerda ham himoya.
 */
function txt(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(" ")
  if (typeof v === "object") {
    return Object.values(v as Record<string, unknown>).map(txt).filter(Boolean).join(". ")
  }
  return ""
}
function txtList(v: unknown): string[] {
  if (!v) return []
  return (Array.isArray(v) ? v : [v]).map(txt).filter(Boolean)
}

/**
 * Modaldagi bitta bo'lim. Matn bo'sh bo'lsa UMUMAN chizilmaydi —
 * video rejasida rasm maydonlari (va aksincha) bo'sh keladi, ular
 * sarlavhasi bilan osilib turmasin.
 */
function Block({ title, body }: { title: string; body: string }) {
  if (!body.trim()) return null
  return (
    <div>
      <p className="text-xs font-bold text-muted">{title}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-ink/85">{body}</p>
    </div>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-xs font-bold text-muted">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-ink/85">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Strategiya ro'yxati kartasi — "Sotuv", "O'sish", "Kontent turlari".
 *
 * Uchtasi bir xil ko'rinishda va BIR QATORDA turadi. Ilgari har biri
 * alohida, butun kenglikda va bir-birining ostida edi: sahifa uzun
 * bo'lib ketardi va uchtasini solishtirib bo'lmasdi.
 *
 * `max-h` + skroll shart: AI ba'zan 12 ta band yozadi, boshqasiga esa
 * 3 ta. Cheklovsiz bo'lsa uzuni butun qatorni cho'zib yuborardi.
 */
function StrategiyaKarta({ title, hint, items, belgi }: {
  title: string; hint: string; items: string[]; belgi?: "check"
}) {
  return (
    <div className={card}>
      <h3 className="font-display font-bold">{title}</h3>
      <p className="mt-0.5 text-sm text-muted">{hint}</p>
      {items.length > 0 ? (
        <ul className="mt-3 max-h-80 space-y-2.5 overflow-y-auto pr-1">
          {items.map((r, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-ink/80">
              {belgi === "check" ? (
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green text-white">
                  <Icon d={I.check} className="h-2.5 w-2.5" />
                </span>
              ) : (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
              )}
              <span>{r}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl bg-soft py-6 text-center text-sm text-muted">
          {tr("Tahlil qilinganda maslahatlar shu yerda chiqadi.")}
        </p>
      )}
    </div>
  )
}

/**
 * Havolalar ro'yxati kartasi — "Jahon bozori", "Sizning manbalaringiz",
 * "Yangiliklar". Uchtasi ham bir xil: sarlavha, izoh va havolalar.
 */
function ManbaKarta({ title, hint, items }: {
  title: string; hint: string; items: { title?: unknown; url?: unknown; source?: unknown; date?: unknown }[]
}) {
  if (!items.length) return null
  return (
    <div className={card}>
      <h3 className="font-display font-bold">{title}</h3>
      <p className="mt-0.5 text-sm text-muted">{hint}</p>
      <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
        {items.map((h, i) => (
          <li key={i} className="rounded-xl bg-soft px-3 py-2">
            <a href={txt(h.url)} target="_blank" rel="noreferrer"
              className="text-sm font-semibold text-green hover:underline">{txt(h.title)}</a>
            <span className="block text-xs text-muted">
              {[txt(h.source), txt(h.date)].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const PLATFORM_LABEL: Record<string, string> = {
  telegram: "Telegram", instagram: tr("Instagram"), facebook: tr("Facebook"),
  linkedin: tr("LinkedIn"), youtube: tr("YouTube"),
}

/** Kalendar ikonkasi — ui.tsx da yo'q, shuning uchun shu yerda */
const CALENDAR = "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 10h18 M8 2v4 M16 2v4"

/** Tarmoq ikonkasi — jadval va hisoblar kartasida ishlatiladi */
const PLATFORM_ICON: Record<string, string> = {
  telegram: I.telegram, instagram: I.instagram, facebook: I.facebook,
  youtube: I.youtube,
  // LinkedIn ui.tsx da yo'q
  linkedin: "M4 4h4v16H4z M10 9h4v11h-4z M14 9a4 4 0 0 1 6 3.5V20h-4v-6a2 2 0 0 0-4 0",
}

/**
 * Tayyor agro manbalar — bir bosishда qo'shiladi.
 *
 * FAQAT saytlarning O'Z RSS'lari. Google News qidiruvi ro'yxatdan
 * OLIB TASHLANDI: u server IP'laridan kelgan so'rovga tez-tez 503
 * qaytarardi va manba qo'shib bo'lmasdi.
 *
 * Har biri haqiqiy so'rov bilan tekshirilgan (yozuvlar soni):
 *   freshplaza 90, agfundernews 50, farmprogress 50,
 *   hortidaily 28, gazeta.uz 20, kun.uz 15, modernfarmer 10
 */
const SAMPLE_SOURCES: { name: string; url: string }[] = [
  { name: tr("Gazeta.uz"), url: "https://www.gazeta.uz/uz/rss/" },
  { name: tr("Kun.uz"), url: "https://kun.uz/uz/news/rss" },
  { name: tr("FreshPlaza (jahon savdosi)"), url: "https://www.freshplaza.com/rss.xml" },
  { name: tr("HortiDaily (issiqxona)"), url: "https://www.hortidaily.com/rss.xml" },
  { name: tr("AgFunder (agrotexnologiya)"), url: "https://agfundernews.com/feed" },
  { name: tr("Farm Progress"), url: "https://www.farmprogress.com/rss.xml" },
]

const MONTHS = [
  tr("Yanvar"), tr("Fevral"), tr("Mart"), tr("Aprel"), tr("May"), tr("Iyun"),
  tr("Iyul"), tr("Avgust"), tr("Sentabr"), tr("Oktabr"), tr("Noyabr"), tr("Dekabr"),
]

/** Yuqoridagi raqamli plitka (topilgan yangilik, rejalashtirilgan post…) */
function Stat({ icon, tone, value, label }: {
  icon: string; tone: string; value: number; label: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon d={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-extrabold leading-none">{value}</p>
        <p className="mt-1 truncate text-xs text-muted">{label}</p>
      </div>
    </div>
  )
}

export default function MarketPanel({ onCreatePost }: {
  /** Reja bandidan post yaratish — SMM/AI bo'limiga o'tkazadi */
  onCreatePost: (topic: string, platform: string, format: string) => void
}) {
  const [loading, setLoading] = useState(true)

  const [days, setDays] = useState(7)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [nets, setNets] = useState<NetStat[]>([])
  const [web, setWeb] = useState<WebHit[]>([])
  // "Manbalar" bo'limida kiritilgan saytlardan olingan yozuvlar
  const [sources, setSources] = useState<WebHit[]>([])
  // Jahon agro tendensiyalari — backendда doim yig'iladi
  const [world, setWorld] = useState<WebHit[]>([])
  const [planAt, setPlanAt] = useState("")
  // Bajarilgan kunlar — serverda saqlanadi, brauzerga bog'liq emas
  const [done, setDone] = useState<number[]>([])
  // Qaysi kun tahrirlanmoqda (kun raqami) va tahrir qiymatlari
  const [editKun, setEditKun] = useState<number | null>(null)
  const [editVal, setEditVal] = useState({ mavzu: "", format: "", platforma: "", vaqt: "" })

  const [analyzing, runAnalyze] = useBusy()
  const [err, setErr] = useState("")

  /* Marketing manbalari — foydalanuvchi shu yerda kiritadi va tahlil
     aynan shulardan o'rganadi. */
  const [srcList, setSrcList] = useState<Source[]>([])
  const [newSrc, setNewSrc] = useState({ name: "", url: "" })
  const [srcErr, setSrcErr] = useState("")
  const [srcMsg, setSrcMsg] = useState("")
  const [srcBusy, runSrc] = useBusy()

  /**
   * MUHIM: ilgari xato jimgina yutilardi va ekranda "Hali manba
   * qo'shilmagan" chiqardi. Bu YOLG'ON — manbalar bor bo'lishi mumkin,
   * shunchaki so'rov yiqilgan. Foydalanuvchi ularni qayta kiritishga
   * urinishi mumkin edi.
   */
  const [srcFailed, setSrcFailed] = useState(false)
  const loadSources = useCallback(() => {
    setSrcFailed(false)
    api<{ sources: Source[] }>("/smm/ai?action=sources", { method: "POST", body: "{}" })
      .then((d) => setSrcList(d.sources || []))
      .catch(() => setSrcFailed(true))
  }, [])

  const addSource = () => runSrc(async () => {
    setSrcErr(""); setSrcMsg("")
    if (!newSrc.url.trim()) { setSrcErr(tr("Havolani kiriting")); return }
    try {
      const r = await api<{ found: number; warning?: string }>("/smm/ai?action=source_add", {
        method: "POST", body: JSON.stringify(newSrc),
      })
      setNewSrc({ name: "", url: "" })
      // Vaqtinchalik nosozlikda ham saqlanadi — buni ochiq aytamiz
      setSrcMsg(r.warning
        ? `✅ Qo'shildi, lekin hozir o'qib bo'lmadi (${r.warning}). Tahlil paytida qayta o'qiladi.`
        : `✅ Qo'shildi — ${r.found} ta yozuv topildi`)
      loadSources()
    } catch (e) {
      setSrcErr(e instanceof Error ? e.message : tr("Manba qo'shilmadi"))
    }
  })

  /**
   * Qolgan namuna manbalarni BIRDAN qo'shish.
   *
   * Har birini alohida qo'shish sekin edi — har so'rovda funksiya
   * qayta uyg'onadi. Bu yerda hammasi bitta so'rovda, serverда
   * parallel tekshiriladi.
   */
  const addAllSamples = () => runSrc(async () => {
    setSrcErr(""); setSrcMsg("")
    const items = SAMPLE_SOURCES.filter((s) => !srcList.some((x) => x.url === s.url))
    if (!items.length) return
    try {
      const r = await api<{ results: { name: string; ok: boolean; error?: string; found?: number }[] }>(
        "/smm/ai?action=sources_add_many", { method: "POST", body: JSON.stringify({ items }) })
      const ok = r.results.filter((x) => x.ok)
      const bad = r.results.filter((x) => !x.ok)
      if (ok.length) setSrcMsg(`✅ ${ok.length} ta manba qo'shildi`)
      if (bad.length) setSrcErr(bad.map((b) => `${b.name}: ${b.error}`).join(" · "))
      loadSources()
    } catch (e) {
      setSrcErr(e instanceof Error ? e.message : tr("Qo'shilmadi"))
    }
  })

  /** Tayyor namuna manbani bir bosishda qo'shish */
  const addSample = (s: { name: string; url: string }) => runSrc(async () => {
    setSrcErr(""); setSrcMsg("")
    try {
      const r = await api<{ found: number }>("/smm/ai?action=source_add", {
        method: "POST", body: JSON.stringify(s),
      })
      setSrcMsg(`✅ "${s.name}" qo'shildi — ${r.found} ta yozuv topildi`)
      loadSources()
    } catch (e) {
      setSrcErr(`${s.name}: ${e instanceof Error ? e.message : "qo'shilmadi"}`)
    }
  })

  const removeSource = (s: Source) => runSrc(async () => {
    if (!window.confirm(`"${s.name}" manbasi o'chirilsinmi?`)) return
    setSrcErr(""); setSrcMsg("")
    try {
      await api("/smm/ai?action=source_delete", { method: "POST", body: JSON.stringify({ id: s.id }) })
      loadSources()
    } catch (e) {
      setSrcErr(e instanceof Error ? e.message : tr("O'chirilmadi"))
    }
  })

  /* Reja bandining to'liq tafsiloti — modal.
     Tafsilot TALAB BO'YICHA yoziladi: hamma kunni birdan yozdirish
     juda uzoq va AI kvotasini yeb qo'yadi. */
  const [openItem, setOpenItem] = useState<PlanItem | null>(null)
  const [detail, setDetail] = useState<PlanDetail | null>(null)
  const [detailErr, setDetailErr] = useState("")
  const [loadingDetail, runDetail] = useBusy()
  // Yozilgan tafsilotlar keshlanadi — qayta ochilsa qayta yozilmasin
  const detailCache = useRef<Record<string, PlanDetail>>({})

  /**
   * Reja bandini ochish.
   *
   * @param force  true bo'lsa saqlangan tafsilot e'tiborga olinmaydi
   *   va AI qaytadan yozadi ("qaytadan yozdirish" tugmasi).
   */
  // Modal ochiq — sahifa orqada skroll bo'lmasin
  useBodyScrollLock(Boolean(openItem))

  const openPlanItem = (it: PlanItem, force = false) => {
    setOpenItem(it); setDetailErr("")
    const key = `${it.kun}|${txt(it.mavzu)}`
    const hit = detailCache.current[key]
    // Bir marta yozilgan reja SAQLANADI va qayta yozdirilmaydi —
    // har ochishда AI chaqirilsa token behuda ketardi.
    if (hit && !force) { setDetail(hit); return }
    setDetail(null)
    void runDetail(async () => {
      try {
        const d = await api<{ detail: PlanDetail }>("/smm/ai?action=plan_item", {
          method: "POST",
          body: JSON.stringify({
            kun: it.kun, mavzu: txt(it.mavzu), format: txt(it.format) || "post",
            platforma: txt(it.platforma) || "telegram", vaqt: txt(it.vaqt), maqsad: txt(it.maqsad),
          }),
        })
        detailCache.current[key] = d.detail
        setDetail(d.detail)
        // SERVERGA saqlaymiz — bir marta yozilgan reja qayta
        // yozdirilmasin (token behuda ketmasin). Xato bo'lsa jim
        // o'tamiz: tafsilot ekranda baribir turibdi.
        try {
          await api("/smm/ai?action=plan_update", {
            method: "POST",
            body: JSON.stringify({ details: { [key]: d.detail } }),
          })
        } catch { /* saqlanmasa keyingi safar qayta yoziladi */ }
      } catch (e) {
        setDetailErr(e instanceof Error ? e.message : tr("Reja yozilmadi"))
      }
    })
  }


  /* Oxirgi saqlangan reja — panel ochilganda darhol ko'rinsin,
     har safar qaytadan tahlil qilish shart bo'lmasin. */
  // Xato "reja yo'q" degani EMAS: ilgari tarmoq uzilsa ham "Hali tahlil
  // qilinmagan" chiqib, foydalanuvchi tayyor rejasi yo'qolgan deb o'ylardi
  // va tokenni bekorga sarflab qaytadan tahlil qildirardi.
  const [planFailed, setPlanFailed] = useState(false)
  const load = useCallback(() => {
    setLoading(true)
    setPlanFailed(false)
    api<{ last: { data: Plan & { networks?: NetStat[]; web?: WebHit[]; world?: WebHit[]; sources?: WebHit[] }; days: number; created_at: string } | null }>(
      "/smm/ai?action=last_plan", { method: "POST", body: "{}" })
      .then((d) => {
        if (!d.last) return
        setPlan(d.last.data)
        setNets(d.last.data.networks || [])
        setWeb(d.last.data.web || [])
        setSources(d.last.data.sources || [])
        setWorld(d.last.data.world || [])
        setDone(Array.isArray(d.last.data.done) ? (d.last.data.done as number[]) : [])
        // Ilgari yozilgan to'liq rejalar — qayta yozdirmaymiz
        const saved = d.last.data.details
        detailCache.current = (saved && typeof saved === "object" ? saved : {}) as Record<string, PlanDetail>
        setDays(d.last.days || 7)
        setPlanAt(d.last.created_at)
      })
      .catch(() => setPlanFailed(true))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load(); loadSources() }, [load, loadSources])

  const analyze = () => runAnalyze(async () => {
    setErr("")
    try {
      const d = await api<{ plan: Plan; networks: NetStat[]; web: WebHit[]; world?: WebHit[]; sources?: WebHit[] }>(
        "/smm/ai?action=market", { method: "POST", body: JSON.stringify({ days }) })
      setPlan(d.plan)
      setNets(d.networks || [])
      setWeb(d.web || [])
      setSources(d.sources || [])
      setWorld(d.world || [])
      setDone([]) // yangi reja — belgilar nolga qaytadi
      detailCache.current = {} // eski tafsilotlar yangi rejaga to'g'ri kelmaydi
      setPlanAt(new Date().toISOString())
    } catch (e) { setErr(e instanceof Error ? e.message : tr("Tahlil qilinmadi")) }
  })

  /**
   * Rejadagi o'zgarishni serverga saqlash.
   *
   * Optimistik: ekran DARHOL yangilanadi, so'rov fonda ketadi. Sabab —
   * belgilash tez-tez bosiladigan amal va har safar kutib turish
   * asabiy. Xato bo'lsa qayta yuklab, haqiqiy holatni ko'rsatamiz.
   */
  const savePlan = async (patch: { done?: number[]; reja?: PlanItem[] }) => {
    try {
      await api("/smm/ai?action=plan_update", { method: "POST", body: JSON.stringify(patch) })
    } catch {
      setErr(tr("O'zgarish saqlanmadi — qayta urining"))
      load()
    }
  }

  /** Kunni bajarildi / bajarilmadi qilib belgilash */
  const toggleDone = (kun: number) => {
    const next = done.includes(kun) ? done.filter((d) => d !== kun) : [...done, kun].sort((a, b) => a - b)
    setDone(next)
    void savePlan({ done: next })
  }

  /** HAMMASINI belgilash / belgini olib tashlash */
  const allDone = Boolean(plan?.reja.length) && done.length >= (plan?.reja.length || 0)
  const toggleAll = () => {
    if (!plan) return
    const next = allDone ? [] : plan.reja.map((r) => r.kun)
    setDone(next)
    void savePlan({ done: next })
  }

  /** Kunni rejadan o'chirish */
  const removeDay = (kun: number) => {
    if (!plan) return
    if (!window.confirm(`${kun}-kun rejadan o'chirilsinmi?`)) return
    const reja = plan.reja.filter((r) => r.kun !== kun)
    const nextDone = done.filter((d) => d !== kun)
    setPlan({ ...plan, reja }); setDone(nextDone)
    void savePlan({ reja, done: nextDone })
  }

  /**
   * Ko'p kunni birdan o'chirish.
   *
   * Belgilangan kunlar bo'lsa — FAQAT o'shalar o'chadi (bajarilganlarni
   * tozalash uchun qulay). Hech biri belgilanmagan bo'lsa — butun reja.
   */
  const removeMany = () => {
    if (!plan || !plan.reja.length) return
    const onlyDone = done.length > 0 && done.length < plan.reja.length
    const msg = onlyDone
      ? `Belgilangan ${done.length} ta kun rejadan o'chirilsinmi?`
      : `Butun reja (${plan.reja.length} kun) o'chirilsinmi?`
    if (!window.confirm(msg)) return
    const reja = onlyDone ? plan.reja.filter((r) => !done.includes(r.kun)) : []
    // Ikkala holatda ham belgilangan kunlar qolmaydi: yo ular o'chdi,
    // yo butun reja o'chdi.
    setPlan({ ...plan, reja }); setDone([])
    void savePlan({ reja, done: [] })
  }

  /** Tahrirni boshlash — joriy qiymatlar formaga ko'chiriladi */
  const startEdit = (it: PlanItem) => {
    setEditKun(it.kun)
    setEditVal({
      mavzu: txt(it.mavzu), format: txt(it.format) || "post",
      platforma: txt(it.platforma) || "telegram", vaqt: txt(it.vaqt),
    })
  }

  /** Tahrirni saqlash */
  const saveEdit = () => {
    if (!plan || editKun === null) return
    if (!editVal.mavzu.trim()) { setErr(tr("Mavzu bo'sh bo'lmasin")); return }
    const reja = plan.reja.map((r) => r.kun === editKun ? { ...r, ...editVal } : r)
    setPlan({ ...plan, reja })
    setEditKun(null)
    void savePlan({ reja })
  }

  const fmtDate = (iso: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    const p = (n: number) => String(n).padStart(2, "0")
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
  }

  /* ---------------- Reja jadvali: sana, filtr, sahifalash ---------------- */

  /**
   * Reja "1-kun, 2-kun" ko'rinishida keladi. Foydalanuvchiga esa
   * HAQIQIY sana kerak — reja qachon tuzilganidan hisoblaymiz.
   */
  const planStart = planAt ? new Date(planAt) : new Date()
  const dayDate = (kun: number) => {
    const d = new Date(planStart)
    d.setDate(d.getDate() + (kun - 1))
    return d
  }
  const dayShort = (kun: number) => {
    const d = dayDate(kun)
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`
  }
  const dayFull = (kun: number) => {
    const d = dayDate(kun)
    const p = (n: number) => String(n).padStart(2, "0")
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
  }

  // Kun bo'yicha filtr (0 — hammasi) va sahifalash
  const [dayFilter, setDayFilter] = useState(0)
  // Kun tasmasi — yon strelkalar shuni suradi (sahifani emas)
  const stripRef = useRef<HTMLDivElement>(null)
  const scrollStrip = (dir: -1 | 1) => {
    stripRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" })
  }
  const [page, setPage] = useState(1)
  const PER_PAGE = 8

  const visible = plan ? (dayFilter ? plan.reja.filter((r) => r.kun === dayFilter) : plan.reja) : []
  const pageCount = Math.max(1, Math.ceil(visible.length / PER_PAGE))
  // Filtr o'zgarganda sahifa chegaradan chiqib ketmasin
  const curPage = Math.min(page, pageCount)
  const rows = visible.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE)

  return (
    <div>
      {/* ============ SARLAVHA ============ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-extrabold tracking-tight">{tr("Marketing tahlili")}</h2>
          <p className="mt-1 text-sm text-muted">
            {tr("AI internetdagi yangiliklarni tahlil qilib, kerakli kontentlarni topadi va reja tuzadi")}
          </p>
        </div>
        {/* Ilgari bu yerda ham "Tahlilni yangilash" tugmasi bor edi va
            pastdagi "Tahlil qilish" bilan AYNAN bir ishni qilardi.
            Ikkita bir xil tugma chalkashtiradi — asosiysi kun tanlash
            tugmalari yonida turishi kerak, chunki natija o'shanga
            bog'liq. */}
      </div>

      {/* ============ BOSHQARUV ============ */}
      {/* Butun kenglikda: ichida kun tanlash tugmalari va katta
          "Tahlil qilish" tugmasi bor. Ilgari yarim ustunda edi va
          tugmalar ikki qatorga sinib, karta cho'zilib ketardi. */}
      <div className={`${card} mt-5`}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green/10 text-green">
            <Icon d={CALENDAR} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold">{tr("Tahlil va kontent reja")}</h3>
            <p className={`mt-0.5 text-sm ${planFailed ? "text-red-600" : "text-muted"}`}>
              {planFailed
                ? tr("Rejani yuklab bo'lmadi — mavjud reja yo'qolgani anglatmaydi")
                : planAt ? `Oxirgi yangilanish: ${fmtDate(planAt)}` : tr("Hali tahlil qilinmagan")}
            </p>
            {planFailed && (
              <button onClick={load} className="mt-1 text-xs font-bold text-green underline">
                Qayta urinish
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)} disabled={analyzing}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                  days === d ? "bg-green text-white" : "border border-green/20 text-muted hover:border-green/50"
                }`}>
                {d} kun
              </button>
            ))}
            <button onClick={analyze} disabled={analyzing}
              className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100">
              <Icon d={analyzing ? I.refresh : I.brain} className={`h-4 w-4 ${analyzing ? "animate-spin" : ""}`} />
              {analyzing ? tr("Tahlil qilinmoqda…") : tr("Tahlil qilish")}
            </button>
          </div>
        </div>

        {/* Uzoq kutishda nima bo'layotgani ko'rinib tursin */}
        {analyzing && (
          <div className="mt-4 space-y-2 rounded-xl bg-green/5 p-4 text-sm text-ink/75">
            <p className="flex items-center gap-2"><Icon d={I.globe} className="h-4 w-4 shrink-0 text-green" />{tr("Internetdagi yangiliklar uch tilda o'qilmoqda")}</p>
            <p className="flex items-center gap-2"><Icon d={I.chart} className="h-4 w-4 shrink-0 text-green" />{tr("Hisoblaringiz ko'rsatkichlari olinmoqda")}</p>
            <p className="flex items-center gap-2"><Icon d={I.brain} className="h-4 w-4 shrink-0 text-green" />{tr("Kontent reja tuzilmoqda")}</p>
            <p className="text-xs text-muted">{tr("Bu bir necha o'n soniya oladi.")}</p>
          </div>
        )}

        {err && <div className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{err}</div>}

        {loading && !plan && <div className="mt-4"><SkeletonCard /></div>}

        {!loading && !plan && !analyzing && (
          <p className="mt-4 rounded-xl border border-green/10 py-8 text-center text-sm text-muted">
            "Tahlil qilish" ni bosing — qolganini AI o'zi qiladi.
          </p>
        )}
      </div>

      {/* ============ RAQAMLAR ============ */}
      {/* To'rt ko'rsatkich BIR QATORDA. Ilgari alohida kartaning ichida
          edi va yonidagi boshqaruv kartasi bilan balandligi mos
          kelmasdi — o'ng tomonda katta bo'sh joy qolardi. */}
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className={card}>
          <Stat icon={I.globe} tone="bg-purple-100 text-purple-600"
            value={web.length + world.length + sources.length} label={tr("Topilgan yangilik")} />
        </div>
        <div className={card}>
          <Stat icon={I.doc} tone="bg-blue-100 text-blue-600"
            value={plan?.reja.length || 0} label={tr("Rejalashtirilgan post")} />
        </div>
        <div className={card}>
          <Stat icon={I.check} tone="bg-green/15 text-green"
            value={done.length} label={tr("Bajarilgan")} />
        </div>
        <div className={card}>
          <Stat icon={I.clock} tone="bg-orange-100 text-orange-500"
            value={Math.max(0, (plan?.reja.length || 0) - done.length)} label={tr("Kutilayotgan")} />
        </div>
      </div>

      {/* ============ MANBALAR + HISOBLAR ============ */}
      {/* `items-start` — kartalar bir-birining balandligiga cho'zilmasin.
          Ilgari qisqa karta uzunining balandligini olib, ichida katta
          bo'sh joy qolardi. */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-3">
      {/* Manbalar — tahlil sifatini shu belgilaydi, shuning uchun
          birinchi va ikki ustun kengligida: ichida forma, tayyor manba
          tugmalari va ro'yxat bor */}
      <div className={`${card} lg:col-span-2`}>
        <h3 className="font-display font-bold">{tr("Manbalar")}</h3>
        <p className="mt-0.5 text-sm text-muted">
          {tr("AI tahlilni birinchi navbatda manbalardan oladi va post yaratish rejasini tuzadi.")}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <input value={newSrc.name} onChange={(e) => setNewSrc((v) => ({ ...v, name: e.target.value }))}
            placeholder={tr("Nomi (ixtiyoriy)")}
            className="w-40 rounded-xl border border-green/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
          <input value={newSrc.url} onChange={(e) => setNewSrc((v) => ({ ...v, url: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") addSource() }}
            placeholder="https://sayt.uz/rss"
            className="min-w-[220px] flex-1 rounded-xl border border-green/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
          <button onClick={addSource} disabled={srcBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
            <Icon d={srcBusy ? I.refresh : I.globe} className={`h-4 w-4 ${srcBusy ? "animate-spin" : ""}`} />
            {srcBusy ? tr("Tekshirilmoqda…") : tr("Qo'shish")}
          </button>
        </div>

        {srcErr && <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{srcErr}</div>}
        {srcMsg && <div className="mt-3 rounded-xl bg-green/10 px-4 py-2.5 text-sm font-semibold text-green">{srcMsg}</div>}

        {/* Tayyor agro manbalar — sinash uchun bir bosishda qo'shiladi.
            Allaqachon qo'shilganlari ro'yxatda ko'rinmaydi. */}
        {SAMPLE_SOURCES.filter((s) => !srcList.some((x) => x.url === s.url)).length > 0 && (
          <div className="mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-muted">{tr("Tayyor agro manbalar")}</p>
              {/* Hammasi bitta so'rovda — birma-bir qo'shish sekin */}
              <button onClick={addAllSamples} disabled={srcBusy}
                className="text-[11px] font-bold text-green hover:underline disabled:opacity-50">
                {tr("Hammasini qo'shish")}
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SAMPLE_SOURCES
                .filter((s) => !srcList.some((x) => x.url === s.url))
                .map((s) => (
                  <button key={s.url} onClick={() => addSample(s)} disabled={srcBusy}
                    title={s.url}
                    className="inline-flex items-center gap-1 rounded-lg border border-green/20 px-2.5 py-1.5 text-[11px] font-bold text-green transition-colors hover:bg-green/5 disabled:opacity-50">
                    <Icon d="M12 5v14 M5 12h14" className="h-3 w-3" />
                    {s.name}
                  </button>
                ))}
            </div>
          </div>
        )}

        {srcList.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {srcList.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-soft px-3 py-2">
                <span className="font-semibold text-sm">{s.name}</span>
                <a href={s.url} target="_blank" rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-xs text-muted hover:text-green hover:underline">{s.url}</a>
                {s.last_error && (
                  <span className="text-xs font-semibold text-orange-600" title={s.last_error}>{tr("o'qilmadi")}</span>
                )}
                <button onClick={() => removeSource(s)} disabled={srcBusy} title={tr("O'chirish")}
                  className="rounded-lg border border-red-200 p-1.5 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50">
                  <Icon d="M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          /* Ikonka va matn BIRGA markazlashsin: flex bo'lganda matn
             alohida element bo'lib qolar va ikonka chetda osilib
             turardi. Inline-flex + span buni to'g'irlaydi. */
          <div className="mt-3 rounded-xl bg-soft px-4 py-6 text-center">
            {srcFailed ? (
              <p className="inline-flex items-center gap-2 text-sm text-red-600">
                <Icon d={I.bolt} className="h-4 w-4 shrink-0" />
                <span>{tr("Manbalarni yuklab bo'lmadi.")}</span>
                <button onClick={loadSources} className="font-bold underline">{tr("Qayta urinish")}</button>
              </p>
            ) : (
            <p className="inline-flex items-center gap-2 text-sm text-muted">
              <Icon d={I.bolt} className="h-4 w-4 shrink-0 text-green" />
              <span>{tr("Hali manba qo'shilmagan — AI faqat Google yangiliklaridan foydalanadi.")}</span>
            </p>
            )}
          </div>
        )}
      </div>

      {/* Bizning hisoblar — AI xulosasi shu raqamlarga asoslangan */}
      <div className={card}>
        <h3 className="font-display font-bold">{tr("Bizning hisoblar")}</h3>
        <p className="mt-0.5 text-sm text-muted">{tr("Hisoblaringizdan ko'rsatkichlar avtomatik olinadi")}</p>
        {nets.length > 0 ? (
          /* Har tarmoq — BITTA QATOR: ikonka chapda, nom va raqam
             yonida. Ilgari markazlashgan baland kartachalar edi va tor
             ustunda ular ustma-ust tushib, karta yonidagi "Manbalar"
             dan ikki barobar uzun bo'lib ketardi. */
          <ul className="mt-3 space-y-2">
            {nets.map((n) => (
              <li key={n.platform} className="flex items-center gap-3 rounded-xl border border-green/10 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green/10 text-green">
                  <Icon d={PLATFORM_ICON[n.platform] || I.globe} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">{PLATFORM_LABEL[n.platform] || n.platform}</span>
                  <span className="block truncate text-[11px] text-muted" title={n.name}>{n.name}</span>
                </span>
                {n.error ? (
                  <span className="shrink-0 text-[11px] font-semibold text-red-600" title={n.error}>{tr("xato")}</span>
                ) : (
                  <span className="shrink-0 text-right text-[11px] text-muted">
                    {n.followers !== null
                      ? <><strong className="block text-sm text-ink">{n.followers.toLocaleString("uz")}</strong> obunachi</>
                      : n.avgLikes !== null
                        ? <><strong className="block text-sm text-ink">{n.avgLikes}</strong> layk</>
                        : tr("ma'lumot yo'q")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl bg-soft py-6 text-center text-sm text-muted">
            {tr("Tarmoq ulanmagan — SMM / AI bo'limidan ulang.")}
          </p>
        )}
      </div>

      </div>

      {/* ============ NATIJA ============ */}
      {plan && (
        <>
          {/* ---- STRATEGIYA: uchala ro'yxat BIR QATORDA ----
              Ilgari "Sotuv" yuqorida, "O'sish" va "Kontent turlari" esa
              pastda alohida-alohida butun kenglikda turardi. Uchtasi bir
              xil turdagi ro'yxat bo'lgani uchun ularni yonma-yon qo'yish
              solishtirishni osonlashtiradi va sahifani uch barobar
              qisqartiradi.

              Ro'yxatlar uzunligi har xil: `items-start` kartalarni
              cho'zmaydi, ichki `max-h` esa bittasi juda uzun bo'lsa
              qatorni buzmaydi. */}
          {(txtList(plan.sotuv).length > 0 || txtList(plan.osish).length > 0 || txtList(plan.kontent_turlari).length > 0) && (
            <div className="mt-5 grid items-start gap-5 lg:grid-cols-3">
              <StrategiyaKarta
                title={tr("Sotuvni oshirish")}
                hint={tr("Sotuvni oshirish uchun aniq qadamlar")}
                items={txtList(plan.sotuv)}
                belgi="check"
              />
              <StrategiyaKarta
                title={tr("Tarmoqni o'stirish")}
                hint={tr("Obunachi va qamrovni oshirish uchun aniq amallar")}
                items={txtList(plan.osish)}
              />
              <StrategiyaKarta
                title={tr("Qanday kontent ishlaydi")}
                hint={tr("Sizning holatingizda samarali kontent turlari va nega")}
                items={txtList(plan.kontent_turlari)}
              />
            </div>
          )}

          {/* Kunlik reja */}
          <div className={`${card} mt-5`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display font-bold">{days} kunlik kontent reja</h3>
              {plan.reja.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted">{done.length} / {plan.reja.length} bajarildi</span>
                  {/* Belgilanganlar bo'lsa faqat o'shalar, aks holda butun reja */}
                  <button onClick={removeMany}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-50">
                    <Icon d="M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6" className="h-3 w-3" />
                    {done.length > 0 && done.length < plan.reja.length
                      ? `Belgilanganni o'chirish (${done.length})`
                      : tr("Hammasini o'chirish")}
                  </button>
                </div>
              )}
            </div>
            {/* Bajarilish chizig'i — qancha qolganini bir qarashda ko'rsatadi */}
            {plan.reja.length > 0 && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-soft">
                <div className="h-full rounded-full bg-green transition-all"
                  style={{ width: `${Math.round((done.length / plan.reja.length) * 100)}%` }} />
              </div>
            )}
            <p className="mt-2 text-sm text-muted">
              Kun ustiga bosing — <strong>{tr("to'liq marketing reja")}</strong> ochiladi:
              ssenariy, matn, rasmlar, format, joylash va vaqt.
            </p>

            {/* Kun tasmasi — kerakli kunga tez o'tish uchun filtr.
                Bosilgan kun qayta bosilsa filtr olib tashlanadi. */}
            {plan.reja.length > 1 && (
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => scrollStrip(-1)} aria-label="Chapga"
                  className="shrink-0 rounded-lg border border-green/15 p-2 text-muted transition-colors hover:border-green/50">
                  <Icon d="M15 18l-6-6 6-6" className="h-4 w-4" />
                </button>
                <div ref={stripRef} className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                  {/* "Hammasi" — tanlangan kundan qaytish uchun. Tasmaning
                      BOSHIDA turadi: jadval ostidagi havolani hech kim
                      ko'rmasdi. */}
                  <button onClick={() => { setDayFilter(0); setPage(1) }}
                    className={`shrink-0 rounded-xl border px-4 py-2 text-center transition-colors ${
                      dayFilter === 0 ? "border-green bg-green text-white" : "border-green/12 hover:border-green/40"
                    }`}>
                    <span className="block text-sm font-bold">{tr("Hammasi")}</span>
                    <span className={`block text-[11px] ${dayFilter === 0 ? "text-white/80" : "text-muted"}`}>
                      {plan.reja.length} kun
                    </span>
                  </button>
                  {plan.reja.map((r) => {
                    const active = dayFilter === r.kun
                    return (
                      <button key={r.kun} onClick={() => { setDayFilter(active ? 0 : r.kun); setPage(1) }}
                        className={`shrink-0 rounded-xl border px-4 py-2 text-center transition-colors ${
                          active ? "border-green bg-green/10" : "border-green/12 hover:border-green/40"
                        }`}>
                        <span className={`block text-sm font-bold ${active ? "text-green" : ""}`}>{dayShort(r.kun)}</span>
                        <span className="block text-[11px] text-muted">{r.kun}-kun</span>
                      </button>
                    )
                  })}
                </div>
                <button onClick={() => scrollStrip(1)} aria-label="O'ngga"
                  className="shrink-0 rounded-lg border border-green/15 p-2 text-muted transition-colors hover:border-green/50">
                  <Icon d="M9 18l6-6-6-6" className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="border-b border-green/10 text-left text-xs font-bold text-muted">
                    {/* Hammasini belgilash */}
                    <th className="w-8 pb-2 pr-2">
                      <button onClick={toggleAll}
                        title={allDone ? tr("Hamma belgini olib tashlash") : tr("Hammasini bajarildi deb belgilash")}
                        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                          allDone ? "border-green bg-green text-white" : "border-green/30 hover:border-green"
                        }`}>
                        {allDone && <Icon d={I.check} className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="pb-2 pr-3">{tr("Kun / Vaqt")}</th>
                    <th className="pb-2 pr-3">{tr("Mavzu")}</th>
                    <th className="pb-2 pr-3">{tr("Format")}</th>
                    <th className="pb-2 pr-3">{tr("Tarmoq")}</th>
                    <th className="pb-2 pr-3">{tr("Holat")}</th>
                    <th className="pb-2 pr-1 text-right">{tr("Amallar")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((it, i) => {
                    const isDone = done.includes(it.kun)
                    if (editKun === it.kun) {
                      return (
                        <tr key={i} className="border-b border-green/5 bg-green/5 align-top">
                          <td className="py-3 pr-2" />
                          <td className="py-3 pr-3 font-bold text-green">{it.kun}</td>
                          <td className="py-3 pr-3">
                            <input value={editVal.mavzu} onChange={(e) => setEditVal((v) => ({ ...v, mavzu: e.target.value }))}
                              placeholder={tr("Mavzu")}
                              className="w-full rounded-lg border border-green/25 px-2 py-1.5 text-sm outline-none focus:border-green" />
                          </td>
                          <td className="py-3 pr-3">
                            <select value={editVal.format} onChange={(e) => setEditVal((v) => ({ ...v, format: e.target.value }))}
                              className="rounded-lg border border-green/25 px-2 py-1.5 text-xs outline-none focus:border-green">
                              {["post", "video", "karusel", "storis"].map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </td>
                          <td className="py-3 pr-3">
                            <select value={editVal.platforma} onChange={(e) => setEditVal((v) => ({ ...v, platforma: e.target.value }))}
                              className="rounded-lg border border-green/25 px-2 py-1.5 text-xs outline-none focus:border-green">
                              {Object.keys(PLATFORM_LABEL).map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
                            </select>
                          </td>
                          <td className="py-3 pr-3">
                            <input value={editVal.vaqt} onChange={(e) => setEditVal((v) => ({ ...v, vaqt: e.target.value }))}
                              placeholder="18:00"
                              className="w-20 rounded-lg border border-green/25 px-2 py-1.5 text-xs outline-none focus:border-green" />
                          </td>
                          <td className="py-3 pr-1 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button onClick={saveEdit} className="rounded-lg bg-green px-3 py-1.5 text-xs font-bold text-white">{tr("Saqlash")}</button>
                              <button onClick={() => setEditKun(null)} className="rounded-lg border border-green/20 px-3 py-1.5 text-xs font-bold text-muted">{tr("Bekor")}</button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={i} onClick={() => openPlanItem(it)} title={tr("To'liq rejani ochish")}
                        className={`cursor-pointer border-b border-green/5 align-top transition-colors hover:bg-green/5 ${isDone ? "opacity-55" : ""}`}>
                        {/* stopPropagation: qator bosilib modal ochilmasin */}
                        <td className="py-3 pr-2" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleDone(it.kun)}
                            title={isDone ? tr("Bajarilmadi deb belgilash") : tr("Bajarildi deb belgilash")}
                            className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                              isDone ? "border-green bg-green text-white" : "border-green/30 hover:border-green"
                            }`}>
                            {isDone && <Icon d={I.check} className="h-3 w-3" />}
                          </button>
                        </td>
                        {/* Kun / vaqt — kalendar ikonkasi bilan */}
                        <td className="whitespace-nowrap py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <Icon d={CALENDAR} className="h-4 w-4 shrink-0 text-muted" />
                            <span>
                              <span className="block text-xs font-semibold">{dayFull(it.kun)}</span>
                              <span className="block text-[11px] text-muted">{txt(it.vaqt) || "—"}</span>
                            </span>
                          </div>
                        </td>
                        <td className="max-w-[320px] py-3 pr-3">
                          <p className={`font-semibold ${isDone ? "line-through" : ""}`}>{txt(it.mavzu)}</p>
                          {txt(it.maqsad) ? <p className="mt-0.5 text-xs text-muted">{txt(it.maqsad)}</p> : null}
                          <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-green/10 px-1.5 py-0.5 text-[11px] font-bold text-green">
                            <Icon d={I.doc} className="h-3 w-3" /> To'liq reja
                          </span>
                        </td>
                        {/* Format — belgi (chip) */}
                        <td className="py-3 pr-3">
                          <span className="rounded-md bg-soft px-2 py-1 text-[11px] font-semibold capitalize text-muted">
                            {txt(it.format) || "post"}
                          </span>
                        </td>
                        {/* Tarmoq — ikonka + nom */}
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <Icon d={PLATFORM_ICON[txt(it.platforma)] || I.globe} className="h-4 w-4 shrink-0 text-green" />
                            <span className="text-xs">{PLATFORM_LABEL[txt(it.platforma)] || txt(it.platforma)}</span>
                          </div>
                        </td>
                        {/* Holat: bajarilgan bo'lsa belgi, aks holda tugma */}
                        <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                          {isDone ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-green/10 px-2.5 py-1.5 text-[11px] font-bold text-green">
                              <Icon d={I.check} className="h-3 w-3" /> Bajarildi
                            </span>
                          ) : (
                            /* Post yaratilsa kun avtomatik bajarildi bo'ladi */
                            <button onClick={() => { onCreatePost(txt(it.mavzu), txt(it.platforma) || "telegram", txt(it.format) || "post"); toggleDone(it.kun) }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-green/25 px-2.5 py-1.5 text-[11px] font-bold text-green transition-colors hover:bg-green hover:text-white">
                              <Icon d={I.bolt} className="h-3 w-3" /> Post yaratish
                            </button>
                          )}
                        </td>
                        <td className="py-3 pr-1 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => startEdit(it)} title={tr("Tahrirlash")}
                              className="rounded-lg border border-green/20 p-1.5 text-muted transition-colors hover:border-green/50 hover:text-green">
                              <Icon d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => removeDay(it.kun)} title={tr("O'chirish")}
                              className="rounded-lg border border-red-200 p-1.5 text-red-500 transition-colors hover:bg-red-50">
                              <Icon d="M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6" className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Sahifalash — 30 kunlik rejada hamma qatorni birdan
                ko'rsatish jadvalni cho'zib yuboradi */}
            {pageCount > 1 && (
              <div className="mt-4 flex items-center justify-center gap-1.5">
                <button onClick={() => setPage(curPage - 1)} disabled={curPage <= 1} aria-label="Oldingi"
                  className="rounded-lg border border-green/15 p-2 text-muted transition-colors hover:border-green/50 disabled:opacity-40">
                  <Icon d="M15 18l-6-6 6-6" className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1)
                  // Uzun ro'yxatда faqat atrofdagi sahifalar ko'rsatiladi
                  .filter((n) => n === 1 || n === pageCount || Math.abs(n - curPage) <= 1)
                  .map((n, idx, arr) => (
                    <span key={n} className="flex items-center gap-1.5">
                      {idx > 0 && arr[idx - 1] !== n - 1 && <span className="text-xs text-muted">…</span>}
                      <button onClick={() => setPage(n)}
                        className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition-colors ${
                          n === curPage ? "bg-green text-white" : "border border-green/15 text-muted hover:border-green/50"
                        }`}>
                        {n}
                      </button>
                    </span>
                  ))}
                <button onClick={() => setPage(curPage + 1)} disabled={curPage >= pageCount} aria-label="Keyingi"
                  className="rounded-lg border border-green/15 p-2 text-muted transition-colors hover:border-green/50 disabled:opacity-40">
                  <Icon d="M9 18l6-6-6-6" className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Filtr yoqilganda nima ko'rsatilayotgani aniq bo'lsin.
                Qaytish tugmasi tasmaning boshida ("Hammasi"). */}
            {dayFilter > 0 && (
              <p className="mt-3 text-center text-xs text-muted">
                Faqat <strong className="text-ink">{dayShort(dayFilter)}</strong> ko'rsatilmoqda ·{" "}
                <button onClick={() => { setDayFilter(0); setPage(1) }} className="font-bold text-green hover:underline">
                  hammasini ko'rsatish
                </button>
              </p>
            )}
          </div>

          {/* ---- REJA NIMAGA ASOSLANGAN: uchala manba BIR QATORDA ----
              Uchtasi ham havolalar ro'yxati. Ilgari uchalasi alohida,
              butun kenglikda va bir-birining ostida turardi — sahifa
              oxiri cheksiz bo'lib ketardi va nima qayerdan kelganini
              solishtirib bo'lmasdi.

              Tartib ATAYLAB shunday: AI birinchi navbatda SIZNING
              manbalaringizga tayanadi, shuning uchun ular birinchi. */}
          {(sources.length > 0 || web.length > 0 || world.length > 0) && (
            <div className="mt-5 grid items-start gap-5 lg:grid-cols-3">
              <ManbaKarta
                title={tr("Sizning manbalaringiz")}
                hint={tr("Manbalar bo'limida kiritilgan saytlar — AI birinchi navbatda shulardan o'rgandi")}
                items={sources}
              />
              <ManbaKarta
                title={tr("Yangiliklar")}
                hint={tr("Tahlil shu manbalarni ham hisobga oldi")}
                items={web}
              />
              <ManbaKarta
                title={tr("Jahon agro tendensiyalari")}
                hint={tr("Global narxlar, texnologiya va bozor holati")}
                items={world}
              />
            </div>
          )}
        </>
      )}

      {/* ============ TO'LIQ REJA (modal) ============ */}
      {openItem && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
          onClick={() => setOpenItem(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-green">{openItem.kun}-kun · {txt(openItem.format) || "post"} · {PLATFORM_LABEL[txt(openItem.platforma)] || txt(openItem.platforma)}</p>
                <h3 className="mt-0.5 font-display text-lg font-extrabold">{txt(openItem.mavzu)}</h3>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* Saqlangan reja yoqmasa — qaytadan yozdirish */}
                {detail && !loadingDetail && (
                  <button onClick={() => openPlanItem(openItem, true)} title={tr("Qaytadan yozdirish")}
                    className="rounded-lg border border-green/20 px-2.5 py-1.5 text-[11px] font-bold text-green transition-colors hover:bg-green/5">
                    <Icon d={I.refresh} className="mr-1 inline h-3 w-3" /> Qaytadan
                  </button>
                )}
                <button onClick={() => setOpenItem(null)} aria-label="Yopish"
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-soft hover:text-ink">
                  <Icon d="M18 6L6 18 M6 6l12 12" className="h-5 w-5" />
                </button>
              </div>
            </div>

            {loadingDetail && (
              <div className="mt-5 space-y-2 rounded-xl bg-green/5 p-4 text-sm text-ink/75">
                <p className="flex items-center gap-2">
                  <Icon d={I.refresh} className="h-4 w-4 shrink-0 animate-spin text-green" />
                  To'liq reja yozilmoqda…
                </p>
                <p className="text-xs text-muted">{tr("Ssenariy, tezislar va joylash rejasi tayyorlanmoqda.")}</p>
              </div>
            )}

            {detailErr && (
              <div className="mt-5 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{detailErr}</div>
            )}

            {detail && !loadingDetail && (
              <div className="mt-5 space-y-4 text-sm">
                <Block title={tr("Nega aynan shu mavzu")} body={txt(detail.nega)} />
                <Block title={tr("Kimga qaratilgan")} body={txt(detail.auditoriya)} />

                {txt(detail.hook) && (
                  <div className="rounded-xl border border-green/20 bg-green/5 p-3">
                    <p className="text-xs font-bold text-green">{tr("Ochilish jumlasi")}</p>
                    <p className="mt-1 font-semibold text-ink">{txt(detail.hook)}</p>
                  </div>
                )}

                <ListBlock title={tr("Matnda yoritiladigan fikrlar")} items={txtList(detail.tezislar)} />

                {txt(detail.matn_namuna) && (
                  <div>
                    <p className="text-xs font-bold text-muted">{tr("Tayyor post matni")}</p>
                    <p className="mt-1 whitespace-pre-wrap rounded-xl bg-soft p-3 text-ink/85">{txt(detail.matn_namuna)}</p>
                  </div>
                )}

                {/* VIDEO uchun — ssenariy va ma'no */}
                {Array.isArray(detail.ssenariy) && detail.ssenariy.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted">{tr("Video ssenariysi")}</p>
                    <div className="mt-1 space-y-2">
                      {(detail.ssenariy as unknown[]).map((sc, i) => {
                        const o = (sc || {}) as Record<string, unknown>
                        return (
                          <div key={i} className="rounded-xl border border-green/10 p-3">
                            <p className="text-[11px] font-bold text-green">{txt(o.vaqt) || `${i + 1}-kadr`}</p>
                            {txt(o.kadr) && <p className="mt-0.5 text-ink/85"><strong className="text-muted">{tr("Kadr:")}</strong> {txt(o.kadr)}</p>}
                            {txt(o.gap) && <p className="mt-0.5 text-ink/85"><strong className="text-muted">{tr("Gap:")}</strong> {txt(o.gap)}</p>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <Block title={tr("Videoning asl ma'nosi")} body={txt(detail.video_mazmuni)} />
                <Block title={tr("Qanday suratga olish")} body={txt(detail.suratga_olish)} />

                {/* RASM uchun */}
                <Block title={tr("Rasm nimani anglatsin")} body={txt(detail.tasvir_mazmuni)} />
                <Block title={tr("Kadr kompozitsiyasi")} body={txt(detail.kompozitsiya)} />

                <Block title={tr("Muqova")} body={txt(detail.muqova)} />
                <Block title={tr("Qachon va qayerga joylash")} body={txt(detail.joylash)} />
                <Block title={tr("Kutilgan natija")} body={txt(detail.kutilgan_natija)} />
                <Block title={tr("Chaqiriq (CTA)")} body={txt(detail.keyingi_qadam)} />

                {txtList(detail.hashtaglar).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {txtList(detail.hashtaglar).map((h, i) => (
                      <span key={i} className="rounded-lg bg-soft px-2 py-1 text-xs font-semibold text-muted">{h}</span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    onCreatePost(txt(openItem.mavzu), txt(openItem.platforma) || "telegram", txt(openItem.format) || "post")
                    setOpenItem(null)
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90">
                  <Icon d={I.bolt} className="h-4 w-4" /> Shu reja bo'yicha post yaratish
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
