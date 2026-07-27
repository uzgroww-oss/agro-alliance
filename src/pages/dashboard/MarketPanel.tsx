import { useCallback, useEffect, useRef, useState } from "react"
import { Icon, I, useBusy, SkeletonCard } from "../../lib/ui"
import { api } from "../../lib/api"

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

const PLATFORM_LABEL: Record<string, string> = {
  telegram: "Telegram", instagram: "Instagram", facebook: "Facebook",
  linkedin: "LinkedIn", youtube: "YouTube",
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

  const loadSources = useCallback(() => {
    api<{ sources: Source[] }>("/smm/ai?action=sources", { method: "POST", body: "{}" })
      .then((d) => setSrcList(d.sources || []))
      .catch(() => { /* manba yo'q — normal holat */ })
  }, [])

  const addSource = () => runSrc(async () => {
    setSrcErr(""); setSrcMsg("")
    if (!newSrc.url.trim()) { setSrcErr("Havolani kiriting"); return }
    try {
      const r = await api<{ found: number }>("/smm/ai?action=source_add", {
        method: "POST", body: JSON.stringify(newSrc),
      })
      setNewSrc({ name: "", url: "" })
      setSrcMsg(`✅ Qo'shildi — ${r.found} ta yozuv topildi`)
      loadSources()
    } catch (e) {
      setSrcErr(e instanceof Error ? e.message : "Manba qo'shilmadi")
    }
  })

  const removeSource = (s: Source) => runSrc(async () => {
    if (!window.confirm(`"${s.name}" manbasi o'chirilsinmi?`)) return
    setSrcErr(""); setSrcMsg("")
    try {
      await api("/smm/ai?action=source_delete", { method: "POST", body: JSON.stringify({ id: s.id }) })
      loadSources()
    } catch (e) {
      setSrcErr(e instanceof Error ? e.message : "O'chirilmadi")
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
        setDetailErr(e instanceof Error ? e.message : "Reja yozilmadi")
      }
    })
  }


  /* Oxirgi saqlangan reja — panel ochilganda darhol ko'rinsin,
     har safar qaytadan tahlil qilish shart bo'lmasin. */
  const load = useCallback(() => {
    setLoading(true)
    api<{ last: { data: Plan & { networks?: NetStat[]; web?: WebHit[]; sources?: WebHit[] }; days: number; created_at: string } | null }>(
      "/smm/ai?action=last_plan", { method: "POST", body: "{}" })
      .then((d) => {
        if (!d.last) return
        setPlan(d.last.data)
        setNets(d.last.data.networks || [])
        setWeb(d.last.data.web || [])
        setSources(d.last.data.sources || [])
        setDone(Array.isArray(d.last.data.done) ? (d.last.data.done as number[]) : [])
        // Ilgari yozilgan to'liq rejalar — qayta yozdirmaymiz
        const saved = d.last.data.details
        detailCache.current = (saved && typeof saved === "object" ? saved : {}) as Record<string, PlanDetail>
        setDays(d.last.days || 7)
        setPlanAt(d.last.created_at)
      })
      .catch(() => { /* reja yo'q — normal holat */ })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load(); loadSources() }, [load, loadSources])

  const analyze = () => runAnalyze(async () => {
    setErr("")
    try {
      const d = await api<{ plan: Plan; networks: NetStat[]; web: WebHit[]; sources?: WebHit[] }>(
        "/smm/ai?action=market", { method: "POST", body: JSON.stringify({ days }) })
      setPlan(d.plan)
      setNets(d.networks || [])
      setWeb(d.web || [])
      setSources(d.sources || [])
      setDone([]) // yangi reja — belgilar nolga qaytadi
      detailCache.current = {} // eski tafsilotlar yangi rejaga to'g'ri kelmaydi
      setPlanAt(new Date().toISOString())
    } catch (e) { setErr(e instanceof Error ? e.message : "Tahlil qilinmadi") }
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
      setErr("O'zgarish saqlanmadi — qayta urining")
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
    setPlan({ ...plan, reja })
    void savePlan({ reja })
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
    if (!editVal.mavzu.trim()) { setErr("Mavzu bo'sh bo'lmasin"); return }
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

  return (
    <div>
      <div>
        <h2 className="font-display text-xl font-extrabold tracking-tight">Marketing tahlili</h2>
        <p className="mt-1 text-sm text-muted">
          AI internetdagi yangiliklarni o'qib, qanday kontent kerakligini aytadi
        </p>
      </div>

      {/* ============ BITTA TUGMA ============ */}
      <div className={`${card} mt-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-bold">Tahlil va kontent reja</h3>
            <p className="mt-0.5 text-sm text-muted">
              {planAt ? `Oxirgi tahlil: ${fmtDate(planAt)}` : "Hali tahlil qilinmagan"}
            </p>
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
              className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100">
              <Icon d={analyzing ? I.refresh : I.brain} className={`h-4 w-4 ${analyzing ? "animate-spin" : ""}`} />
              {analyzing ? "Tahlil qilinmoqda…" : "Tahlil qilish"}
            </button>
          </div>
        </div>

        {/* Uzoq kutishda nima bo'layotgani ko'rinib tursin */}
        {analyzing && (
          <div className="mt-4 space-y-2 rounded-xl bg-green/5 p-4 text-sm text-ink/75">
            <p className="flex items-center gap-2"><Icon d={I.globe} className="h-4 w-4 shrink-0 text-green" /> Internetdagi yangiliklar uch tilda o'qilmoqda</p>
            <p className="flex items-center gap-2"><Icon d={I.chart} className="h-4 w-4 shrink-0 text-green" /> Hisoblaringiz ko'rsatkichlari olinmoqda</p>
            <p className="flex items-center gap-2"><Icon d={I.brain} className="h-4 w-4 shrink-0 text-green" /> Kontent reja tuzilmoqda</p>
            <p className="text-xs text-muted">Bu bir necha o'n soniya oladi.</p>
          </div>
        )}

        {err && <div className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{err}</div>}

        {loading && !plan && <div className="mt-4"><SkeletonCard /></div>}

        {!loading && !plan && !analyzing && (
          <p className="mt-4 rounded-xl border border-green/10 py-10 text-center text-sm text-muted">
            "Tahlil qilish" ni bosing — qolganini AI o'zi qiladi.
          </p>
        )}
      </div>

      {/* ============ MANBALAR ============ */}
      {/* Tahlildan OLDIN turadi: manba qo'shish tahlil sifatini
          oshiradi, shuning uchun ko'zga birinchi tashlansin. */}
      <div className={`${card} mt-5`}>
        <h3 className="font-display font-bold">Manbalar</h3>
        <p className="mt-0.5 text-sm text-muted">
          Ishonadigan saytlaringiz RSS havolasini qo'shing — AI tahlilni
          birinchi navbatda shulardan qiladi va qanday post yaratish
          kerakligini shu asosda aytadi.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <input value={newSrc.name} onChange={(e) => setNewSrc((v) => ({ ...v, name: e.target.value }))}
            placeholder="Nomi (ixtiyoriy)"
            className="w-40 rounded-xl border border-green/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
          <input value={newSrc.url} onChange={(e) => setNewSrc((v) => ({ ...v, url: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") addSource() }}
            placeholder="https://sayt.uz/rss"
            className="min-w-[220px] flex-1 rounded-xl border border-green/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
          <button onClick={addSource} disabled={srcBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
            <Icon d={srcBusy ? I.refresh : I.globe} className={`h-4 w-4 ${srcBusy ? "animate-spin" : ""}`} />
            {srcBusy ? "Tekshirilmoqda…" : "Qo'shish"}
          </button>
        </div>

        {srcErr && <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{srcErr}</div>}
        {srcMsg && <div className="mt-3 rounded-xl bg-green/10 px-4 py-2.5 text-sm font-semibold text-green">{srcMsg}</div>}

        {srcList.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {srcList.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-soft px-3 py-2">
                <span className="font-semibold text-sm">{s.name}</span>
                <a href={s.url} target="_blank" rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-xs text-muted hover:text-green hover:underline">{s.url}</a>
                {s.last_error && (
                  <span className="text-xs font-semibold text-orange-600" title={s.last_error}>o'qilmadi</span>
                )}
                <button onClick={() => removeSource(s)} disabled={srcBusy} title="O'chirish"
                  className="rounded-lg border border-red-200 p-1.5 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50">
                  <Icon d="M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl border border-green/10 py-6 text-center text-sm text-muted">
            Hali manba qo'shilmagan — AI faqat Google yangiliklaridan foydalanadi.
          </p>
        )}
      </div>

      {/* ============ NATIJA ============ */}
      {plan && (
        <>
          {/* Raqamlar — AI xulosasi shularga asoslangan. Ko'rsatamiz,
              aks holda xulosani tekshirib bo'lmaydi. */}
          {nets.length > 0 && (
            <div className={`${card} mt-5`}>
              <h3 className="font-display font-bold">Bizning hisoblar</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {nets.map((n) => (
                  <div key={n.platform} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-soft px-3 py-2 text-xs">
                    <span className="font-semibold">{PLATFORM_LABEL[n.platform] || n.platform}</span>
                    <span className="truncate text-muted">{n.name}</span>
                    {n.error ? <span className="text-red-600">{n.error}</span> : (
                      <span className="text-muted">
                        {n.followers !== null && <><strong className="text-ink">{n.followers.toLocaleString("uz")}</strong> obunachi </>}
                        {n.avgLikes !== null && <><strong className="text-ink">{n.avgLikes}</strong> layk</>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Umumiy "Xulosa" bandi olib tashlandi: AI u yerga ko'pincha
              raqam qaytarardi va foydali ma'lumot bermasdi. Aniq
              tavsiyalar qoldi. */}
          {txtList(plan.sotuv).length > 0 && (
            <div className={`${card} mt-5`}>
              <h3 className="font-display font-bold">Sotuvni oshirish</h3>
              <ul className="mt-3 space-y-2">
                {txtList(plan.sotuv).map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-ink/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tarmoqni o'stirish — obunachi va qamrovni oshirish */}
          {txtList(plan.osish).length > 0 && (
            <div className={`${card} mt-5`}>
              <h3 className="font-display font-bold">Tarmoqni o'stirish</h3>
              <p className="mt-0.5 text-sm text-muted">Obunachi va qamrovni oshirish uchun aniq amallar</p>
              <ul className="mt-3 space-y-2">
                {txtList(plan.osish).map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-ink/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Qanday kontent ishlaydi */}
          {txtList(plan.kontent_turlari).length > 0 && (
            <div className={`${card} mt-5`}>
              <h3 className="font-display font-bold">Qanday kontent ishlaydi</h3>
              <p className="mt-0.5 text-sm text-muted">Sizning holatingizda samarali kontent turlari va nega</p>
              <ul className="mt-3 space-y-2">
                {txtList(plan.kontent_turlari).map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-ink/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Kunlik reja */}
          <div className={`${card} mt-5`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display font-bold">{days} kunlik kontent reja</h3>
              {plan.reja.length > 0 && (
                <span className="text-xs font-bold text-muted">{done.length} / {plan.reja.length} bajarildi</span>
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
              Kun ustiga bosing — <strong>to'liq marketing reja</strong> ochiladi:
              ssenariy, matn tezislari, rasm mazmuni, joylash vaqti.
              "Post yaratish" esa SMM / AI bo'limida matn va rasmni o'zi yaratadi.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="border-b border-green/10 text-left text-xs font-bold text-muted">
                    {/* Hammasini belgilash */}
                    <th className="w-8 pb-2 pr-2">
                      <button onClick={toggleAll}
                        title={allDone ? "Hamma belgini olib tashlash" : "Hammasini bajarildi deb belgilash"}
                        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                          allDone ? "border-green bg-green text-white" : "border-green/30 hover:border-green"
                        }`}>
                        {allDone && <Icon d={I.check} className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="pb-2 pr-3">Kun</th>
                    <th className="pb-2 pr-3">Mavzu</th>
                    <th className="pb-2 pr-3">Format</th>
                    <th className="pb-2 pr-3">Tarmoq</th>
                    <th className="pb-2 pr-3">Vaqt</th>
                    <th className="pb-2 pr-1 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.reja.map((it, i) => {
                    const isDone = done.includes(it.kun)
                    if (editKun === it.kun) {
                      return (
                        <tr key={i} className="border-b border-green/5 bg-green/5 align-top">
                          <td className="py-3 pr-2" />
                          <td className="py-3 pr-3 font-bold text-green">{it.kun}</td>
                          <td className="py-3 pr-3">
                            <input value={editVal.mavzu} onChange={(e) => setEditVal((v) => ({ ...v, mavzu: e.target.value }))}
                              placeholder="Mavzu"
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
                              <button onClick={saveEdit} className="rounded-lg bg-green px-3 py-1.5 text-xs font-bold text-white">Saqlash</button>
                              <button onClick={() => setEditKun(null)} className="rounded-lg border border-green/20 px-3 py-1.5 text-xs font-bold text-muted">Bekor</button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={i} onClick={() => openPlanItem(it)} title="To'liq rejani ochish"
                        className={`cursor-pointer border-b border-green/5 align-top transition-colors hover:bg-green/5 ${isDone ? "opacity-55" : ""}`}>
                        {/* stopPropagation: qator bosilib modal ochilmasin */}
                        <td className="py-3 pr-2" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleDone(it.kun)}
                            title={isDone ? "Bajarilmadi deb belgilash" : "Bajarildi deb belgilash"}
                            className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                              isDone ? "border-green bg-green text-white" : "border-green/30 hover:border-green"
                            }`}>
                            {isDone && <Icon d={I.check} className="h-3 w-3" />}
                          </button>
                        </td>
                        <td className="py-3 pr-3 font-bold text-green">{it.kun}</td>
                        <td className="max-w-[300px] py-3 pr-3">
                          <p className={`font-semibold ${isDone ? "line-through" : ""}`}>{txt(it.mavzu)}</p>
                          {txt(it.maqsad) ? <p className="mt-0.5 text-xs text-muted">{txt(it.maqsad)}</p> : null}
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-green">
                            <Icon d={I.doc} className="h-3 w-3" /> To'liq reja
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted">{txt(it.format)}</td>
                        <td className="py-3 pr-3 text-xs text-muted">{PLATFORM_LABEL[txt(it.platforma)] || txt(it.platforma)}</td>
                        <td className="whitespace-nowrap py-3 pr-3 text-xs text-muted">{txt(it.vaqt) || "—"}</td>
                        <td className="py-3 pr-1 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Post yaratilsa kun avtomatik bajarildi bo'ladi */}
                            <button onClick={() => { onCreatePost(txt(it.mavzu), txt(it.platforma) || "telegram", txt(it.format) || "post"); if (!isDone) toggleDone(it.kun) }}
                              className="rounded-lg border border-green/25 px-3 py-1.5 text-xs font-bold text-green transition-colors hover:bg-green hover:text-white">
                              Post yaratish
                            </button>
                            <button onClick={() => startEdit(it)} title="Tahrirlash"
                              className="rounded-lg border border-green/20 p-1.5 text-muted transition-colors hover:border-green/50 hover:text-green">
                              <Icon d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => removeDay(it.kun)} title="O'chirish"
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
          </div>

          {/* SIZ qo'shgan manbalar — alohida va birinchi, chunki AI
              ularga ustuvor tayanadi */}
          {sources.length > 0 && (
            <div className={`${card} mt-5`}>
              <h3 className="font-display font-bold">Sizning manbalaringiz</h3>
              <p className="mt-0.5 text-sm text-muted">
                "Manbalar" bo'limida kiritilgan saytlar — AI birinchi navbatda shulardan o'rgandi
              </p>
              <ul className="mt-3 space-y-2">
                {sources.map((h, i) => (
                  <li key={i}>
                    <a href={h.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-green hover:underline">{txt(h.title)}</a>
                    <span className="block text-xs text-muted">{[txt(h.source), txt(h.date)].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Manbalar — xulosa nimaga asoslanganini ko'rish uchun */}
          {web.length > 0 && (
            <div className={`${card} mt-5`}>
              <h3 className="font-display font-bold">Yangiliklar</h3>
              <p className="mt-0.5 text-sm text-muted">Tahlil shu manbalarni ham hisobga oldi</p>
              <ul className="mt-3 space-y-2">
                {web.map((h, i) => (
                  <li key={i}>
                    <a href={h.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-green hover:underline">{txt(h.title)}</a>
                    <span className="block text-xs text-muted">{[txt(h.source), txt(h.date)].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ul>
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
                  <button onClick={() => openPlanItem(openItem, true)} title="Qaytadan yozdirish"
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
                <p className="text-xs text-muted">Ssenariy, tezislar va joylash rejasi tayyorlanmoqda.</p>
              </div>
            )}

            {detailErr && (
              <div className="mt-5 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{detailErr}</div>
            )}

            {detail && !loadingDetail && (
              <div className="mt-5 space-y-4 text-sm">
                <Block title="Nega aynan shu mavzu" body={txt(detail.nega)} />
                <Block title="Kimga qaratilgan" body={txt(detail.auditoriya)} />

                {txt(detail.hook) && (
                  <div className="rounded-xl border border-green/20 bg-green/5 p-3">
                    <p className="text-xs font-bold text-green">Ochilish jumlasi</p>
                    <p className="mt-1 font-semibold text-ink">{txt(detail.hook)}</p>
                  </div>
                )}

                <ListBlock title="Matnda yoritiladigan fikrlar" items={txtList(detail.tezislar)} />

                {txt(detail.matn_namuna) && (
                  <div>
                    <p className="text-xs font-bold text-muted">Tayyor post matni</p>
                    <p className="mt-1 whitespace-pre-wrap rounded-xl bg-soft p-3 text-ink/85">{txt(detail.matn_namuna)}</p>
                  </div>
                )}

                {/* VIDEO uchun — ssenariy va ma'no */}
                {Array.isArray(detail.ssenariy) && detail.ssenariy.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted">Video ssenariysi</p>
                    <div className="mt-1 space-y-2">
                      {(detail.ssenariy as unknown[]).map((sc, i) => {
                        const o = (sc || {}) as Record<string, unknown>
                        return (
                          <div key={i} className="rounded-xl border border-green/10 p-3">
                            <p className="text-[11px] font-bold text-green">{txt(o.vaqt) || `${i + 1}-kadr`}</p>
                            {txt(o.kadr) && <p className="mt-0.5 text-ink/85"><strong className="text-muted">Kadr:</strong> {txt(o.kadr)}</p>}
                            {txt(o.gap) && <p className="mt-0.5 text-ink/85"><strong className="text-muted">Gap:</strong> {txt(o.gap)}</p>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <Block title="Videoning asl ma'nosi" body={txt(detail.video_mazmuni)} />
                <Block title="Qanday suratga olish" body={txt(detail.suratga_olish)} />

                {/* RASM uchun */}
                <Block title="Rasm nimani anglatsin" body={txt(detail.tasvir_mazmuni)} />
                <Block title="Kadr kompozitsiyasi" body={txt(detail.kompozitsiya)} />

                <Block title="Muqova" body={txt(detail.muqova)} />
                <Block title="Qachon va qayerga joylash" body={txt(detail.joylash)} />
                <Block title="Kutilgan natija" body={txt(detail.kutilgan_natija)} />
                <Block title="Chaqiriq (CTA)" body={txt(detail.keyingi_qadam)} />

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
