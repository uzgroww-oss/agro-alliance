import { useCallback, useEffect, useState } from "react"
import { Icon, I, useBusy, SkeletonCard } from "../../lib/ui"
import { api } from "../../lib/api"

/**
 * Marketing tahlili.
 *
 * BITTA TUGMA. Foydalanuvchi hech narsa kiritmaydi va sozlamaydi:
 * AI raqobatchilarni o'zi topadi, Instagram API ularni tekshiradi,
 * Google News uch tilda yangiliklarni beradi — natijada kontent reja.
 *
 * Har bir raqam manbadan keladi: hisob ko'rsatkichlari Graph API dan,
 * yangiliklar RSS dan. AI ularni tahlil qiladi, o'ylab topmaydi.
 */

const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"

type PlanItem = {
  kun: number; mavzu: string; format: string; platforma: string
  vaqt?: string; maqsad?: string
}
type Plan = {
  bozor: string
  raqobat: string[]
  sotuv: string[]
  reja: PlanItem[]
}
type NetStat = { platform: string; name: string; followers: number | null; avgLikes: number | null; error?: string }
type CompStat = { username: string; followers: number | null; avgLikes: number | null; avgComments: number | null; error?: string }
type WebHit = { title: string; snippet: string; url: string; source?: string; date?: string }

const PLATFORM_LABEL: Record<string, string> = {
  telegram: "Telegram", instagram: "Instagram", facebook: "Facebook",
  linkedin: "LinkedIn", youtube: "YouTube",
}

export default function MarketPanel() {
  const [loading, setLoading] = useState(true)

  const [days, setDays] = useState(7)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [nets, setNets] = useState<NetStat[]>([])
  const [comps, setComps] = useState<CompStat[]>([])
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
    api<{ last: { data: Plan & { networks?: NetStat[]; competitors?: CompStat[]; web?: WebHit[] }; days: number; created_at: string } | null }>(
      "/smm/ai?action=last_plan", { method: "POST", body: "{}" })
      .then((d) => {
        if (!d.last) return
        setPlan(d.last.data)
        setNets(d.last.data.networks || [])
        setComps(d.last.data.competitors || [])
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
      const d = await api<{ plan: Plan; networks: NetStat[]; competitors: CompStat[]; web: WebHit[] }>(
        "/smm/ai?action=market", { method: "POST", body: JSON.stringify({ days }) })
      setPlan(d.plan)
      setNets(d.networks || [])
      setComps(d.competitors || [])
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
        { method: "POST", body: JSON.stringify({ topic: item.mavzu, platform: item.platforma }) },
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
          AI raqobatchilarni topadi, yangiliklarni o'qiydi va kontent reja tuzadi
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
            <p className="flex items-center gap-2"><Icon d={I.search} className="h-4 w-4 shrink-0 text-green" /> Raqobatchilar qidirilmoqda va Instagram API orqali tekshirilmoqda</p>
            <p className="flex items-center gap-2"><Icon d={I.globe} className="h-4 w-4 shrink-0 text-green" /> Yangiliklar uch tilda o'qilmoqda</p>
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
          {(nets.length > 0 || comps.length > 0) && (
            <div className={`${card} mt-5`}>
              <h3 className="font-display font-bold">Raqamlar</h3>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {nets.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted">Bizning hisoblar</p>
                    <div className="mt-1.5 space-y-1.5">
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
                {comps.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted">AI topgan raqobatchilar</p>
                    <div className="mt-1.5 space-y-1.5">
                      {comps.map((c) => (
                        <div key={c.username} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-soft px-3 py-2 text-xs">
                          <a href={`https://instagram.com/${c.username}`} target="_blank" rel="noreferrer"
                            className="font-semibold text-green hover:underline">@{c.username}</a>
                          {c.error ? <span className="text-orange-600">{c.error}</span> : (
                            <span className="text-muted">
                              {c.followers !== null && <><strong className="text-ink">{c.followers.toLocaleString("uz")}</strong> obunachi </>}
                              {c.avgLikes !== null && <><strong className="text-ink">{c.avgLikes}</strong> layk</>}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Xulosa */}
          <div className={`${card} mt-5`}>
            <h3 className="font-display font-bold">Xulosa</h3>
            <p className="mt-2 rounded-xl bg-soft p-4 text-sm">{plan.bozor}</p>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {plan.raqobat?.length > 0 && (
                <div className="rounded-xl border border-green/10 p-4">
                  <p className="text-xs font-bold text-green">Raqobatchilardan o'rganish</p>
                  <ul className="mt-2 space-y-1.5">
                    {plan.raqobat.map((r, i) => <li key={i} className="text-sm text-ink/80">• {r}</li>)}
                  </ul>
                </div>
              )}
              {plan.sotuv?.length > 0 && (
                <div className="rounded-xl border border-green/10 p-4">
                  <p className="text-xs font-bold text-green">Sotuvni oshirish</p>
                  <ul className="mt-2 space-y-1.5">
                    {plan.sotuv.map((r, i) => <li key={i} className="text-sm text-ink/80">• {r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>

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
                        <p className="font-semibold">{it.mavzu}</p>
                        {it.maqsad && <p className="mt-0.5 text-xs text-muted">{it.maqsad}</p>}
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted">{it.format}</td>
                      <td className="py-3 pr-3 text-xs text-muted">{PLATFORM_LABEL[it.platforma] || it.platforma}</td>
                      <td className="whitespace-nowrap py-3 pr-3 text-xs text-muted">{it.vaqt || "—"}</td>
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
                    <a href={h.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-green hover:underline">{h.title}</a>
                    <span className="block text-xs text-muted">{[h.source, h.date].filter(Boolean).join(" · ")}</span>
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
