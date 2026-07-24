import { useCallback, useEffect, useState } from "react"
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
  reja: PlanItem[]
}
type NetStat = { platform: string; name: string; followers: number | null; avgLikes: number | null; error?: string }
type WebHit = { title: string; snippet: string; url: string; source?: string; date?: string }

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

const PLATFORM_LABEL: Record<string, string> = {
  telegram: "Telegram", instagram: "Instagram", facebook: "Facebook",
  linkedin: "LinkedIn", youtube: "YouTube",
}

export default function MarketPanel() {
  const [loading, setLoading] = useState(true)

  const [days, setDays] = useState(7)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [nets, setNets] = useState<NetStat[]>([])
  const [web, setWeb] = useState<WebHit[]>([])
  const [planAt, setPlanAt] = useState("")

  const [analyzing, runAnalyze] = useBusy()
  const [err, setErr] = useState("")

  const [making, setMaking] = useState<number | null>(null)
  const [madeMsg, setMadeMsg] = useState("")

  /* Oxirgi saqlangan reja — panel ochilganda darhol ko'rinsin,
     har safar qaytadan tahlil qilish shart bo'lmasin. */
  const load = useCallback(() => {
    setLoading(true)
    api<{ last: { data: Plan & { networks?: NetStat[]; web?: WebHit[] }; days: number; created_at: string } | null }>(
      "/smm/ai?action=last_plan", { method: "POST", body: "{}" })
      .then((d) => {
        if (!d.last) return
        setPlan(d.last.data)
        setNets(d.last.data.networks || [])
        setWeb(d.last.data.web || [])
        setDays(d.last.days || 7)
        setPlanAt(d.last.created_at)
      })
      .catch(() => { /* reja yo'q — normal holat */ })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const analyze = () => runAnalyze(async () => {
    setErr(""); setMadeMsg("")
    try {
      const d = await api<{ plan: Plan; networks: NetStat[]; web: WebHit[] }>(
        "/smm/ai?action=market", { method: "POST", body: JSON.stringify({ days }) })
      setPlan(d.plan)
      setNets(d.networks || [])
      setWeb(d.web || [])
      setPlanAt(new Date().toISOString())
    } catch (e) { setErr(e instanceof Error ? e.message : "Tahlil qilinmadi") }
  })

  /** Reja bandidan darhol post yaratib, qoralama sifatida saqlash */
  const makePost = async (item: PlanItem) => {
    if (making !== null) return
    setMaking(item.kun); setMadeMsg(""); setErr("")
    try {
      const g = await api<{ generated: { sarlavha: string; matn: string; hashtaglar: string[] } }>(
        "/smm/ai?action=generate",
        { method: "POST", body: JSON.stringify({ topic: txt(item.mavzu), platform: txt(item.platforma) }) },
      )
      await api("/smm/posts", {
        method: "POST",
        body: JSON.stringify({
          title: g.generated.sarlavha || "",
          content: g.generated.matn || "",
          hashtags: (g.generated.hashtaglar || []).join(" "),
          platforms: [item.platforma],
          ai_generated: true,
        }),
      })
      setMadeMsg(`✅ ${item.kun}-kun posti yaratildi — SMM / AI bo'limida ko'ring`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Post yaratilmadi")
    } finally {
      setMaking(null)
    }
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
        {madeMsg && <div className="mt-4 rounded-xl bg-green/10 px-4 py-2.5 text-sm font-semibold text-green">{madeMsg}</div>}

        {loading && !plan && <div className="mt-4"><SkeletonCard /></div>}

        {!loading && !plan && !analyzing && (
          <p className="mt-4 rounded-xl border border-green/10 py-10 text-center text-sm text-muted">
            "Tahlil qilish" ni bosing — qolganini AI o'zi qiladi.
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

          {/* Kunlik reja */}
          <div className={`${card} mt-5`}>
            <h3 className="font-display font-bold">{days} kunlik kontent reja</h3>
            <p className="mt-0.5 text-sm text-muted">"Post yaratish" — AI shu mavzuda yozib, qoralama qilib saqlaydi</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-green/10 text-left text-xs font-bold text-muted">
                    <th className="pb-2 pr-3">Kun</th>
                    <th className="pb-2 pr-3">Mavzu</th>
                    <th className="pb-2 pr-3">Format</th>
                    <th className="pb-2 pr-3">Tarmoq</th>
                    <th className="pb-2 pr-3">Vaqt</th>
                    <th className="pb-2 pr-1 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.reja.map((it, i) => (
                    <tr key={i} className="border-b border-green/5 align-top">
                      <td className="py-3 pr-3 font-bold text-green">{it.kun}</td>
                      <td className="max-w-[300px] py-3 pr-3">
                        <p className="font-semibold">{txt(it.mavzu)}</p>
                        {txt(it.maqsad) ? <p className="mt-0.5 text-xs text-muted">{txt(it.maqsad)}</p> : null}
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted">{txt(it.format)}</td>
                      <td className="py-3 pr-3 text-xs text-muted">{PLATFORM_LABEL[txt(it.platforma)] || txt(it.platforma)}</td>
                      <td className="whitespace-nowrap py-3 pr-3 text-xs text-muted">{txt(it.vaqt) || "—"}</td>
                      <td className="py-3 pr-1 text-right">
                        <button onClick={() => makePost(it)} disabled={making !== null}
                          className="rounded-lg border border-green/25 px-3 py-1.5 text-xs font-bold text-green transition-colors hover:bg-green hover:text-white disabled:opacity-40">
                          {making === it.kun ? "Yozilmoqda…" : "Post yaratish"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
    </div>
  )
}
