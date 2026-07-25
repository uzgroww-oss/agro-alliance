import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Icon, I, useBusy, ErrorState, SkeletonTable } from "../../lib/ui"
import MediaUpload from "../../components/MediaUpload"
import { fitForInstagram, isIgRatioOk, refitUploadedImage } from "../../lib/imageFit"
import { uploadFile } from "../../lib/upload"
import { extractVideoFrame } from "../../lib/videoFrame"
import { extractFrames, composeThumbnail, dataUrlToFile, THUMB_SIZES, type ThumbSize } from "../../lib/thumbnail"
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
  image_url: string | null; cover_url: string | null; platforms: string[]; status: string
  ai_generated: boolean; published_at: string | null; created_at: string
  results?: { platform: string; success: boolean; error?: string }[]
}
type SmmAnalysis = {
  holat: string
  kuchli?: string[]
  zaif?: string[]
  tavsiyalar: { mavzu: string; sabab: string; platforma: string; format: string }[]
  eng_yaxshi_vaqt: string
}
type SmmConn = { connected: boolean; display_name: string | null; via: string }

/** Tarmoqning haqiqiy holati — obunachi, o'rtacha layk va h.k. */
type NetworkStat = {
  platform: string; name: string
  followers: number | null; posts: number | null
  avgLikes: number | null; avgComments: number | null
  recent: { text: string; likes: number | null; comments: number | null; date: string }[]
  error?: string
}

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
  // Tarmoqdan qo'lda o'chirilgan — panel buni tekshiruvda aniqlaydi
  removed: { label: "O'chirilgan", cls: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
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

/* ---------------- Chat ---------------- */
type ChatMsg = { role: "user" | "ai"; content: string; at: string }

/** Bo'sh chatda ko'rinadigan tayyor savollar */
const QUICK_ASKS: { label: string; run?: "analyze" }[] = [
  { label: "Tarmoqlarimni tahlil qil", run: "analyze" },
  { label: "Qaysi vaqtda joylayin?" },
  { label: "Obunachini qanday ko'paytiraman?" },
]

const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/**
 * Suhbat pufakchasi.
 * AI chapda avatar bilan, foydalanuvchi o'ngda — haqiqiy chatlardagidek.
 * `wide` — tahlil natijasi uchun (ichida ro'yxat va tugmalar bo'ladi).
 */
function Bubble({
  side, children, at, wide = false,
}: {
  side: "ai" | "user"
  children: ReactNode
  at?: string
  wide?: boolean
}) {
  const isAi = side === "ai"
  return (
    <div className={`flex items-end gap-2 ${isAi ? "" : "flex-row-reverse"}`}>
      {isAi && (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green text-white">
          <Icon d={I.robot} className="h-4 w-4" />
        </span>
      )}
      <div className={`min-w-0 ${wide ? "max-w-full flex-1" : "max-w-[85%]"}`}>
        <div className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
          isAi ? "rounded-bl-sm bg-white text-ink shadow-sm" : "rounded-br-sm bg-green text-white"
        }`}>
          {children}
        </div>
        {at && <p className={`mt-1 text-[10px] text-muted ${isAi ? "" : "text-right"}`}>{at}</p>}
      </div>
    </div>
  )
}

export type SmmSeed = { topic: string; platform: string; format: string; at: number }

export default function SmmPanel({ seed }: {
  /** Marketing rejasidan kelgan mavzu — matn va rasm o'zi yaratiladi */
  seed?: SmmSeed | null
}) {
  const [posts, setPosts] = useState<SmmPost[]>([])
  const [conns, setConns] = useState<Record<string, SmmConn>>({})
  const [loading, setLoading] = useState(true)
  // Ulanishlar alohida kuzatiladi: yuklanguncha kartada "Ulanmagan"
  // deb turardi va bu yolg'on ma'lumot edi.
  const [connLoading, setConnLoading] = useState(true)
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
  const [networks, setNetworks] = useState<NetworkStat[]>([])
  const [analyzing, runAnalyze] = useBusy()
  const [aiErr, setAiErr] = useState("")

  /* AI maslahatchi — suhbat */
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [question, setQuestion] = useState("")
  const [asking, runAsk] = useBusy()
  const chatRef = useRef<HTMLDivElement>(null)

  /* 3-bosqich: forma */
  // thumb_url — video uchun MUQOVA. Video image_url'da qoladi, muqova
  // alohida saqlanadi. Ilgari muqova image_url ni almashtirar va video
  // yo'qolardi.
  const [form, setForm] = useState({ title: "", content: "", hashtags: "", image_url: "", thumb_url: "" })
  const [origin, setOrigin] = useState("telegram")
  const [aiMade, setAiMade] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, runSave] = useBusy()
  const [msg, setMsg] = useState("")
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  /* Rasm nisbati. Instagram 4:5 (0.8) dan 1.91:1 gacha qabul qiladi.
     Mos kelmasa foydalanuvchidan boshqa rasm so'ramaymiz — o'zimiz
     to'g'irlab qayta yuklaymiz. */
  const [fitting, setFitting] = useState(false)
  // Video yuklanishi ham mumkin — ko'rinishi va o'lcham to'g'irlash
  // rasmdan farq qiladi.
  const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(form.image_url)
  const [describing, runDescribe] = useBusy()
  const [syncing, runSync] = useBusy()
  const [fitErr, setFitErr] = useState("")
  // AI faylda nima ko'rganini yozadi. Buni ko'rsatamiz — shunda post
  // haqiqatan rasmga asoslanganini tekshirish mumkin.
  const [seenDesc, setSeenDesc] = useState("")
  const [seenTopic, setSeenTopic] = useState("")
  // Rasmni to'liq ekranda ko'rish — kichik ko'rinishda detallar bilinmaydi
  const [zoomImg, setZoomImg] = useState("")

  /* Video muqovasi (YouTube prevyusi kabi) */
  const [thumbSize, setThumbSize] = useState<ThumbSize>(THUMB_SIZES[0])
  const [thumbs, setThumbs] = useState<string[]>([])
  // Nechta muqova AI chizgan (boshidagi) — qolganlari videodan kadr
  const [aiThumbs, setAiThumbs] = useState(0)
  const [makingThumb, runThumb] = useBusy()
  const [thumbErr, setThumbErr] = useState("")
  // Video ovozidan olingan matn (transcript) — bir marta olinadi va
  // ham post yozishда, ham muqovada ishlatiladi. URL bilan birga
  // saqlanadi: boshqa video yuklansa qaytadan olinadi.
  const [transcript, setTranscript] = useState<{ url: string; text: string; error?: string } | null>(null)

  /* 2-karta: AI yozgan qoralama shu yerda turadi va foydalanuvchi
     uni ko'rib, keyin 3-kartaga o'tkazadi. Ilgari matn to'g'ridan-
     to'g'ri 3-kartaga tushib ketardi va nima o'zgarganini bilib
     bo'lmasdi. */
  const [draft, setDraft] = useState<{ sarlavha: string; matn: string; hashtaglar: string[] } | null>(null)
  const [genImg, setGenImg] = useState("")
  const [drawing, runDraw] = useBusy()
  const [drawErr, setDrawErr] = useState("")
  // Bir rasmni ikki marta to'g'irlamaslik uchun: qayta yuklangan rasm
  // yana onLoad chaqiradi va cheksiz halqa hosil bo'lishi mumkin.
  const fitDone = useRef<Set<string>>(new Set())

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

  /**
   * Postlar va ulanishlar BITTA so'rovda keladi.
   * Ilgari ikki alohida so'rov ketardi va har biri edge funksiyaning
   * sovuq ishga tushishini alohida kutardi — panel ikki barobar sekin
   * ochilardi.
   */
  const load = useCallback(() => {
    setLoading(true); setConnLoading(true); setFailed(false)
    api<{ posts: SmmPost[]; connections: Record<string, SmmConn> }>("/smm/posts?action=init")
      .then((d) => {
        setPosts(d.posts || [])
        setConns(d.connections || {})
      })
      .catch(() => setFailed(true))
      .finally(() => { setLoading(false); setConnLoading(false) })
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

  /**
   * Qayta ulash — tarmoqqa qarab usul har xil:
   *   Instagram — Facebook OAuth (igConnect)
   *   Telegram/Facebook — ulash formasini ochamiz (kalit qayta kiritiladi)
   */
  const reconnect = (p: Platform) => {
    setPickMsg("")
    if (p.key === "instagram") { igConnect(); return }
    setConnOpen(p.key)
  }

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
      // 3-kartaga EMAS, shu kartadagi qoralamaga yoziladi
      setDraft({
        sarlavha: d.generated.sarlavha || "",
        matn: d.generated.matn || "",
        hashtaglar: d.generated.hashtaglar || [],
      })
      setGenImg(""); setDrawErr("")
    } catch (e) { setAiErr(e instanceof Error ? e.message : "AI javob bermadi") }
  })

  /** Qoralamani tahrirlash kartasiga o'tkazish */
  const useDraft = () => {
    if (!draft) return
    setForm((f) => ({
      ...f,
      title: draft.sarlavha,
      content: draft.matn,
      hashtags: (draft.hashtaglar || []).join(" "),
      // Yaratilgan rasm bo'lsa u ham ketadi
      image_url: genImg || f.image_url,
    }))
    setAiMade(true)
    setEditingId(null)
    setDraft(null); setGenImg("")
    setMsg("")
  }

  /**
   * Qoralama matni asosida rasm chizdirish.
   * Server avval matndan inglizcha tasvir so'rovi yasaydi, keyin rasm
   * modeliga beradi — rasm modellari ingliz tilida ancha aniq ishlaydi.
   */
  /**
   * Matndan rasm chizdirish.
   *
   * @param text  qaysi matn asosida chizilsin
   * @param toForm  natija to'g'ridan-to'g'ri post rasmiga aylansinmi
   *
   * toForm kerak, chunki bu ikki joyda ishlatiladi: 2-kartadagi
   * qoralamada (u yerda natija alohida ko'rinadi) va 3-kartada
   * (u yerda darhol postning rasmi bo'lishi kerak).
   */
  const drawImage = (text: string, toForm: boolean) => runDraw(async () => {
    if (!text.trim()) { setDrawErr("Avval matn yozdiring"); return }
    setDrawErr(""); if (!toForm) setGenImg("")
    try {
      // Tanlangan tarmoqqa qarab nisbat: Instagram tik, qolgani keng
      const aspect = picked.has("instagram") && !picked.has("telegram") ? "4:5" : "16:9"
      const d = await api<{ image_b64: string; prompt: string }>("/smm/ai?action=image", {
        method: "POST",
        body: JSON.stringify({ text: text.slice(0, 1500), aspect }),
      })
      // Yuklab, doimiy manzil olamiz — base64 ni bazaga saqlab bo'lmaydi
      const file = dataUrlToFile(`data:image/jpeg;base64,${d.image_b64}`, "ai-rasm.jpg")
      const r = await uploadFile(file)
      if (toForm) {
        setForm((f) => ({ ...f, image_url: r.signedUrl }))
        setSeenDesc(""); setSeenTopic("")
      } else {
        setGenImg(r.signedUrl)
      }
    } catch (e) {
      setDrawErr(e instanceof Error ? e.message : "Rasm yaratilmadi")
    }
  })

  /** 3-kartadagi matn asosida rasm chizdirish */
  const drawForPost = () => drawImage([form.title, form.content].filter(Boolean).join(". "), true)

  /**
   * Marketing rejasidan kelgan mavzu bo'yicha hamma ishni bajarish:
   * matn yozish -> tahrirlash kartasiga qo'yish -> rasm chizish.
   *
   * Qoralama bosqichi o'tkazib yuboriladi: foydalanuvchi rejada
   * mavzuni allaqachon tanlagan, yana bir marta tasdiqlashi shart emas.
   */
  const [seedBusy, setSeedBusy] = useState(false)
  const [seedMsg, setSeedMsg] = useState("")
  const seedDone = useRef<number | null>(null)

  const runSeed = useCallback(async (sd: SmmSeed) => {
    setSeedBusy(true)
    setSeedMsg(`"${sd.topic}" — matn yozilmoqda…`)
    setAiErr(""); setDrawErr(""); setDraft(null)
    // Eski postni DARHOL tozalaymiz. Ilgari faqat javob kelgach
    // almashtirilardi — natijada yangi mavzu yozilayotganda ekranda
    // OLDINGI mavzu matni turardi va foydalanuvchi uni yangisi deb
    // o'ylardi. Yozish uzoq davom etsa yoki xato bo'lsa esa eski matn
    // butunlay qolib ketardi.
    setTopic(sd.topic)
    setEditingId(null)
    setAiMade(false)
    setForm({ title: "", content: "", hashtags: "", image_url: "", thumb_url: "" })
    try {
      const g = await api<{ generated: { sarlavha: string; matn: string; hashtaglar: string[] } }>(
        "/smm/ai?action=generate",
        { method: "POST", body: JSON.stringify({ topic: sd.topic, platform: sd.platform }) },
      )
      const text = g.generated.matn || ""
      setForm({
        title: g.generated.sarlavha || "",
        content: text,
        hashtags: (g.generated.hashtaglar || []).join(" "),
        image_url: "",
        thumb_url: "",
      })
      setAiMade(true)
      setEditingId(null)
      setTopic(sd.topic)

      // Matn asosida AI rasm chizadi. (Video generatsiyasi olib
      // tashlandi — bepul, ishonchli matndan-video AI amalda yo'q.
      // Video formatli post ham rasm oladi; video kerak bo'lsa
      // foydalanuvchi o'zi yuklaydi va muqova yasaydi.)
      setSeedMsg("Rasm chizilmoqda…")
      try {
        const aspect = sd.platform === "instagram" ? "4:5" : "16:9"
        const payload = JSON.stringify({
          text: [g.generated.sarlavha, text].filter(Boolean).join(". ").slice(0, 1500),
          aspect,
        })
        const d = await api<{ image_b64?: string; prompt?: string }>(
          "/smm/ai?action=image",
          { method: "POST", body: payload },
        )
        if (d.image_b64) {
          const file = dataUrlToFile(`data:image/jpeg;base64,${d.image_b64}`, "ai-rasm.jpg")
          const r = await uploadFile(file)
          setForm((f) => ({ ...f, image_url: r.signedUrl }))
          setSeedMsg("✅ Matn va rasm tayyor — tekshirib saqlang")
        } else {
          setSeedMsg("✅ Matn tayyor. Rasm chiqmadi — qo'lda yuklang")
        }
      } catch (e) {
        // Rasm chiqmasa ham matn qoladi — bu to'liq muvaffaqiyatsizlik emas
        setSeedMsg("✅ Matn tayyor. Rasm chiqmadi — qo'lda yuklang")
        setDrawErr(e instanceof Error ? e.message : "Rasm yaratilmadi")
      }
    } catch (e) {
      setSeedMsg("")
      setAiErr(e instanceof Error ? e.message : "Matn yozilmadi")
    } finally {
      setSeedBusy(false)
    }
  }, [])

  useEffect(() => {
    // at — bir xil mavzu qayta yuborilsa ham ishga tushsin,
    // lekin har renderda takrorlanmasin
    if (!seed || seedDone.current === seed.at) return
    seedDone.current = seed.at
    void runSeed(seed)
  }, [seed, runSeed])

  const analyze = () => runAnalyze(async () => {
    setAiErr("")
    try {
      const d = await api<{ analysis: SmmAnalysis; networks?: NetworkStat[] }>(
        "/smm/ai?action=analyze", { method: "POST", body: "{}" })
      setAnalysis(d.analysis)
      setNetworks(d.networks || [])
      scrollChat()
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

  /**
   * Yuklangan rasmni Instagram o'lchamiga keltirib qayta yuklash.
   * Eski postlarning rasmlari yuklash paytida to'g'irlanmagan bo'lishi
   * mumkin — shu yerda ushlanadi.
   */
  const autoFit = async (url: string) => {
    if (fitDone.current.has(url) || fitting) return
    fitDone.current.add(url)
    setFitting(true); setFitErr("")
    try {
      const newUrl = await refitUploadedImage(url, (f) => uploadFile(f))
      if (newUrl) {
        fitDone.current.add(newUrl)
        setForm((f) => ({ ...f, image_url: newUrl }))
      }
    } catch {
      // To'g'irlab bo'lmasa (masalan rasm boshqa domendan va CORS yopiq)
      // hech bo'lmasa nima qilish kerakligini aytamiz.
      setFitErr("Rasmni moslab bo'lmadi — kvadrat (1:1) rasm yuklang")
    } finally {
      setFitting(false)
    }
  }

  /** Suhbat oynasini pastga surish — yangi javob ko'rinib tursin */
  const scrollChat = () => {
    requestAnimationFrame(() => {
      const el = chatRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  /**
   * AI maslahatchiga savol. Tarix serverga yuboriladi — AI oldingi
   * javobini eslamaydi, kontekst har safar so'rov ichida ketishi kerak.
   */
  const ask = () => runAsk(async () => {
    const q = question.trim()
    if (!q) return
    setAiErr("")
    const next: ChatMsg[] = [...chat, { role: "user", content: q, at: nowTime() }]
    setChat(next)
    setQuestion("")
    scrollChat()
    try {
      const d = await api<{ answer: string }>("/smm/ai?action=chat", {
        method: "POST",
        body: JSON.stringify({ messages: next }),
      })
      setChat([...next, { role: "ai", content: d.answer, at: nowTime() }])
      scrollChat()
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "AI javob bermadi")
    }
  })

  /**
   * AI faylning O'ZINI ko'rib sarlavha, matn va teglarni yozadi.
   * Yuklangandan keyin avtomatik chaqiriladi — mavzu yozib o'tirish
   * shart emas.
   */
  /**
   * Videoning ovozini matnga aylantirib, keshda saqlaymiz. Bir marta
   * olinadi — describe ham, muqova ham shuni ishlatadi.
   */
  const ensureTranscript = async (videoUrl: string): Promise<string> => {
    if (transcript && transcript.url === videoUrl) return transcript.text
    try {
      const r = await api<{ transcript?: string; error?: string }>(
        "/smm/ai?action=transcribe",
        { method: "POST", body: JSON.stringify({ video_url: videoUrl }) },
      )
      const text = (r.transcript || "").trim()
      // Xatoni SAQLAYMIZ va ekranga chiqaramiz — ovoz nega o'qilmaganini
      // bilib olamiz (NVIDIA ASR ishlayaptimi yoki yo'qmi).
      setTranscript({ url: videoUrl, text, error: text ? undefined : (r.error || "Ovoz o'qilmadi") })
      return text
    } catch (e) {
      setTranscript({ url: videoUrl, text: "", error: e instanceof Error ? e.message : "Ovoz o'qilmadi" })
      return ""
    }
  }

  const describeUrl = (mediaUrl: string) => runDescribe(async () => {
    if (!mediaUrl) { setAiErr("Avval rasm yoki video yuklang"); return }
    setAiErr("")
    try {
      let payload: Record<string, unknown> = { image_url: mediaUrl, platform: effOrigin }
      if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(mediaUrl)) {
        // Video: AVVAL ovozini matnga aylantiramiz — postни videoda
        // AYNAN gapirilgani asosida yozamiz. Ovoz o'qilmasa (juda katta
        // yoki gap yo'q) — bitta kadrni yuborib, tasvirга tayanamiz.
        const spoken = await ensureTranscript(mediaUrl)
        if (spoken) {
          payload = { transcript: spoken, platform: effOrigin }
        } else {
          const frame = await extractVideoFrame(mediaUrl)
          payload = { image_b64: frame.data, mime: frame.mimeType, from_video: true, platform: effOrigin }
        }
      }
      const d = await api<{ generated: { sarlavha: string; matn: string; hashtaglar: string[]; tasvir?: string; mazmun?: string } }>(
        "/smm/ai?action=describe",
        { method: "POST", body: JSON.stringify(payload) },
      )
      setSeenDesc(d.generated.tasvir || "")
      setSeenTopic(d.generated.mazmun || "")
      setForm((f) => ({
        ...f,
        title: d.generated.sarlavha || f.title,
        content: d.generated.matn || f.content,
        hashtags: (d.generated.hashtaglar || []).join(" ") || f.hashtags,
      }))
      setAiMade(true)
    } catch (e) {
      setSeenDesc(""); setSeenTopic("")
      setAiErr(e instanceof Error ? e.message : "AI faylni o'qiy olmadi")
    }
  })
  const describe = () => describeUrl(form.image_url)

  /**
   * Videodan muqova variantlarini yasash.
   *
   * AI rasm CHIZMAYDI — muqova videoning haqiqiy kadridan yasaladi.
   * O'ylab topilgan rasm chiroyli bo'lsa ham videoga aloqasi bo'lmaydi
   * va odam bosganda aldangandek his qiladi.
   */
  const makeThumbs = (size: ThumbSize) => runThumb(async () => {
    setThumbErr(""); setThumbs([])
    if (!form.image_url) { setThumbErr("Avval video yuklang"); return }
    const aspect = size.key === "youtube" ? "16:9" : size.key === "instagram" ? "4:5" : "1:1"
    let title = (form.title || seenTopic || "").trim()
    const out: string[] = []
    try {
      // 1) Videodan bitta kadr olamiz — AI ko'ra olishi uchun zaxira
      const frame = await extractVideoFrame(form.image_url)

      // 2) Videoning ovozini matnga aylantiramiz — muqova videoда
      //    NIMA GAPIRILGANIga mos bo'lsin (bitta kadr buni bermaydi).
      const spoken = await ensureTranscript(form.image_url)

      // 3) AI shu mazmunga MOS 4 ta muqova rasmini chizadi va toza
      //    o'zbekcha sarlavha beradi. Xom kadr emas — videoga mos
      //    generatsiya.
      let aiCount = 0
      try {
        const c = await api<{ images?: string[]; image_b64?: string; title?: string; vision_failed?: boolean; error?: string }>(
          "/smm/ai?action=cover",
          { method: "POST", body: JSON.stringify({ image_b64: frame.data, mime: frame.mimeType, aspect, transcript: spoken }) },
        )
        const imgs = c.images && c.images.length ? c.images : (c.image_b64 ? [c.image_b64] : [])
        if (c.title) title = c.title
        for (const b of imgs) out.push(await composeThumbnail(`data:image/jpeg;base64,${b}`, title, size))
        aiCount = imgs.length
      } catch { /* AI muqova chiqmasa pastda xom kadrlarga tayanamiz */ }

      // AI to'liq 4 ta bermasa — videoning HAQIQIY kadrlaridan
      // to'ldiramiz (4 taga yetkazamiz).
      if (aiCount < 4) {
        try {
          const frames = await extractFrames(form.image_url, 4 - aiCount)
          for (const f of frames) out.push(await composeThumbnail(f, title, size))
        } catch { /* kadr olinmasa AI muqova bo'lsa yetadi */ }
      }

      if (!out.length) { setThumbErr("Muqova yasab bo'lmadi — videoni tekshiring"); return }
      setAiThumbs(aiCount)
      setThumbs(out)
    } catch (e) {
      setThumbErr(e instanceof Error ? e.message : "Muqova yasab bo'lmadi")
    }
  })

  /**
   * Tanlangan muqovani yuklab, VIDEO MUQOVASI qilib qo'yish.
   *
   * MUHIM: image_url (video) DAHLSIZ qoladi — muqova thumb_url ga
   * yoziladi. Ilgari muqova image_url ni almashtirar, video yo'qolib
   * o'rniga rasm joylanardi. Endi video + muqova birga joylanadi:
   * Instagram REELS uchun cover, YouTube uchun thumbnail.
   */
  const applyThumb = (dataUrl: string) => runThumb(async () => {
    setThumbErr("")
    try {
      const file = dataUrlToFile(dataUrl, `muqova-${thumbSize.key}.jpg`)
      const r = await uploadFile(file)
      setForm((f) => ({ ...f, thumb_url: r.signedUrl }))
      setThumbs([])
      setMsg("✅ Muqova tayyor — video shu muqova bilan joylanadi")
    } catch (e) {
      setThumbErr(e instanceof Error ? e.message : "Muqovani yuklab bo'lmadi")
    }
  })

  /* Joylangan postlar tarmoqda hali turibdimi */
  const sync = () => runSync(async () => {
    setMsg("")
    try {
      const r = await api<{ checked: number; removed: number }>("/smm/posts?action=sync", { method: "POST", body: "{}" })
      setMsg(r.removed
        ? `⚠️ ${r.removed} ta post tarmoqdan o'chirilgan`
        : `✅ Tekshirildi (${r.checked} ta) — hammasi joyida`)
      load()
    } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Xatolik"}`) }
  })

  const save = () => runSave(async () => {
    setMsg("")
    if (!form.content.trim()) { setMsg("❌ Post matni bo'sh"); return }
    if (picked.size === 0) { setMsg("❌ Kamida bitta tarmoq tanlang"); return }
    try {
      // Muqova (thumb_url) backendда cover_url deb saqlanadi
      if (editingId) {
        await api(`/smm/posts/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...form, cover_url: form.thumb_url || null, platforms: Array.from(picked) }),
        })
        setMsg("✅ Yangilandi")
      } else {
        const r = await api<{ id: string }>("/smm/posts", {
          method: "POST",
          body: JSON.stringify({ ...form, cover_url: form.thumb_url || null, platforms: Array.from(picked), ai_generated: aiMade }),
        })
        setEditingId(r.id)
        setMsg("✅ Saqlandi — endi joylashingiz mumkin")
      }
      load()
    } catch (e) {
      const why = e instanceof Error ? e.message : "Xatolik"
      // MUHIM: javob kechiksa ham server ishni bajargan bo'lishi mumkin.
      // Ro'yxatni yangilaymiz — post saqlangan bo'lsa ko'rinadi va
      // foydalanuvchi uni ikkinchi marta saqlamaydi.
      if (/vaqti tugadi/i.test(why)) {
        setMsg("⚠️ Javob kechikdi — pastdagi ro'yxatni tekshiring")
        load()
      } else {
        setMsg(`❌ ${why}`)
      }
    }
  })

  const clearForm = () => {
    setForm({ title: "", content: "", hashtags: "", image_url: "", thumb_url: "" })
    setEditingId(null); setAiMade(false); setMsg("")
  }

  /* ---------------- 4-bosqich ---------------- */
  /**
   * @param overridePlatforms 4-bosqichdan joylashda HOZIRGI tanlov
   *   yuboriladi. Jadvaldan joylashda esa postning o'z ro'yxati
   *   ishlatiladi (undefined qoladi).
   */
  const publish = (id: string | null, overridePlatforms?: string[]) => runAct(async () => {
    if (!id) { setMsg("❌ Avval postni saqlang"); return }
    try {
      const r = await api<{ success: boolean; results: { platform: string; success: boolean; error?: string }[] }>(
        `/smm/posts/${id}?action=publish`,
        { method: "POST", body: JSON.stringify(overridePlatforms ? { platforms: overridePlatforms } : {}) })
      const bad = r.results.filter((x) => !x.success)
      setMsg(r.success
        ? (bad.length ? `⚠️ Qisman joylandi — ${bad.map((b) => `${b.platform}: ${b.error}`).join("; ")}` : "✅ Joylandi")
        : `❌ ${bad.map((b) => `${b.platform}: ${b.error}`).join("; ")}`)
      if (r.success && !bad.length) clearForm()
      load()
    } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Xatolik"}`) }
  })

  /**
   * O'chirish. published bo'lsa tarmoqlardan ham o'chirishni taklif
   * qilamiz — aks holda panelda yo'q, tarmoqda bor holat qoladi.
   */
  const remove = (p: SmmPost) => runAct(async () => {
    const wasPublished = p.status === "published" || p.status === "removed"
    let scope = ""
    if (wasPublished) {
      const alsoRemote = window.confirm(
        "Tarmoqlardan ham o'chirilsinmi?\n\nOK — tarmoqlardan ham o'chadi\nBekor qilish — faqat shu ro'yxatdan o'chadi",
      )
      if (alsoRemote) scope = "?scope=all"
    } else if (!window.confirm("Post o'chirilsinmi?")) {
      return
    }

    try {
      const r = await api<{ remote?: { platform: string; success: boolean; error?: string }[] }>(
        `/smm/posts/${p.id}${scope}`, { method: "DELETE" })
      // Instagram backend'da o'tkazib yuboriladi — bu yerda faqat
      // haqiqiy natijalar keladi.
      const realBad = (r.remote || []).filter((x) => !x.success)
      if (realBad.length) {
        setMsg(`⚠️ Post o'chirildi, lekin: ${realBad.map((b) => `${b.platform} — ${b.error}`).join("; ")}`)
      } else if (scope) {
        setMsg("✅ Ro'yxatdan va tarmoqlardan o'chirildi")
      } else {
        setMsg("✅ O'chirildi")
      }
    } catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : "Xatolik"}`) }
    if (editingId === p.id) clearForm()
    load()
  })

  const edit = (p: SmmPost) => {
    setForm({ title: p.title || "", content: p.content, hashtags: p.hashtags || "", image_url: p.image_url || "", thumb_url: p.cover_url || "" })
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
          <button onClick={savePick} disabled={connLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-green/25 px-4 py-2 text-sm font-bold text-green transition-colors hover:bg-green/5 disabled:opacity-40">
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
              // Karta div — ichida kichik tugmalar bo'lgani uchun (button
              // ichida button bo'lmasligi kerak). Bosilganda tanlanadi.
              <div key={p.key} onClick={() => { if (!connLoading) toggle(p) }} role="button" tabIndex={0}
                onKeyDown={(e) => { if (!connLoading && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(p) } }}
                className={`group relative flex items-center gap-3 rounded-2xl border-2 p-4 pr-11 text-left transition-colors ${connLoading ? "cursor-wait" : "cursor-pointer"} ${sel ? "border-green bg-green/5" : "border-green/10 hover:border-green/30"}`}>
                <Brand k={p.key} className="h-9 w-9 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-bold">{p.label}</span>
                  {connLoading ? (
                    // Holat noma'lum ekan "Ulanmagan" deb yozish yolg'on
                    // bo'lardi — kutish belgisi ko'rsatamiz.
                    <span className="mt-1 block h-[18px] w-20 animate-pulse rounded-md bg-gray-100" />
                  ) : (
                    <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${on ? "bg-green/10 text-green" : "bg-gray-100 text-gray-500"}`}>
                      {on ? "Ulangan" : "Ulanmagan"}
                    </span>
                  )}
                  {connLoading ? (
                    <span className="mt-1 block h-3 w-24 animate-pulse rounded bg-gray-100" />
                  ) : on ? (
                    <span className="mt-1 block truncate text-xs text-muted" title={acctName(p.key) || ""}>
                      {acctName(p.key) || "hisob nomi noma'lum"}
                    </span>
                  ) : null}
                </span>

                {/* Ulangan kartada: qayta ulash (aylana strelka) va uzish.
                    Faqat shu tarmoqqa tegishli — pastdagi umumiy tugmalar
                    qatori olib tashlandi. */}
                {/* Belgilash katakchasi — doim o'ng yuqorida, qat'iy joyda */}
                <span className={`absolute right-3 top-4 grid h-5 w-5 shrink-0 place-items-center rounded border-2 ${sel ? "border-green bg-green text-white" : "border-gray-300"}`}>
                  {sel && <Icon d={I.check} className="h-3 w-3" />}
                </span>

                {/* Amal ikonkalari faqat sichqoncha ustiga kelganda.
                    Doim ko'rinsa karta tiqilib qoladi — mockup'da ular yo'q,
                    lekin funksiya kerak, shuning uchun yashirin turadi. */}
                {on && !connLoading && (
                  <span className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <span role="button" tabIndex={0} title="Qayta ulash"
                      onClick={(e) => { e.stopPropagation(); reconnect(p) }}
                      className={`grid h-6 w-6 place-items-center rounded-lg bg-white/90 text-muted shadow-sm transition-colors hover:text-green ${connBusy ? "pointer-events-none opacity-50" : ""}`}>
                      <Icon d={I.refresh} className={`h-3 w-3 ${connBusy ? "animate-spin" : ""}`} />
                    </span>
                    {p.key !== "instagram" && (
                      <span role="button" tabIndex={0} title="Uzish"
                        onClick={(e) => { e.stopPropagation(); disconnect(p.key) }}
                        className="grid h-6 w-6 place-items-center rounded-lg bg-white/90 text-red-400 shadow-sm transition-colors hover:text-red-500">
                        <Icon d="M18 6L6 18 M6 6l12 12" className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                )}
              </div>
            )
          })}
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

      {/* ============ 2 + 3 + AI (uch ustun) ============ */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.5fr_1.1fr]">
        {/* ---- 2. KONTENT YARATISH ---- */}
        <div className={card}>
          <h3 className="font-display font-bold">2. Kontent yaratish</h3>
          <p className="mt-0.5 text-sm text-muted">Mavzu yozing — AI tayyor post qaytaradi</p>

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

          {aiErr && <div className="mt-3 max-h-32 overflow-y-auto rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">{aiErr}</div>}

          {/* AI yozgan qoralama SHU KARTADA turadi. Ilgari u to'g'ridan-
              to'g'ri 3-kartaga tushib ketardi va nima yozilganini
              ko'rmasdan qabul qilishga to'g'ri kelardi. */}
          {draft ? (
            <div className="mt-4 rounded-xl border border-green/20 bg-green/5 p-4">
              <div className="flex items-center gap-2">
                <Icon d={I.robot} className="h-4 w-4 shrink-0 text-green" />
                <span className="text-xs font-bold text-green">AI yozdi</span>
              </div>

              {draft.sarlavha && <p className="mt-2 font-display font-bold">{draft.sarlavha}</p>}
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink/85">{draft.matn}</p>
              {draft.hashtaglar?.length > 0 && (
                <p className="mt-2 text-xs text-green">{draft.hashtaglar.join(" ")}</p>
              )}

              {/* Matn asosida rasm chizish */}
              {genImg ? (
                <div className="mt-3">
                  <img src={genImg} alt="" title="Kattalashtirish uchun bosing"
                    onClick={() => setZoomImg(genImg)}
                    className="w-full cursor-zoom-in rounded-lg transition-opacity hover:opacity-90" />
                  <button type="button" onClick={() => drawImage([draft.sarlavha, draft.matn].filter(Boolean).join(". "), false)} disabled={drawing}
                    className="mt-1.5 text-xs font-bold text-muted hover:text-green disabled:opacity-50">
                    Boshqa rasm chiz
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => drawImage([draft.sarlavha, draft.matn].filter(Boolean).join(". "), false)} disabled={drawing}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-green/25 bg-white px-4 py-2 text-xs font-bold text-green transition-colors hover:bg-green/5 disabled:opacity-60">
                  <Icon d={drawing ? I.refresh : I.media} className={`h-3.5 w-3.5 ${drawing ? "animate-spin" : ""}`} />
                  {drawing ? "Rasm chizilmoqda…" : "Shu matnga rasm chizdir"}
                </button>
              )}

              {drawErr && (
                <p className="mt-2 max-h-24 overflow-y-auto rounded-lg bg-orange-50 px-3 py-2 text-[11px] font-semibold text-orange-700">{drawErr}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={useDraft}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-green px-4 py-2 text-xs font-bold text-white">
                  <Icon d={I.check} className="h-3.5 w-3.5" /> Tahrirlashga o'tkazish
                </button>
                <button type="button" onClick={() => generate()} disabled={generating}
                  className="rounded-xl border border-green/20 px-3 py-2 text-xs font-bold text-muted hover:text-green disabled:opacity-50">
                  Qaytadan
                </button>
                <button type="button" onClick={() => { setDraft(null); setGenImg(""); setDrawErr("") }}
                  className="rounded-xl px-2 py-2 text-xs font-bold text-red-400 hover:text-red-500">
                  Bekor
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-3 rounded-xl bg-green/5 p-4">
              <Icon d={I.robot} className="mt-0.5 h-5 w-5 shrink-0 text-green" />
              <p className="text-sm text-ink/75">
                Mavzu yozing — AI o'zbek tilida, fermerlar uchun tayyor post yozib beradi.
                Nima yozishni bilmasangiz o'ngdagi <strong>AI maslahatchi</strong> bilan gaplashing.
              </p>
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
                <Icon d={I.check} className="h-4 w-4" /> {saving ? "Saqlanmoqda…" : editingId ? "Yangilash" : "Faylni saqlash"}
              </button>
            </div>
          </div>

          {/* Marketing rejasidan kelganda jarayon ko'rinib tursin */}
          {(seedBusy || seedMsg) && (
            <div className={`mt-3 flex items-start gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
              seedBusy ? "bg-green/10 text-green" : seedMsg.startsWith("✅") ? "bg-green/10 text-green" : "bg-soft text-muted"
            }`}>
              {seedBusy && <Icon d={I.refresh} className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />}
              {/* Xato sababi uzun bo'lishi mumkin — kesilmasin, o'ralsin */}
              <span className="min-w-0 flex-1 break-words">{seedMsg}</span>
              {!seedBusy && (
                <button onClick={() => setSeedMsg("")} className="shrink-0 opacity-60 hover:opacity-100">
                  <Icon d="M18 6L6 18 M6 6l12 12" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

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

            {/* Rasm yoki video */}
            <div className="min-w-0">
              <span className="text-xs font-semibold text-muted">Rasm yoki video (ixtiyoriy)</span>
              <p className="mt-0.5 text-[11px] text-muted">
                Rasm yuklasangiz AI uni ko'rib postni o'zi yozadi. Video
                yuklasangiz "Muqova tayyorlash" tugmasini bosing.
                Rasm 20 MB, video 100 MB gacha.
              </p>
              <div className="mt-1.5">
                {form.image_url ? (
                  <div className="rounded-xl border border-green/15 bg-soft p-3">
                    {isVideo ? (
                      // Videoga o'lcham to'g'irlash qo'llanmaydi — canvas
                      // orqali o'tkazish videoni buzadi.
                      <>
                        <video src={form.image_url} controls className="h-32 w-full rounded-lg bg-black object-contain" />
                        {/* Ovoz o'qilmasa xabar beramiz (matn kadrga qarab
                            yoziladi). Muvaffaqiyatda ortiqcha narsa
                            ko'rsatmaymiz — post va muqova o'zi chiqadi. */}
                        {transcript?.url === form.image_url && !transcript.text && transcript.error && (
                          <p className="mt-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold text-orange-700">
                            🎙️ Ovoz o'qilmadi: {transcript.error} — matn kadrga qarab yozildi
                          </p>
                        )}
                      </>
                    ) : (
                      <img src={form.image_url} alt="" title="Kattalashtirish uchun bosing"
                        onClick={() => setZoomImg(form.image_url)}
                        className="h-32 w-full cursor-zoom-in rounded-lg object-contain transition-opacity hover:opacity-90"
                        onLoad={(e) => {
                          const el = e.currentTarget
                          const r = el.naturalHeight ? el.naturalWidth / el.naturalHeight : 0
                          // Mos kelmasa DARHOL to'g'irlaymiz — foydalanuvchidan
                          // boshqa rasm so'ramaymiz.
                          if (r && !isIgRatioOk(r)) autoFit(el.src)
                        }}
                        onError={() => setFitErr("")} />
                    )}
                    {fitting && (
                      <p className="mt-2 flex items-center gap-2 rounded-lg bg-green/10 px-3 py-2 text-xs font-semibold text-green">
                        <Icon d={I.refresh} className="h-3.5 w-3.5 animate-spin" /> Rasm o'lchami moslanmoqda…
                      </p>
                    )}
                    {describing && (
                      <p className="mt-2 flex items-center gap-2 rounded-lg bg-green/10 px-3 py-2 text-xs font-semibold text-green">
                        <Icon d={I.refresh} className="h-3.5 w-3.5 animate-spin" /> AI {isVideo ? "videoni" : "rasmni"} ko'ryapti…
                      </p>
                    )}
                    {fitErr && (
                      <p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">{fitErr}</p>
                    )}
                    {seenDesc && (
                      <div className="mt-2 rounded-lg bg-green/5 px-3 py-2">
                        <p className="text-xs text-ink/75">
                          <strong className="text-green">AI ko'rdi:</strong> {seenDesc}
                        </p>
                      </div>
                    )}
                    {/* AI matn yozdirish: RASM uchun avtomatik ishlagan,
                        bu qayta yozdirish. VIDEO uchun avtomatik EMAS —
                        foydalanuvchi xohlasa bosadi. */}
                    <button type="button" onClick={describe} disabled={describing || fitting}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-green/25 px-4 py-2 text-xs font-bold text-green transition-colors hover:bg-green/5 disabled:opacity-60">
                      <Icon d={I.refresh} className="h-3.5 w-3.5" />
                      {isVideo ? "AI videoni ko'rib matn yozsin" : "Qaytadan yozdirish"}
                    </button>

                    {/* ---- Video muqovasi (YouTube prevyusi kabi) ---- */}
                    {isVideo && (
                      <div className="mt-3 rounded-xl border border-green/15 bg-white p-3">
                        <p className="text-xs font-bold text-ink">Muqova (video ustidagi rasm)</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          AI videoni ko'rib, mazmuniga MOS muqova chizadi.
                          Instagramga shu muqova bilan chiqadi.
                        </p>

                        {/* Tanlangan muqova — bosib kattalashtirish mumkin */}
                        {form.thumb_url && (
                          <div className="mt-2">
                            <img src={form.thumb_url} alt="Tanlangan muqova" title="Kattalashtirish uchun bosing"
                              onClick={() => setZoomImg(form.thumb_url)}
                              className="w-full cursor-zoom-in rounded-lg border-2 border-green object-contain transition-opacity hover:opacity-90" />
                            <p className="mt-1 text-[11px] font-semibold text-green">✅ Shu muqova ishlatiladi — kattalashtirish uchun bosing</p>
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {THUMB_SIZES.map((sz) => (
                            <button key={sz.key} type="button"
                              onClick={() => { setThumbSize(sz); makeThumbs(sz) }}
                              disabled={makingThumb}
                              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                                thumbSize.key === sz.key ? "bg-green text-white" : "border border-green/20 text-muted hover:border-green/50"
                              }`}>
                              {sz.label}
                            </button>
                          ))}
                        </div>

                        <button type="button" onClick={() => makeThumbs(thumbSize)} disabled={makingThumb}
                          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                          <Icon d={makingThumb ? I.refresh : I.media} className={`h-3.5 w-3.5 ${makingThumb ? "animate-spin" : ""}`} />
                          {makingThumb ? "Muqova yasalmoqda…" : form.thumb_url ? "Boshqa muqova tayyorlash" : "Muqova tayyorlash"}
                        </button>

                        {thumbErr && (
                          <p className="mt-2 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold text-orange-700">{thumbErr}</p>
                        )}

                        {thumbs.length > 0 && (
                          <>
                            <p className="mt-2 text-[11px] text-muted">
                              Birini tanlang. "AI" belgililari — AI chizgan muqova, qolganlari videodan kadr.
                            </p>
                            <div className="mt-1.5 grid grid-cols-2 gap-2">
                              {thumbs.map((t, i) => (
                                <div key={i} className="group relative overflow-hidden rounded-lg border-2 border-transparent transition-colors hover:border-green">
                                  <button type="button" onClick={() => applyThumb(t)} disabled={makingThumb}
                                    className="block w-full disabled:opacity-50">
                                    <img src={t} alt={`Muqova ${i + 1}`} className="block w-full" />
                                  </button>
                                  {i < aiThumbs && (
                                    <span className="absolute left-1 top-1 rounded bg-green px-1.5 py-0.5 text-[9px] font-bold text-white">AI</span>
                                  )}
                                  {/* Kattalashtirish — tanlashga xalaqit bermasin */}
                                  <button type="button" onClick={() => setZoomImg(t)} title="Kattalashtirish"
                                    className="absolute right-1 top-1 rounded-md bg-black/55 p-1 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100">
                                    <Icon d={I.search} className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <button type="button" onClick={() => { setForm((f) => ({ ...f, image_url: "", thumb_url: "" })); setFitErr(""); setSeenDesc(""); setSeenTopic(""); setThumbs([]); setThumbErr(""); setTranscript(null) }} className="mt-2 text-xs font-bold text-red-500 hover:underline">Olib tashlash</button>
                  </div>
                ) : (
                  // Ikki yo'l: fayl yuklash yoki matndan AI chizdirish.
                  // Ilgari chizish faqat 2-kartadagi qoralamada bor edi va
                  // "Tahrirlashga o'tkazish" bosilgach yo'qolib qolardi.
                  <div className="rounded-xl border border-green/15 bg-soft p-3">
                    <MediaUpload accept="image/*,video/*"
                      variant="box"
                      hint="JPG, PNG, WebP, MP4 · rasm 20 MB, video 100 MB"
                      transform={fitForInstagram}
                      onUpload={(r) => {
                        setForm((f) => ({ ...f, image_url: r.signedUrl, thumb_url: "" }))
                        setTranscript(null) // yangi fayl — eski matn yaramaydi
                        // RASM yuklansa AI o'zi ko'rib yozadi. VIDEO esa
                        // avtomatik ko'rilmaydi — foydalanuvchi tugma bilan
                        // muqova tayyorlaydi (video AI uchun og'ir va
                        // ko'pincha keraksiz).
                        if (!/\.(mp4|mov|webm|m4v)(\?|$)/i.test(r.signedUrl)) {
                          describeUrl(r.signedUrl)
                        }
                      }} />

                    <div className="my-3 flex items-center gap-2">
                      <span className="h-px flex-1 bg-green/15" />
                      <span className="text-[11px] font-bold text-muted">yoki</span>
                      <span className="h-px flex-1 bg-green/15" />
                    </div>

                    <button type="button" onClick={drawForPost}
                      disabled={drawing || !form.content.trim()}
                      title={form.content.trim() ? "" : "Avval post matnini yozing"}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green px-4 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                      <Icon d={drawing ? I.refresh : I.media} className={`h-4 w-4 ${drawing ? "animate-spin" : ""}`} />
                      {drawing ? "Rasm chizilmoqda…" : "Shu matnga AI rasm chizsin"}
                    </button>

                    {drawErr && (
                      <p className="mt-2 max-h-24 overflow-y-auto rounded-lg bg-orange-50 px-3 py-2 text-[11px] font-semibold text-orange-700">{drawErr}</p>
                    )}

                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <span className="text-xs font-semibold text-muted"># Teglar (ixtiyoriy)</span>
              <input value={form.hashtags} onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))}
                placeholder="#teg1, #teg2, …"
                className="mt-1.5 w-full rounded-xl border border-green/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-green" />
            </div>

            {/* MUHIM: bu MANZIL emas, USLUB.
                Mockup'da bu joyda "Original tarmoq" turadi, lekin o'sha nom
                post qayerga chiqishini belgilaydi deb tushunilardi va
                Instagram tanlansa post Telegram'ga ketardi. Nomi
                "AI uslubi" ga o'zgartirildi va ro'yxat faqat 1-bosqichda
                TANLANGAN tarmoqlardan iborat — bu yerdan manzil tanlab
                bo'lmaydi. */}
            {picked.size > 1 && (
              <div>
                <span className="text-xs font-semibold text-muted">AI uslubi</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Array.from(picked).map((k) => (
                    <button key={k} type="button" onClick={() => setOrigin(k)}
                      className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${effOrigin === k ? "bg-green text-white" : "border border-green/15 text-muted hover:border-green/40"}`}>
                      {PLATFORMS.find((p) => p.key === k)?.label ?? k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 rounded-xl bg-soft px-4 py-2.5 text-xs text-muted">
            Qayerga chiqadi: <strong className="text-ink">{targets.length ? targets.join(", ") : "1-bosqichda tarmoq tanlanmagan"}</strong>
          </p>

          {msg && (
            <div className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold ${msg.startsWith("✅") ? "bg-green/10 text-green" : msg.startsWith("⚠️") ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-600"}`}>{msg}</div>
          )}
        </div>
        {/* ============ AI MASLAHATCHI (chat) ============ */}
        {/* Alohida karta: tahlil kontent yozishdan boshqa ish. Ilgari u
            2-karta ichida edi va ikkalasi aralashib ketardi. */}
        <div className={`${card} flex flex-col p-0`}>
          {/* ---- Chat sarlavhasi: bot avatari + holat ---- */}
          <div className="flex items-center gap-3 border-b border-green/10 px-5 py-4">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green text-white">
              <Icon d={I.robot} className="h-5 w-5" />
              {/* Yashil nuqta — bot tayyor ekanini bildiradi */}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-400" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-display font-bold">AI maslahatchi</h3>
              <p className="text-xs text-muted">{asking || analyzing ? "yozmoqda…" : "onlayn"}</p>
            </div>
            {(chat.length > 0 || analysis) && (
              <button onClick={() => { setChat([]); setAnalysis(null); setNetworks([]); setAiErr("") }}
                title="Suhbatni tozalash"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-soft hover:text-ink">
                <Icon d="M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6" className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* ---- Xabarlar oqimi ---- */}
          <div ref={chatRef} className="min-h-[300px] flex-1 space-y-4 overflow-y-auto bg-soft px-4 py-4"
            style={{ maxHeight: "min(60vh, 520px)" }}>

            {/* Bot birinchi bo'lib salomlashadi — bo'sh ekran chatga
                o'xshamaydi. */}
            <Bubble side="ai">
              Salom! Men Agro Alliance SMM maslahatchisiman.
              Tarmoqlaringizdagi raqamlarni ko'rib, nima qilish kerakligini aytaman.
            </Bubble>

            {chat.length === 0 && !analysis && !analyzing && (
              <div className="ml-10 flex flex-wrap gap-1.5">
                {QUICK_ASKS.map((q) => (
                  <button key={q.label} type="button"
                    onClick={() => { if (q.run === "analyze") analyze(); else setQuestion(q.label) }}
                    className="rounded-full border border-green/25 bg-white px-3 py-1.5 text-xs font-semibold text-green transition-colors hover:bg-green hover:text-white">
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            {/* Tahlil natijasi — bot xabari sifatida */}
            {analysis && (
              <Bubble side="ai" wide>
                <p className="text-sm">{analysis.holat}</p>

                {networks.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {networks.map((n) => (
                      <div key={n.platform} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-soft px-2.5 py-2">
                        <Brand k={n.platform} className="h-4 w-4 shrink-0" />
                        <span className="truncate text-xs font-semibold">{n.name}</span>
                        {n.error ? (
                          <span className="text-xs text-red-600">{n.error}</span>
                        ) : (
                          <span className="flex flex-wrap gap-x-2.5 text-[11px] text-muted">
                            {n.followers !== null && <span><strong className="text-ink">{n.followers.toLocaleString("uz")}</strong> obunachi</span>}
                            {n.avgLikes !== null && <span><strong className="text-ink">{n.avgLikes}</strong> layk</span>}
                            {n.avgComments !== null && <span><strong className="text-ink">{n.avgComments}</strong> izoh</span>}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(analysis.kuchli?.length || analysis.zaif?.length) ? (
                  <div className="mt-3 space-y-2">
                    {analysis.kuchli?.length ? (
                      <div className="rounded-lg bg-green/5 p-2.5">
                        <p className="text-[11px] font-bold text-green">Kuchli tomonlar</p>
                        <ul className="mt-1 space-y-0.5">
                          {analysis.kuchli.map((k, i) => <li key={i} className="text-xs text-ink/80">• {k}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {analysis.zaif?.length ? (
                      <div className="rounded-lg bg-orange-50 p-2.5">
                        <p className="text-[11px] font-bold text-orange-700">Zaif tomonlar</p>
                        <ul className="mt-1 space-y-0.5">
                          {analysis.zaif.map((z, i) => <li key={i} className="text-xs text-ink/80">• {z}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {(analysis.tavsiyalar || []).length > 0 && (
                  <>
                    <p className="mt-3 text-[11px] font-bold text-muted">Bosing — shu mavzuda post yozaman</p>
                    <div className="mt-1.5 space-y-1.5">
                      {analysis.tavsiyalar.map((t, i) => (
                        <button key={i} type="button" onClick={() => { setTopic(t.mavzu); generate(t.mavzu) }} disabled={generating}
                          className="flex w-full items-start gap-2 rounded-lg border border-green/15 p-2 text-left transition-colors hover:border-green hover:bg-green/5 disabled:opacity-50">
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold">{t.mavzu}</span>
                            <span className="mt-0.5 block text-[11px] text-muted">{t.sabab}</span>
                          </span>
                          <span className="shrink-0 rounded bg-green/10 px-1.5 py-0.5 text-[10px] font-bold text-green">{t.format}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {analysis.eng_yaxshi_vaqt && (
                  <p className="mt-2 text-[11px] text-muted">🕐 Eng yaxshi vaqt: {analysis.eng_yaxshi_vaqt}</p>
                )}
              </Bubble>
            )}

            {chat.map((m, i) => (
              <Bubble key={i} side={m.role} at={m.at}>{m.content}</Bubble>
            ))}

            {/* Yozmoqda — uchta sakrayotgan nuqta, haqiqiy chatlardagidek */}
            {(asking || analyzing) && (
              <div className="flex items-end gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green text-white">
                  <Icon d={I.robot} className="h-4 w-4" />
                </span>
                <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-green/60"
                      style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              </div>
            )}
          </div>

          {aiErr && (
            <div className="max-h-32 overflow-y-auto border-t border-red-100 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">{aiErr}</div>
          )}

          {/* ---- Yozish maydoni ---- */}
          <div className="border-t border-green/10 px-4 py-3">
            <div className="flex items-center gap-2 rounded-full border border-green/20 bg-white py-1 pl-4 pr-1 focus-within:border-green">
              <input value={question} onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask() } }}
                placeholder="Xabar yozing…"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
              <button onClick={ask} disabled={asking || !question.trim()} title="Yuborish"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green text-white transition-opacity hover:opacity-90 disabled:opacity-30">
                <Icon d={I.send} className="h-4 w-4" />
              </button>
            </div>
            <button onClick={analyze} disabled={analyzing}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-green disabled:opacity-50">
              <Icon d={I.brain} className="h-3.5 w-3.5" />
              {analyzing ? "Tahlil qilinmoqda…" : analysis ? "Qayta tahlil qilish" : "Tarmoqlarni tahlil qilish"}
            </button>
          </div>
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
          <button onClick={() => publish(editingId, Array.from(picked))} disabled={acting || !editingId}
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
            {/* Tarmoqdan qo'lda o'chirilgan postni panel o'zi bilmaydi —
                shu tugma tekshiradi va holatni yangilaydi. */}
            <button onClick={sync} disabled={syncing || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-green/20 px-3 py-2 text-sm font-bold text-muted transition-colors hover:border-green/40 hover:text-green disabled:opacity-50">
              <Icon d={I.refresh} className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Tekshirilmoqda…" : "Holatni tekshirish"}
            </button>
            <span className="relative">
              <Icon d={I.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish…"
                className="w-44 rounded-xl border border-green/15 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-green" />
            </span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-green/15 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-green">
              <option value="all">Holat bo'yicha: barchasi</option>
              <option value="pending_approval">Saqlangan</option>
              <option value="published">Joylandi</option>
              <option value="failed">Xato</option>
              <option value="removed">O'chirilgan</option>
              <option value="draft">Qoralama</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="mt-4"><SkeletonTable rows={4} cols={6} /></div>
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
                            <button onClick={() => remove(p)} disabled={acting} title="O'chirish"
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

      {/* Rasmni to'liq ekranda ko'rish */}
      {zoomImg && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4"
          onClick={() => setZoomImg("")}>
          <img src={zoomImg} alt="" className="max-h-[92vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setZoomImg("")}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25">
            <Icon d="M18 6L6 18 M6 6l12 12" className="h-5 w-5" />
          </button>
        </div>
      )}

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
            {preview.image_url && (
              <img src={preview.image_url} alt="" title="Kattalashtirish uchun bosing"
                onClick={() => setZoomImg(preview.image_url!)}
                className="mt-3 w-full cursor-zoom-in rounded-xl object-cover" />
            )}
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
