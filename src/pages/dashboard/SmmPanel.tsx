import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Icon, I, useBusy, ErrorState, SkeletonCard } from "../../lib/ui"
import MediaUpload from "../../components/MediaUpload"
import { api } from "../../lib/api"

/**
 * SMM / AI paneli.
 *
 * Oqim: tarmoq tanlanadi -> AI kontent yozadi -> ODAM tahrirlab saqlaydi
 *       -> tasdiqlab joylaydi.
 *
 * MUHIM: AI hech qachon o'zi joylamaydi. Joylash faqat "Tanlanganlarga
 * joylash" tugmasi bosilganda sodir bo'ladi.
 */

const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"

export type SmmPost = {
  id: string; seq: number | null; title: string | null; content: string; hashtags: string | null
  image_url: string | null; platforms: string[]; status: string
  ai_generated: boolean; published_at: string | null; created_at: string
  results?: { platform: string; success: boolean; error?: string }[]
}
type SmmAnalysis = {
  holat: string
  tavsiyalar: { mavzu: string; sabab: string; platforma: string; format: string }[]
  eng_yaxshi_vaqt: string
}
type SmmConn = { connected: boolean; display_name: string | null; via: string }

type Platform = { key: string; label: string; ready: boolean; color: string }

const PLATFORMS: Platform[] = [
  { key: "telegram", label: "Telegram", ready: true, color: "#229ED9" },
  { key: "facebook", label: "Facebook", ready: true, color: "#1877F2" },
  { key: "instagram", label: "Instagram", ready: true, color: "#E1306C" },
  { key: "linkedin", label: "LinkedIn", ready: false, color: "#0A66C2" },
  { key: "youtube", label: "YouTube", ready: false, color: "#FF0000" },
]

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  draft: { label: "Qoralama", cls: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  pending_approval: { label: "Saqlangan", cls: "bg-green/10 text-green", dot: "bg-green" },
  published: { label: "Joylandi", cls: "bg-blue-50 text-blue-600", dot: "bg-blue-500" },
  failed: { label: "Xato", cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
}

/* ---------------- Brend belgilari ---------------- */
/* Har tarmoqning o'z rasmiy shakli va rangi — umumiy ikonka to'plami
   bilan ular bir-biridan ajralmaydi. */
const BRAND: Record<string, string> = {
  telegram: "M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z",
  facebook: "M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07z",
  linkedin: "M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z",
  youtube: "M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z",
  instagram: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.36 2.67.94 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.12.66.66 1.33 1.08 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.3 1.46-.72 2.12-1.38.66-.66 1.08-1.33 1.38-2.12.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.79-.72-1.46-1.38-2.12-.66-.66-1.33-1.08-2.12-1.38-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0z M12 5.84A6.16 6.16 0 1 0 12 18.16 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z M18.41 4.15a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z",
}

function Brand({ k, className = "h-6 w-6", color }: { k: string; className?: string; color?: string }) {
  const p = PLATFORMS.find((x) => x.key === k)
  // color — rangli fonda belgini ko'rinadigan qilish uchun (masalan oq)
  return (
    <svg viewBox="0 0 24 24" className={className} fill={color ?? p?.color ?? "currentColor"} aria-hidden>
      <path d={BRAND[k] ?? ""} />
    </svg>
  )
}

/* ---------------- Matn muharriri asboblari ---------------- */
/* Bu WYSIWYG emas — belgilangan matnni Telegram/Facebook tushunadigan
   markdown belgilariga o'raydi. Shuning uchun natija ko'rinmas emas:
   qanday yozilsa, tarmoqqa shunday ketadi. */
const EMOJIS = ["🌱", "🌾", "🚜", "🐄", "🍅", "💧", "☀️", "📈", "✅", "🔥", "💡", "📌", "🎯", "👏", "❤️", "🙌"]

export default function SmmPanel() {
  const [posts, setPosts] = useState<SmmPost[]>([])
  const [conns, setConns] = useState<Record<string, SmmConn>>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  /* 1-bosqich: tarmoq tanlash + ulash */
  const [picked, setPicked] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("smm_platforms")
      if (raw) return new Set(JSON.parse(raw) as string[])
    } catch { /* buzilgan qiymat bo'lsa standartga qaytamiz */ }
    return new Set(["telegram"])
  })
  const [connOpen, setConnOpen] = useState<string | null>(null)
  const [connForm, setConnForm] = useState({ chat_id: "", page_id: "", page_token: "" })
  const [connBusy, runConn] = useBusy()
  const [pickMsg, setPickMsg] = useState("")

  /* 2-bosqich: AI */
  const [topic, setTopic] = useState("")
  const [generating, runGenerate] = useBusy()
  const [analysis, setAnalysis] = useState<SmmAnalysis | null>(null)
  const [analyzing, runAnalyze] = useBusy()
  const [aiErr, setAiErr] = useState("")

  /* 3-bosqich: forma */
  const [form, setForm] = useState({ title: "", content: "", hashtags: "", image_url: "" })
  const [origin, setOrigin] = useState("telegram")
  const [aiMade, setAiMade] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, runSave] = useBusy()
  const [msg, setMsg] = useState("")
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)

  /* AI uslubi tanlangan tarmoqlardan biri bo'lishi shart. Foydalanuvchi
     tarmoqni bekor qilsa, uslub o'z-o'zidan qolganiga o'tadi — shuning
     uchun bu holat emas, hisoblanadigan qiymat. */
  const effOrigin = picked.has(origin) ? origin : (Array.from(picked)[0] || "telegram")

  /* Jadval */
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState("all")
  const [showAll, setShowAll] = useState(false)
  const [preview, setPreview] = useState<SmmPost | null>(null)
  const [acting, runAct] = useBusy()

  const load = useCallback(() => {
    setLoading(true); setFailed(false)
    api<{ posts: SmmPost[] }>("/smm/posts")
      .then((d) => setPosts(d.posts || []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
    api<{ connections: Record<string, SmmConn> }>("/smm/posts?action=connections")
      .then((d) => setConns(d.connections || {}))
      .catch(() => { /* ulanishlar yuklanmasa panel baribir ishlaydi */ })
  }, [])
  useEffect(() => { load() }, [load])

  /* ---------------- 1-bosqich ---------------- */
  const toggle = (p: Platform) => {
    // Belgini OLIB TASHLASH hech qachon to'sib qo'yilmaydi. Ilgari
    // ulanish tekshiruvi ikkala yo'nalishga ham ishlardi va ulanmagan
    // tarmoqni tanlangan holatda qoldirib bo'lmay qolardi.
    if (picked.has(p.key)) {
      setPickMsg("")
      setPicked((prev) => { const n = new Set(prev); n.delete(p.key); return n })
      return
    }
    if (!p.ready) { setPickMsg(`${p.label} hali qo'shilmagan`); return }
    if (!conns[p.key]?.connected) { setConnOpen(p.key); setPickMsg(`${p.label} ulanmagan — avval ulang`); return }
    setPickMsg("")
    setPicked((prev) => new Set(prev).add(p.key))
  }

  const savePick = () => {
    if (picked.size === 0) { setPickMsg("Kamida bitta tarmoq tanlang"); return }
    localStorage.setItem("smm_platforms", JSON.stringify(Array.from(picked)))
    setPickMsg("✅ Tanlov saqlandi")
  }

  const connect = (platform: string) => runConn(async () => {
    setPickMsg("")
    const body: Record<string, string> = { platform }
    if (platform === "telegram") body.chat_id = connForm.chat_id.trim()
    if (platform === "facebook") { body.page_id = connForm.page_id.trim(); body.page_token = connForm.page_token.trim() }
    try {
      const r = await api<{ display_name: string }>("/smm/posts?action=connect", { method: "POST", body: JSON.stringify(body) })
      setPickMsg(`✅ Ulandi: ${r.display_name}`)
      setConnOpen(null)
      setConnForm({ chat_id: "", page_id: "", page_token: "" })
      setPicked((prev) => new Set(prev).add(platform))
      load()
    } catch (e) { setPickMsg(`❌ ${e instanceof Error ? e.message : "Ulanmadi"}`) }
  })

  /* Instagram Facebook OAuth orqali ulanadi — chat_id/token kiritilmaydi.
     Qayta ulash ham shu tugma orqali: ruxsatlar ro'yxati o'zgarganda eski
     token eskiligicha qoladi, faqat yangi rozilik uni almashtiradi. */
  const igConnect = () => runConn(async () => {
    setPickMsg("")
    try {
      const r = await api<{ authUrl: string }>("/instagram-oauth-start", { method: "POST" })
      if (!r.authUrl) { setPickMsg("❌ Ulanish manzili olinmadi"); return }
      window.open(r.authUrl, "_blank", "width=600,height=700")
      setPickMsg("Facebook oynasida roziligini bering, keyin \"Yangilash\" tugmasini bosing")
    } catch (e) { setPickMsg(`❌ ${e instanceof Error ? e.message : "Ulanmadi"}`) }
  })

  const disconnect = (platform: string) => runConn(async () => {
    try {
      await api("/smm/posts?action=disconnect", { method: "POST", body: JSON.stringify({ platform }) })
      setPicked((prev) => { const n = new Set(prev); n.delete(platform); return n })
      setPickMsg("Uzildi")
      load()
    } catch (e) { setPickMsg(`❌ ${e instanceof Error ? e.message : "Xatolik"}`) }
  })

  /* ---------------- 2-bosqich ---------------- */
  const generate = (t?: string) => runGenerate(async () => {
    const useTopic = (t ?? topic).trim()
    if (!useTopic) { setAiErr("Mavzu yoki havola kiriting"); return }
    setAiErr("")
    try {
      const d = await api<{ generated: { sarlavha: string; matn: string; hashtaglar: string[] } }>(
        "/smm/ai?action=generate",
        { method: "POST", body: JSON.stringify({ topic: useTopic, platform: effOrigin }) },
      )
      setForm({
        title: d.generated.sarlavha || "",
        content: d.generated.matn || "",
        hashtags: (d.generated.hashtaglar || []).join(" "),
        image_url: "",
      })
      setAiMade(true)
      setEditingId(null)
      setMsg("")
    } catch (e) { setAiErr(e instanceof Error ? e.message : "AI javob bermadi") }
  })

  const analyze = () => runAnalyze(async () => {
    setAiErr("")
    try {
      const d = await api<{ analysis: SmmAnalysis }>("/smm/ai?action=analyze", { method: "POST", body: "{}" })
      setAnalysis(d.analysis)
    } catch (e) { setAiErr(e instanceof Error ? e.message : "AI javob bermadi") }
  })

  /* ---------------- 3-bosqich ---------------- */
  /* Belgilangan matnni o'rash. Belgilanmagan bo'lsa kursorga qo'yiladi. */
  const wrap = (before: string, after = before) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const sel = value.slice(s, e) || "matn"
    const next = value.slice(0, s) + before + sel + after + value.slice(e)
    setForm((f) => ({ ...f, content: next }))
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + before.length, s + before.length + sel.length)
    })
  }

  /* Har bir belgilangan qatorga prefiks qo'shish (ro'yxatlar uchun) */
  const prefixLines = (mk: (i: number) => string) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const lineStart = value.lastIndexOf("\n", s - 1) + 1
    const lineEnd = value.indexOf("\n", e) === -1 ? value.length : value.indexOf("\n", e)
    const block = value.slice(lineStart, lineEnd) || "matn"
    const out = block.split("\n").map((l, i) => mk(i) + l.replace(/^([•\d]+[.)]?\s*)/, "")).join("\n")
    setForm((f) => ({ ...f, content: value.slice(0, lineStart) + out + value.slice(lineEnd) }))
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(lineStart, lineStart + out.length) })
  }

  const insertAt = (txt: string) => {
    const ta = taRef.current
    if (!ta) { setForm((f) => ({ ...f, content: f.content + txt })); return }
    const { selectionStart: s, selectionEnd: e, value } = ta
    setForm((f) => ({ ...f, content: value.slice(0, s) + txt + value.slice(e) }))
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + txt.length, s + txt.length) })
  }

  const addLink = () => {
    const url = window.prompt("Havola manzili:", "https://")
    if (!url || url === "https://") return
    wrap("[", `](${url})`)
  }

  const save = () => runSave(async () => {
    setMsg("")
    if (!form.content.trim()) { setMsg("❌ Post matni bo'sh"); return }
    if (picked.size === 0) { setMsg("❌ Kamida bitta tarmoq tanlang"); return }
    try {
      if (editingId) {
        await api(`/smm/posts/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...form, platforms: Array.from(picked) }),
        })
        setMsg("✅ Yangilandi")
      } else {
        const r = await api<{ id: string }>("/smm/posts", {
          method: "POST",
          body: JSON.stringify({ ...form, platforms: Array.from(picked), ai_generated: aiMade }),
        })
        setEditingId(r.id)
        setMsg("✅ Saqlandi — endi joylashingiz mumkin")
      }
      load()
    } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Xatolik"}`) }
  })

  const clearForm = () => {
    setForm({ title: "", content: "", hashtags: "", image_url: "" })
    setEditingId(null); setAiMade(false); setMsg("")
  }

  /* ---------------- 4-bosqich ---------------- */
  const publish = (id: string | null) => runAct(async () => {
    if (!id) { setMsg("❌ Avval postni saqlang"); return }
    try {
      const r = await api<{ success: boolean; results: { platform: string; success: boolean; error?: string }[] }>(
        `/smm/posts/${id}?action=publish`, { method: "POST", body: "{}" })
      const bad = r.results.filter((x) => !x.success)
      setMsg(r.success
        ? (bad.length ? `⚠️ Qisman joylandi — ${bad.map((b) => `${b.platform}: ${b.error}`).join("; ")}` : "✅ Joylandi")
        : `❌ ${bad.map((b) => `${b.platform}: ${b.error}`).join("; ")}`)
      if (r.success && !bad.length) clearForm()
      load()
    } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Xatolik"}`) }
  })

  const remove = (id: string) => runAct(async () => {
    if (!window.confirm("Post o'chirilsinmi?")) return
    await api(`/smm/posts/${id}`, { method: "DELETE" }).catch(() => {})
    if (editingId === id) clearForm()
    load()
  })

  const edit = (p: SmmPost) => {
    setForm({ title: p.title || "", content: p.content, hashtags: p.hashtags || "", image_url: p.image_url || "" })
    setEditingId(p.id)
    setAiMade(p.ai_generated)
    if (p.platforms.length) setPicked(new Set(p.platforms))
    setMsg("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  /* ---------------- Jadval ---------------- */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return posts.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false
      if (!needle) return true
      return `${p.seq ?? ""} ${p.title ?? ""} ${p.content}`.toLowerCase().includes(needle)
    })
  }, [posts, q, filter])
  const shown = showAll ? filtered : filtered.slice(0, 5)

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    const p = (n: number) => String(n).padStart(2, "0")
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
  }

  const iconBtn = "grid h-8 w-8 place-items-center rounded-lg border border-green/10 text-muted transition-colors hover:border-green/30 hover:text-green disabled:opacity-40"

  /* Ulangan hisobning ko'rinadigan nomi. Instagram uchun @foydalanuvchi,
     Telegram uchun kanal nomi, Facebook uchun sahifa nomi. */
  const acctName = (k: string) => {
    const n = conns[k]?.display_name
    if (!n) return ""
    return k === "instagram" && !n.startsWith("@") ? `@${n}` : n
  }
  /* Post aynan qayerga chiqishini ro'yxatlaymiz */
  const targets = Array.from(picked).map((k) => {
    const label = PLATFORMS.find((p) => p.key === k)?.label ?? k
    const acct = acctName(k)
    return acct ? `${label} — ${acct}` : label
  })
  const offline = Array.from(picked)
    .filter((k) => !conns[k]?.connected)
    .map((k) => PLATFORMS.find((p) => p.key === k)?.label ?? k)

  return (
    <div>
      <div>
        <h2 className="font-display text-xl font-extrabold tracking-tight">SMM / AI</h2>
        <p className="mt-1 text-sm text-muted">AI yordamida kontent yarating va ijtimoiy tarmoqlarga chiqaring</p>
      </div>

      {/* ============ 1. TARMOQ TANLASH ============ */}
      <div className={`${card} mt-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-bold">1. Ijtimoiy tarmoqlarni tanlang</h3>
            <p className="mt-0.5 text-sm text-muted">Post qaysi tarmoqlarga chiqishini belgilang</p>
          </div>
          <button onClick={savePick} className="inline-flex items-center gap-2 rounded-xl border border-green/25 px-4 py-2 text-sm font-bold text-green transition-colors hover:bg-green/5">
            <Icon d={I.check} className="h-4 w-4" /> Tanlovni saqlash
          </button>
        </div>

        {pickMsg && (
          <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold ${pickMsg.startsWith("✅") ? "bg-green/10 text-green" : pickMsg.startsWith("❌") ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-700"}`}>{pickMsg}</div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PLATFORMS.map((p) => {
            const on = Boolean(conns[p.key]?.connected)
            const sel = picked.has(p.key)
            return (
              <button key={p.key} type="button" onClick={() => toggle(p)}
                className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${sel ? "border-green bg-green/5" : "border-green/10 hover:border-green/30"}`}>
                <Brand k={p.key} className="h-9 w-9 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-bold">{p.label}</span>
                  <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${on ? "bg-green/10 text-green" : "bg-gray-100 text-gray-500"}`}>
                    {on ? "Ulangan" : "Ulanmagan"}
                  </span>
                  {/* Qaysi hisobga chiqishini shu yerda ko'rsatamiz — "Ulangan"
                      degan so'zning o'zi qaysi akkaunt ekanini aytmaydi. */}
                  {on && (
                    <span className="mt-1 block truncate text-xs text-muted" title={acctName(p.key) || ""}>
                      {acctName(p.key) || "hisob nomi noma'lum"}
                    </span>
                  )}
                </span>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 ${sel ? "border-green bg-green text-white" : "border-gray-300"}`}>
                  {sel && <Icon d={I.check} className="h-3 w-3" />}
                </span>
              </button>
            )
          })}
        </div>

        {/* Ulangan tarmoqni uzish + Instagram qayta ulash */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={igConnect} disabled={connBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-pink-200 px-3 py-1.5 text-xs font-bold text-pink-600 transition-colors hover:bg-pink-50 disabled:opacity-50">
            <Brand k="instagram" className="h-3.5 w-3.5" />
            {conns.instagram?.connected ? "Instagram'ni qayta ulash" : "Instagram'ni ulash"}
          </button>
          <button onClick={load} disabled={connBusy}
            className="rounded-lg border border-green/20 px-3 py-1.5 text-xs font-bold text-muted transition-colors hover:border-green/40 hover:text-green disabled:opacity-50">
            Yangilash
          </button>
          {PLATFORMS.filter((p) => conns[p.key]?.connected && p.key !== "instagram").map((p) => (
            <button key={p.key} onClick={() => disconnect(p.key)} disabled={connBusy}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50">
              {p.label}ni uzish
            </button>
          ))}
        </div>

        {connOpen === "telegram" && (
          <div className="mt-3 rounded-xl border border-green/15 bg-soft p-4">
            <p className="text-xs text-muted">Botni kanalga <strong>admin</strong> qilib qo'shing, keyin kanal @nomini yoki ID sini kiriting.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input value={connForm.chat_id} onChange={(e) => setConnForm((f) => ({ ...f, chat_id: e.target.value }))} placeholder="@kanal_nomi yoki -1001234567890" className="min-w-[220px] flex-1 rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green" />
              <button onClick={() => connect("telegram")} disabled={connBusy} className="rounded-lg bg-green px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {connBusy ? "Tekshirilmoqda…" : "Ulash"}
              </button>
            </div>
          </div>
        )}

        {connOpen === "facebook" && (
          <div className="mt-3 rounded-xl border border-green/15 bg-soft p-4">
            <p className="text-xs text-muted">Facebook sahifangizning ID va Page Access Token'ini kiriting.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input value={connForm.page_id} onChange={(e) => setConnForm((f) => ({ ...f, page_id: e.target.value }))} placeholder="Page ID" className="rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green" />
              <input value={connForm.page_token} onChange={(e) => setConnForm((f) => ({ ...f, page_token: e.target.value }))} placeholder="Page Access Token" type="password" className="rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green" />
            </div>
            <button onClick={() => connect("facebook")} disabled={connBusy} className="mt-2 rounded-lg bg-green px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {connBusy ? "Tekshirilmoqda…" : "Ulash"}
            </button>
          </div>
        )}

        {connOpen === "instagram" && (
          <div className="mt-3 rounded-xl border border-green/15 bg-soft p-4">
            <p className="text-xs text-muted">
              Instagram Facebook orqali ulanadi. Akkaunt <strong>Business</strong> yoki
              <strong> Creator</strong> bo'lishi va Facebook sahifasiga biriktirilgan bo'lishi shart.
            </p>
            <button onClick={igConnect} disabled={connBusy} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              <Brand k="instagram" className="h-4 w-4" color="#fff" /> Facebook bilan ulash
            </button>
          </div>
        )}
      </div>

      {/* ============ 2 + 3 ============ */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.6fr]">
        {/* ---- 2. KONTENT YARATISH ---- */}
        <div className={card}>
          <h3 className="font-display font-bold">2. Kontent yaratish</h3>
          <p className="mt-0.5 text-sm text-muted">Mavzu yozing — AI tayyor post qaytaradi</p>

          {/* Uslub tanlash faqat 1-bosqichda TANLANGAN tarmoqlardan iborat.
              Bu manzil emas — matn uzunligi va ohangi shunga moslanadi. */}
          {picked.size > 1 && (
            <div className="mt-3">
              <span className="text-xs font-semibold text-muted">AI qaysi tarmoq uslubida yozsin</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Array.from(picked).map((k) => (
                  <button key={k} type="button" onClick={() => setOrigin(k)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${effOrigin === k ? "border-2 border-green bg-green/5 text-green" : "border border-green/15 text-muted hover:border-green/40"}`}>
                    <Brand k={k} className="h-3.5 w-3.5" />
                    {PLATFORMS.find((p) => p.key === k)?.label ?? k}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="relative min-w-[200px] flex-1">
              <Icon d={I.paperclip} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={topic} onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") generate() }}
                placeholder="Mavzu yoki havola kiriting…"
                className="w-full rounded-xl border border-green/15 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-green" />
            </span>
            <button onClick={() => generate()} disabled={generating} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 disabled:opacity-60">
              <Icon d={I.bolt} className="h-4 w-4" /> {generating ? "Yozilmoqda…" : "AI yozsin"}
            </button>
          </div>

          {aiErr && <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{aiErr}</div>}

          <div className="mt-4 flex gap-3 rounded-xl bg-green/5 p-4">
            <Icon d={I.robot} className="mt-0.5 h-5 w-5 shrink-0 text-green" />
            <p className="text-sm text-ink/75">
              Mavzu yozing — AI o'zbek tilida, fermerlar uchun tayyor post yozib beradi.
              Nima yozishni bilmasangiz quyidagi tugmani bosing.
            </p>
          </div>

          <button onClick={analyze} disabled={analyzing} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-green/25 px-4 py-2 text-sm font-bold text-green transition-colors hover:bg-green/5 disabled:opacity-60">
            <Icon d={I.brain} className="h-4 w-4" /> {analyzing ? "Tahlil qilinmoqda…" : "AI mavzu tavsiya qilsin"}
          </button>

          {analysis && (
            <div className="mt-3">
              <p className="rounded-xl bg-soft px-4 py-3 text-sm">{analysis.holat}</p>
              <div className="mt-2 space-y-2">
                {(analysis.tavsiyalar || []).map((t, i) => (
                  <button key={i} type="button" onClick={() => { setTopic(t.mavzu); generate(t.mavzu) }} disabled={generating}
                    className="flex w-full items-start gap-2 rounded-xl border border-green/10 p-3 text-left transition-colors hover:border-green/40 disabled:opacity-50">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.mavzu}</span>
                      <span className="mt-0.5 block text-xs text-muted">{t.sabab}</span>
                    </span>
                    <span className="shrink-0 rounded bg-green/10 px-2 py-0.5 text-[10px] font-bold text-green">{t.format}</span>
                  </button>
                ))}
              </div>
              {analysis.eng_yaxshi_vaqt && <p className="mt-2 text-xs text-muted">🕐 Eng yaxshi vaqt: {analysis.eng_yaxshi_vaqt}</p>}
            </div>
          )}
        </div>

        {/* ---- 3. TAHRIRLASH VA SAQLASH ---- */}
        <div className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display font-bold">3. Tahrirlash va saqlash</h3>
              <p className="mt-0.5 text-sm text-muted">Matnni tahrirlang, rasm yuklang va saqlang</p>
            </div>
            <div className="flex gap-2">
              {editingId && (
                <button onClick={clearForm} className="rounded-xl border border-green/15 px-4 py-2 text-sm font-bold text-muted transition-colors hover:text-ink">
                  Yangi post
                </button>
              )}
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-green/25 px-4 py-2 text-sm font-bold text-green transition-colors hover:bg-green/5 disabled:opacity-60">
                <Icon d={I.check} className="h-4 w-4" /> {saving ? "Saqlanmoqda…" : editingId ? "Yangilash" : "Saqlash"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            {/* Matn */}
            <div className="min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">Post matni</span>
                <span className={`text-xs ${form.content.length > 4500 ? "font-bold text-red-500" : "text-muted"}`}>{form.content.length} belgi</span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-green/15 bg-soft px-2 py-1.5">
                <button type="button" onClick={() => wrap("**")} title="Qalin" className="h-7 w-7 rounded font-bold hover:bg-white">B</button>
                <button type="button" onClick={() => wrap("_")} title="Qiya" className="h-7 w-7 rounded italic hover:bg-white">I</button>
                <button type="button" onClick={() => wrap("<u>", "</u>")} title="Tagi chizilgan" className="h-7 w-7 rounded underline hover:bg-white">U</button>
                <span className="mx-1 h-4 w-px bg-green/15" />
                <button type="button" onClick={() => prefixLines(() => "• ")} title="Ro'yxat" className="grid h-7 w-7 place-items-center rounded hover:bg-white">
                  <Icon d="M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01" className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => prefixLines((i) => `${i + 1}. `)} title="Raqamli ro'yxat" className="grid h-7 w-7 place-items-center rounded hover:bg-white">
                  <Icon d="M10 6h11 M10 12h11 M10 18h11 M4 6h1v4 M4 10h2 M6 16a1.5 1.5 0 1 0-2-1.4 M4 18h2.5" className="h-4 w-4" />
                </button>
                <span className="mx-1 h-4 w-px bg-green/15" />
                <button type="button" onClick={addLink} title="Havola" className="grid h-7 w-7 place-items-center rounded hover:bg-white">
                  <Icon d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" className="h-4 w-4" />
                </button>
                <span className="relative">
                  <button type="button" onClick={() => setEmojiOpen((v) => !v)} title="Emoji" className="grid h-7 w-7 place-items-center rounded hover:bg-white">
                    <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9 10h.01 M15 10h.01 M8.5 14.5a4.5 4.5 0 0 0 7 0" className="h-4 w-4" />
                  </button>
                  {emojiOpen && (
                    <span className="absolute left-0 top-9 z-20 grid w-56 grid-cols-8 gap-0.5 rounded-xl border border-green/15 bg-white p-2 shadow-xl">
                      {EMOJIS.map((em) => (
                        <button key={em} type="button" onClick={() => { insertAt(em); setEmojiOpen(false) }} className="h-6 w-6 rounded text-base hover:bg-soft">{em}</button>
                      ))}
                    </span>
                  )}
                </span>
              </div>

              <textarea ref={taRef} value={form.content} rows={8}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Post matni shu yerda ko'rinadi…"
                className="w-full resize-y rounded-b-xl border border-green/15 bg-white px-4 py-3 text-sm outline-none focus:border-green" />

              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Sarlavha (ixtiyoriy)"
                className="mt-3 w-full rounded-xl border border-green/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-green" />
            </div>

            {/* Rasm */}
            <div className="min-w-0">
              <span className="text-xs font-semibold text-muted">Rasm (ixtiyoriy)</span>
              <div className="mt-1.5">
                {form.image_url ? (
                  <div className="rounded-xl border border-green/15 bg-soft p-3">
                    <img src={form.image_url} alt="" className="h-32 w-full rounded-lg object-cover" />
                    <button type="button" onClick={() => setForm((f) => ({ ...f, image_url: "" }))} className="mt-2 text-xs font-bold text-red-500 hover:underline">Olib tashlash</button>
                  </div>
                ) : (
                  <MediaUpload accept="image/*" onUpload={(r) => setForm((f) => ({ ...f, image_url: r.signedUrl }))} />
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <span className="text-xs font-semibold text-muted"># Teglar (ixtiyoriy)</span>
            <input value={form.hashtags} onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))}
              placeholder="#teg1, #teg2, …"
              className="mt-1.5 w-full rounded-xl border border-green/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-green" />
          </div>

          {/* Post qayerga chiqishi FAQAT 1-bosqichda belgilanadi. Bu yerda
              ikkinchi tarmoq tanlagichi turgan edi ("Original tarmoq") va u
              manzilni o'zgartiradi deb tushunilardi — aslida u faqat AI
              uslubiga ta'sir qilardi. Chalkashlik bo'lmasligi uchun olib
              tashlandi, uslub tanlash 2-bosqichga ko'chirildi. */}
          <p className="mt-3 rounded-xl bg-soft px-4 py-2.5 text-xs text-muted">
            Qayerga chiqadi: <strong className="text-ink">{targets.length ? targets.join(", ") : "1-bosqichda tarmoq tanlanmagan"}</strong>
          </p>

          {msg && (
            <div className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold ${msg.startsWith("✅") ? "bg-green/10 text-green" : msg.startsWith("⚠️") ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-600"}`}>{msg}</div>
          )}
        </div>
      </div>

      {/* ============ 4. NASHR ============ */}
      <div className={`${card} mt-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green/10 font-display text-lg font-extrabold text-green">4</span>
            <div className="min-w-0">
              <h3 className="font-display font-bold">Postni nashr etish</h3>
              <p className="mt-0.5 text-sm text-muted">
                Qayerga chiqadi: <strong className="text-ink">{targets.length ? targets.join(", ") : "tarmoq tanlanmagan"}</strong>
              </p>
              {!editingId && <p className="mt-0.5 text-sm text-muted">Avval 3-bosqichda saqlang</p>}
              {/* Ulanmagan tarmoq tanlangan bo'lsa oldindan ogohlantiramiz —
                  aks holda xato faqat joylash paytida chiqadi. */}
              {offline.length > 0 && (
                <p className="mt-1 text-sm font-semibold text-orange-600">
                  Ulanmagan: {offline.join(", ")} — bularga chiqmaydi
                </p>
              )}
            </div>
          </div>
          <button onClick={() => publish(editingId)} disabled={acting || !editingId}
            className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100">
            <Icon d={I.send} className="h-4 w-4" /> {acting ? "Joylanmoqda…" : "Tanlanganlarga joylash"}
          </button>
        </div>
      </div>

      {/* ============ SAQLANGAN POSTLAR ============ */}
      <div className={`${card} mt-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-bold">Saqlangan postlar</h3>
          <div className="flex flex-wrap gap-2">
            <span className="relative">
              <Icon d={I.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish…"
                className="w-44 rounded-xl border border-green/15 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-green" />
            </span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-green/15 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-green">
              <option value="all">Barchasi</option>
              <option value="pending_approval">Saqlangan</option>
              <option value="published">Joylandi</option>
              <option value="failed">Xato</option>
              <option value="draft">Qoralama</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="mt-4"><SkeletonCard /></div>
        ) : failed ? (
          <div className="mt-4"><ErrorState onRetry={load} message="Postlarni yuklab bo'lmadi." /></div>
        ) : filtered.length === 0 ? (
          <p className="mt-4 rounded-xl border border-green/10 py-10 text-center text-sm text-muted">
            {posts.length === 0 ? "Hali post yo'q." : "Mos post topilmadi."}
          </p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-green/10 text-left text-xs font-bold text-muted">
                    <th className="pb-3 pl-1 pr-3">ID</th>
                    <th className="pb-3 pr-3">Matn (qisqacha)</th>
                    <th className="pb-3 pr-3">Tarmoqlar</th>
                    <th className="pb-3 pr-3">Holat</th>
                    <th className="pb-3 pr-3">Yaratilgan</th>
                    <th className="pb-3 pr-1 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const st = STATUS[p.status] || STATUS.draft
                    return (
                      <tr key={p.id} className="border-b border-green/5 align-middle">
                        <td className="py-3 pl-1 pr-3">
                          <div className="flex items-center gap-2.5">
                            {p.image_url
                              ? <img src={p.image_url} alt="" className="h-10 w-12 shrink-0 rounded-lg object-cover" />
                              : <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-soft"><Icon d={I.doc} className="h-4 w-4 text-muted" /></span>}
                            <span className="font-mono text-xs font-bold text-muted">#{p.seq ?? "—"}</span>
                          </div>
                        </td>
                        <td className="max-w-[320px] py-3 pr-3">
                          <p className="line-clamp-2 text-ink/80">{p.title || p.content}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex gap-1.5">
                            {p.platforms.map((k) => <Brand key={k} k={k} className="h-4 w-4" />)}
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-3 pr-3 text-xs text-muted">{fmtDate(p.created_at)}</td>
                        <td className="py-3 pr-1">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => edit(p)} title="Tahrirlash" className={iconBtn}>
                              <Icon d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setPreview(p)} title="Ko'rish" className={iconBtn}>
                              <Icon d={I.eye} className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => publish(p.id)} disabled={acting || p.status === "published"} title="Joylash" className={iconBtn}>
                              <Icon d={I.send} className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => remove(p.id)} disabled={acting} title="O'chirish"
                              className="grid h-8 w-8 place-items-center rounded-lg border border-red-100 text-red-400 transition-colors hover:bg-red-50 disabled:opacity-40">
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

            {filtered.length > 5 && (
              <div className="mt-4 text-center">
                <button onClick={() => setShowAll((v) => !v)} className="inline-flex items-center gap-2 rounded-xl border border-green/15 px-5 py-2 text-sm font-bold text-muted transition-colors hover:border-green/40 hover:text-green">
                  {showAll ? "Kamroq ko'rsatish" : `Barchasini ko'rish (${filtered.length})`}
                  <Icon d={I.chevDown} className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Ko'rish oynasi */}
      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-muted">#{preview.seq ?? "—"}</span>
                {preview.ai_generated && <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-600">AI</span>}
                {preview.platforms.map((k) => <Brand key={k} k={k} className="h-4 w-4" />)}
              </div>
              <button onClick={() => setPreview(null)} className="text-muted hover:text-ink"><Icon d="M18 6L6 18 M6 6l12 12" className="h-5 w-5" /></button>
            </div>
            {preview.title && <h4 className="mt-3 font-display text-lg font-bold">{preview.title}</h4>}
            {preview.image_url && <img src={preview.image_url} alt="" className="mt-3 w-full rounded-xl object-cover" />}
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink/85">{preview.content}</p>
            {preview.hashtags && <p className="mt-2 text-sm text-green">{preview.hashtags}</p>}
            {(preview.results?.length ?? 0) > 0 && (
              <div className="mt-4 space-y-1 border-t border-green/10 pt-3">
                {preview.results!.map((r, i) => (
                  <div key={i} className={`text-xs ${r.success ? "text-green" : "text-red-600"}`}>
                    {r.success ? "✅" : "❌"} {r.platform}{r.error ? ` — ${r.error}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
