import { useCallback, useEffect, useState } from "react"
import { Icon, I, useBusy, SkeletonCard } from "../../lib/ui"
import { api } from "../../lib/api"

/**
 * Marketing tahlili.
 *
 * NIMA QILADI: o'z hisoblarimiz + raqobatchilar + (kalit bo'lsa) veb
 * tendensiyalarini yig'ib, AI dan sotuvni oshirish yo'llari va kunlik
 * kontent reja so'raydi.
 *
 * OCHIQ CHEKLOV: "butun internetni tahlil qilish" imkonsiz. Ishonchli
 * manba — Instagram business_discovery orqali raqobatchilarning OCHIQ
 * ko'rsatkichlari. Veb qidiruv faqat qidiruv API kaliti sozlangan
 * bo'lsa ishlaydi; sozlanmagan bo'lsa o'sha qism shunchaki tushib
 * qoladi va buni panel ochiq aytadi.
 */

const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"

type Competitor = {
  id: string; username: string; label: string | null
  followers: number | null; posts: number | null; avg_likes: number | null
  last_error: string | null; checked_at: string | null
}

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
type WebHit = { title: string; snippet: string; url: string }

const PLATFORM_LABEL: Record<string, string> = {
  telegram: "Telegram", instagram: "Instagram", facebook: "Facebook",
  linkedin: "LinkedIn", youtube: "YouTube",
}

export default function MarketPanel() {
  const [comps, setComps] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)

  const [newUser, setNewUser] = useState("")
  // Qo'lda qo'shish endi asosiy oqim emas — AI o'zi topadi.
  // Lekin aniq raqobatchini kuzatmoqchi bo'lsa imkoniyat qolsin.
  const [manualOpen, setManualOpen] = useState(false)
  const [addBusy, runAdd] = useBusy()
  const [compMsg, setCompMsg] = useState("")

  const [days, setDays] = useState(7)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [nets, setNets] = useState<NetStat[]>([])
  const [compStats, setCompStats] = useState<CompStat[]>([])
  const [web, setWeb] = useState<WebHit[]>([])
  const [analyzing, runAnalyze] = useBusy()
  const [err, setErr] = useState("")
  const [planAt, setPlanAt] = useState("")

  const [making, setMaking] = useState<number | null>(null)
  const [madeMsg, setMadeMsg] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api<{ competitors: Competitor[] }>("/smm/ai?action=competitors", { method: "POST", body: "{}" })
        .then((d) => setComps(d.competitors || []))
        .catch(() => { /* ro'yxat bo'sh qoladi */ }),
      // Oxirgi saqlangan reja — har safar qaytadan tahlil qilish shart emas
      api<{ last: { data: Plan & { networks?: NetStat[]; competitors?: CompStat[]; web?: WebHit[] }; days: number; created_at: string } | null }>(
        "/smm/ai?action=last_plan", { method: "POST", body: "{}" })
        .then((d) => {
          if (!d.last) return
          setPlan(d.last.data)
          setNets(d.last.data.networks || [])
          setCompStats(d.last.data.competitors || [])
          setWeb(d.last.data.web || [])
          setDays(d.last.days || 7)
          setPlanAt(d.last.created_at)
        })
        .catch(() => { /* reja yo'q — normal holat */ }),
    ]).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const addComp = () => runAdd(async () => {
    setCompMsg("")
    if (!newUser.trim()) { setCompMsg("Instagram nomini kiriting"); return }
    try {
      await api("/smm/ai?action=competitor_add", { method: "POST", body: JSON.stringify({ username: newUser }) })
      setNewUser("")
      load()
    } catch (e) { setCompMsg(e instanceof Error ? e.message : "Qo'shilmadi") }
  })

  const removeComp = (id: string) => runAdd(async () => {
    await api("/smm/ai?action=competitor_remove", { method: "POST", body: JSON.stringify({ id }) }).catch(() => {})
    load()
  })

  const analyze = (rediscover = false) => runAnalyze(async () => {
    setErr(""); setMadeMsg("")
    try {
      const d = await api<{ plan: Plan; networks: NetStat[]; competitors: CompStat[]; web: WebHit[] }>(
        "/smm/ai?action=market", { method: "POST", body: JSON.stringify({ days, rediscover }) })
      setPlan(d.plan)
      setNets(d.networks || [])
      setCompStats(d.competitors || [])
      setWeb(d.web || [])
      setPlanAt(new Date().toISOString())
      load()
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
          Raqobatchilar va o'z hisoblaringizni tahlil qilib, kontent reja tuzadi
        </p>
      </div>

      {/* ============ RAQOBATCHILAR ============ */}
      <div className={`${card} mt-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-bold">1. Raqobatchilar</h3>
            <p className="mt-0.5 text-sm text-muted">
              AI o'zi topadi — har bir hisob Instagram API orqali tekshiriladi
            </p>
          </div>
          <button onClick={() => setManualOpen((v) => !v)}
            className="text-xs font-bold text-muted hover:text-green">
            {manualOpen ? "Yopish" : "Qo'lda qo'shish"}
          </button>
        </div>

        {manualOpen && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              <input value={newUser} onChange={(e) => setNewUser(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addComp() }}
                placeholder="@nom yoki instagram.com/nom"
                className="min-w-[220px] flex-1 rounded-xl border border-green/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-green" />
              <button onClick={addComp} disabled={addBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                <Icon d={I.plus} className="h-4 w-4" /> Qo'shish
              </button>
            </div>
            {compMsg && <p className="mt-2 text-sm font-semibold text-red-600">{compMsg}</p>}
          </div>
        )}

        {loading ? (
          <div className="mt-4"><SkeletonCard /></div>
        ) : comps.length === 0 ? (
          <p className="mt-4 rounded-xl border border-green/10 py-6 text-center text-sm text-muted">
            Hali topilmagan. "Tahlil qilish" ni bosing — AI raqobatchilarni o'zi qidiradi.
          </p>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {comps.map((c) => (
              <div key={c.id} className="rounded-xl border border-green/10 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold">@{c.username}</span>
                  <button onClick={() => removeComp(c.id)} disabled={addBusy}
                    className="shrink-0 text-red-400 hover:text-red-500 disabled:opacity-40" title="O'chirish">
                    <Icon d="M18 6L6 18 M6 6l12 12" className="h-3.5 w-3.5" />
                  </button>
                </div>
                {c.last_error ? (
                  <p className="mt-1 text-xs text-orange-600">{c.last_error}</p>
                ) : c.checked_at ? (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                    {c.followers !== null && <span><strong className="text-ink">{c.followers.toLocaleString("uz")}</strong> obunachi</span>}
                    {c.avg_likes !== null && <span><strong className="text-ink">{c.avg_likes}</strong> layk</span>}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted">Hali tekshirilmagan</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============ TAHLIL ============ */}
      <div className={`${card} mt-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-bold">2. Tahlil va kontent reja</h3>
            <p className="mt-0.5 text-sm text-muted">
              {planAt ? `Oxirgi tahlil: ${fmtDate(planAt)}` : "Hali tahlil qilinmagan"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                  days === d ? "bg-green text-white" : "border border-green/20 text-muted hover:border-green/50"
                }`}>
                {d} kun
              </button>
            ))}
            {comps.length > 0 && (
              <button onClick={() => analyze(true)} disabled={analyzing}
                className="rounded-xl border border-green/20 px-3 py-2 text-xs font-bold text-muted transition-colors hover:border-green/50 hover:text-green disabled:opacity-50">
                Raqobatchilarni qayta qidirish
              </button>
            )}
            <button onClick={() => analyze(false)} disabled={analyzing}
              className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 disabled:opacity-60">
              <Icon d={I.brain} className="h-4 w-4" />
              {analyzing ? "Tahlil qilinmoqda…" : "Tahlil qilish"}
            </button>
          </div>
        </div>

        {analyzing && (
          <p className="mt-3 text-sm text-muted">
            Raqobatchilar qidirilmoqda va har biri Instagram API orqali tekshirilmoqda —
            bu bir necha o'n soniya oladi.
          </p>
        )}
        {err && <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{err}</div>}
        {madeMsg && <div className="mt-3 rounded-xl bg-green/10 px-4 py-2.5 text-sm font-semibold text-green">{madeMsg}</div>}

        {/* Raqamlar — AI xulosasi shularga asoslangan */}
        {(nets.length > 0 || compStats.length > 0) && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                          {n.followers !== null && <><strong className="text-ink">{n.followers}</strong> obunachi </>}
                          {n.avgLikes !== null && <><strong className="text-ink">{n.avgLikes}</strong> layk</>}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {compStats.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted">Raqobatchilar</p>
                <div className="mt-1.5 space-y-1.5">
                  {compStats.map((c) => (
                    <div key={c.username} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-soft px-3 py-2 text-xs">
                      <span className="font-semibold">@{c.username}</span>
                      {c.error ? <span className="text-orange-600">{c.error}</span> : (
                        <span className="text-muted">
                          {c.followers !== null && <><strong className="text-ink">{c.followers}</strong> obunachi </>}
                          {c.avgLikes !== null && <><strong className="text-ink">{c.avgLikes}</strong> layk</>}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {plan && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-soft p-4">
              <p className="text-xs font-bold text-muted">Bozor holati</p>
              <p className="mt-1 text-sm">{plan.bozor}</p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
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

            {/* Kunlik reja */}
            <div>
              <p className="font-display font-bold">{days} kunlik kontent reja</p>
              <div className="mt-2 overflow-x-auto">
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
                        <td className="max-w-[280px] py-3 pr-3">
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

            {/* Veb manbalari — bo'lsa ko'rsatamiz, bo'lmasa sababini aytamiz */}
            <div className="rounded-xl border border-green/10 p-4">
              <p className="text-xs font-bold text-muted">Veb manbalari</p>
              {web.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {web.map((h, i) => (
                    <li key={i} className="text-sm">
                      <a href={h.url} target="_blank" rel="noreferrer" className="font-semibold text-green hover:underline">{h.title}</a>
                      <span className="block text-xs text-muted">{h.snippet}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  Veb qidiruv sozlanmagan — tahlil faqat hisoblar va raqobatchilar raqamlariga asoslandi.
                  Yoqish uchun <code className="rounded bg-soft px-1">BRAVE_API_KEY</code> yoki{" "}
                  <code className="rounded bg-soft px-1">TAVILY_API_KEY</code> qo'shiladi.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
