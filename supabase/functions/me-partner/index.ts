import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { geminiJson } from "../_shared/gemini.ts"
import { groqJson } from "../_shared/groq.ts"
import { cfJson, cfChatAvailable } from "../_shared/cfChat.ts"
import { sarfYoz } from "../_shared/aiKesh.ts"
import { tirikVideolar, raqamIshonchlimi } from "../_shared/tzHisobot.ts"
import { takrorYaroqli, boshlanishVaqti } from "../_shared/takrorlash.ts"

/**
 * Ko'rishlar soni matn sifatida saqlanadi va manbaga qarab har xil
 * ko'rinishda bo'ladi: "12500", "12.5K", "1,2M". Statistika uchun
 * ularni sonlarga keltiramiz — aks holda qo'shib bo'lmaydi.
 */
function sonGa(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  if (typeof v !== "string") return 0
  const s = v.trim().replace(/\s/g, "").replace(",", ".")
  const m = s.match(/^([\d.]+)\s*([KkMmBb])?$/)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return 0
  const kat = (m[2] || "").toLowerCase()
  return Math.round(n * (kat === "k" ? 1_000 : kat === "m" ? 1_000_000 : kat === "b" ? 1_000_000_000 : 1))
}

/** YouTube linkidan video ID */
function youtubeId(link: unknown, id: unknown): string | null {
  const s = String(link || "")
  const m = s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (m) return m[1]
  // Eski yozuvlarda ID ning o'zi saqlangan bo'lishi mumkin
  const t = String(id || "")
  return /^[a-zA-Z0-9_-]{11}$/.test(t) ? t : null
}

/** "PT12M30S" -> "12:30" */
function davomiylik(iso: unknown): string {
  const m = String(iso || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return ""
  const [h, d, s] = [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)]
  const ikki = (n: number) => String(n).padStart(2, "0")
  return h ? `${h}:${ikki(d)}:${ikki(s)}` : `${d}:${ikki(s)}`
}

type YtMalumot = {
  views?: string; likes?: string; comments?: string
  duration?: string; description?: string; channel?: string
  title?: string; date?: string; thumbnail?: string
}

/**
 * VIDEO MA'LUMOTLARINI YOUTUBE'DAN OLISH VA YANGILASH.
 *
 * Ikki muammoni hal qiladi:
 *   1) AVVAL qo'shilgan videolarda yoqtirish/izoh umuman saqlanmagan
 *      edi — kabinetda "—" ko'rinardi. Blogerdan videoni qayta
 *      qo'shishni so'rash noto'g'ri bo'lardi.
 *   2) Raqamlar vaqt o'tishi bilan o'zgaradi. Qo'shilgan kundagi
 *      ko'rishlar soni bir oydan keyin eskirgan bo'ladi.
 *
 * Shuning uchun raqamlar SOATIGA BIR MARTA yangilanadi: `yt_at`
 * belgisi shundan. Har ochilishda so'rov yuborish kvotani behuda
 * sarflardi, umuman yubormaslik esa raqamlarni eskirtirardi.
 *
 * Bitta so'rovda 50 tagacha video (API chegarasi). Kalit yo'q bo'lsa
 * yoki so'rov yiqilsa hech narsa buzilmaydi — mavjud raqamlar qoladi.
 */
async function youtubeRaqamlariniTolatir(
  videolar: Record<string, unknown>[],
  profiles: Record<string, unknown>[],
): Promise<void> {
  const kalit = Deno.env.get("YOUTUBE_API_KEY")
  if (!kalit) return

  const YANGILASH_ORALIGI = 60 * 60 * 1000
  const hozir = Date.now()
  const eskirgan = (v: Record<string, unknown>) => {
    const t = Number(v.yt_at || 0)
    return !t || hozir - t > YANGILASH_ORALIGI
  }

  const kerak = new Map<string, Record<string, unknown>[]>()
  for (const v of videolar) {
    if (!(v.plats as string[]).includes("YouTube")) continue
    if (!eskirgan(v)) continue
    const yid = youtubeId(v.link, v.id)
    if (!yid) continue
    const ro = kerak.get(yid) || []
    ro.push(v)
    kerak.set(yid, ro)
  }
  if (kerak.size === 0) return

  const idlar = [...kerak.keys()].slice(0, 50)
  const malumot: Record<string, YtMalumot> = {}
  try {
    const resp = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${idlar.join(",")}&key=${kalit}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    const data = await resp.json()
    for (const it of (data.items || []) as Record<string, any>[]) {
      const st = it.statistics || {}
      const sn = it.snippet || {}
      malumot[it.id] = {
        views: st.viewCount,
        likes: st.likeCount,
        comments: st.commentCount,
        duration: davomiylik(it.contentDetails?.duration),
        // Tavsif juda uzun bo'lishi mumkin — kartochka uchun shuncha yetadi
        description: String(sn.description || "").slice(0, 1500),
        channel: sn.channelTitle || "",
        title: sn.title || "",
        date: String(sn.publishedAt || "").split("T")[0],
        thumbnail: sn.thumbnails?.maxres?.url || sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || "",
      }
    }
  } catch (e) {
    console.error("youtubeRaqamlari:", e instanceof Error ? e.message : e)
    return
  }
  if (Object.keys(malumot).length === 0) return

  /** Bitta yozuvga yangi ma'lumotni qo'llaydi. O'zgargan bo'lsa `true`. */
  const qolla = (v: Record<string, unknown>, m: YtMalumot): boolean => {
    let o = false
    const yoz = (kalit: string, qiymat: unknown) => {
      if (qiymat === undefined || qiymat === "" || v[kalit] === qiymat) return
      v[kalit] = qiymat
      o = true
    }
    yoz("views", m.views)
    yoz("likes", m.likes)
    yoz("comments", m.comments)
    yoz("duration", m.duration)
    yoz("description", m.description)
    yoz("channel", m.channel)
    if (!v.thumbnail) yoz("thumbnail", m.thumbnail)
    if (!v.date) yoz("date", m.date)
    return o
  }

  // Javobga qo'llaymiz
  for (const [yid, ro] of kerak) {
    const m = malumot[yid]
    if (!m) continue
    for (const v of ro) qolla(v, m)
  }

  // Bazaga ham yozamiz — keyingi soatgacha so'rov kerak bo'lmaydi
  for (const p of profiles) {
    const meta = (p.metadata as Record<string, unknown>) || {}
    const list = (meta.videos as Record<string, unknown>[]) || []
    let ozgardi = false
    for (const v of list) {
      const yid = youtubeId(v.link, v.id)
      const m = yid ? malumot[yid] : undefined
      if (!m) continue
      // Vaqt belgisi HAR DOIM yangilanadi: raqamlar o'zgarmagan bo'lsa
      // ham so'rov qilingan, bir soatgacha takrorlanmasin
      if (qolla(v, m)) ozgardi = true
      v.yt_at = hozir
      ozgardi = true
    }
    if (!ozgardi) continue
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ metadata: { ...meta, videos: list } })
      .eq("id", p.id as string)
    if (error) console.error("youtubeRaqamlari saqlash:", error.message)
  }
}

/* ---------------- IZOHLAR TAHLILI ---------------- */

type IzohXom = { text: string; likes: number; author: string }

/**
 * Bitta videoning izohlarini oladi. Xato bo'lsa bo'sh massiv —
 * bitta video yiqilgani butun tahlilni to'xtatmasin.
 */
async function izohlarniOl(videoId: string, kalit: string): Promise<IzohXom[]> {
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}` +
      `&maxResults=50&order=relevance&textFormat=plainText&key=${kalit}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!r.ok) return []
    const d = await r.json()
    return ((d.items || []) as Record<string, any>[]).map((it) => {
      const s = it.snippet?.topLevelComment?.snippet || {}
      return {
        text: String(s.textOriginal || s.textDisplay || "").trim(),
        likes: Number(s.likeCount || 0),
        author: String(s.authorDisplayName || ""),
      }
    }).filter((c) => c.text)
  } catch {
    return []
  }
}

type Tahlil = {
  ijobiy: number; salbiy: number; savol: number; neytral: number
  savollar: { matn: string; soni: number }[]
  shikoyatlar: { matn: string; soni: number }[]
  brend: string[]
  xulosa: string
}

/** Modeldan kelgan javobni ISHONCHSIZ deb qarab, shaklga keltiramiz */
function tahlilniTozala(xom: unknown, jami: number): Tahlil | null {
  if (!xom || typeof xom !== "object") return null
  const o = xom as Record<string, unknown>
  const son = (v: unknown) => Math.max(0, Math.round(Number(v) || 0))
  const royxat = (v: unknown, n: number) =>
    Array.isArray(v)
      ? v.slice(0, n).map((x) => {
        const e = (x || {}) as Record<string, unknown>
        return { matn: String(e.matn ?? e.text ?? x ?? "").slice(0, 200), soni: son(e.soni ?? e.count ?? 1) }
      }).filter((x) => x.matn)
      : []

  let ijobiy = son(o.ijobiy), salbiy = son(o.salbiy), savol = son(o.savol), neytral = son(o.neytral)
  const yigindi = ijobiy + salbiy + savol + neytral

  /**
   * Model raqamlarni "taxminan" beradi va yig'indi izohlar soniga
   * to'g'ri kelmasligi mumkin. Foiz chiqarganda bu darrov ko'zga
   * tashlanadi, shuning uchun nisbatni saqlagan holda haqiqiy songa
   * keltiramiz.
   */
  if (yigindi > 0 && yigindi !== jami) {
    const k = jami / yigindi
    ijobiy = Math.round(ijobiy * k)
    salbiy = Math.round(salbiy * k)
    savol = Math.round(savol * k)
    neytral = Math.max(0, jami - ijobiy - salbiy - savol)
  }

  return {
    ijobiy, salbiy, savol, neytral,
    savollar: royxat(o.savollar, 5),
    shikoyatlar: royxat(o.shikoyatlar, 5),
    brend: Array.isArray(o.brend) ? (o.brend as unknown[]).slice(0, 5).map((x) => String(x).slice(0, 300)).filter(Boolean) : [],
    xulosa: String(o.xulosa ?? "").slice(0, 600),
  }
}

async function izohTahlili(izohlar: IzohXom[], kompaniya: string): Promise<Tahlil | null> {
  // Modelga faqat matn kerak — muallif ismi shaxsiy ma'lumot va
  // tahlilga hech narsa qo'shmaydi
  const royxat = izohlar.slice(0, 200).map((c, i) => `${i + 1}. ${c.text.slice(0, 300)}`).join("\n")

  const prompt = [
    `Quyida "${kompaniya}" kompaniyasi haqidagi reklama videolariga yozilgan ${Math.min(izohlar.length, 200)} ta izoh bor.`,
    "Izohlar o'zbek, rus yoki ingliz tilida bo'lishi mumkin, aralash ham.",
    "",
    "VAZIFA — faqat JSON qaytaring:",
    "{",
    '  "ijobiy": <maqtov, minnatdorchilik, ijobiy his bildirgan izohlar soni>,',
    '  "salbiy": <shikoyat, tanqid, norozilik bildirgan izohlar soni>,',
    '  "savol": <savol bergan izohlar soni>,',
    '  "neytral": <qolganlari>,',
    '  "savollar": [{"matn": "eng ko\'p so\'ralgan savol O\'ZBEK TILIDA", "soni": <nechta izohda>}],',
    '  "shikoyatlar": [{"matn": "eng ko\'p uchragan shikoyat O\'ZBEK TILIDA", "soni": <nechta izohda>}],',
    `  "brend": ["${kompaniya} nomi yoki mahsuloti tilga olingan izohlar, asl holida"],`,
    '  "xulosa": "2-3 jumla: odamlar umuman nima deyapti"',
    "}",
    "",
    "QOIDALAR:",
    "- To'rt sonning yig'indisi izohlar soniga TENG bo'lsin.",
    "- savollar va shikoyatlar: eng ko'p takrorlanganidan 3 tagacha. Yo'q bo'lsa bo'sh massiv.",
    "- Umumlashtiring: bir xil ma'nodagi izohlarni bitta qilib birlashtiring va sonini yozing.",
    "- Emoji va bir so'zli izohlar neytral hisoblanadi.",
    "- Faqat JSON, boshqa matn yo'q.",
    "",
    "IZOHLAR:",
    royxat,
  ].join("\n")

  const deadline = Date.now() + 45_000
  const zanjir: { nom: string; ishla: (ms: number) => Promise<unknown> }[] = [
    { nom: "Gemini", ishla: (ms) => geminiJson(prompt, { retries: 1, maxTokens: 2000, timeoutMs: ms }) },
    { nom: "Groq", ishla: (ms) => groqJson(prompt, { retries: 0, maxTokens: 2000, timeoutMs: ms }) },
  ]
  if (cfChatAvailable()) {
    zanjir.push({ nom: "Cloudflare", ishla: (ms) => cfJson(prompt, { maxTokens: 2000, timeoutMs: ms, deadline }) })
  }

  for (const { nom, ishla } of zanjir) {
    const qolgan = deadline - Date.now()
    if (qolgan < 6_000) break
    const boshlandi = Date.now()
    try {
      const t = tahlilniTozala(await ishla(Math.min(25_000, qolgan)), Math.min(izohlar.length, 200))
      // Sarf hisobi — editor panelidagi "AI kalitlari va kvota" kartasi
      // shu yozuvlardan hisoblanadi. Bu yerdan yozilmasa hamkor
      // kabinetidagi tahlil kvotani "ko'rinmasdan" yeb qo'yardi.
      await sarfYoz({
        provayder: nom.toLowerCase(), vazifa: "comment-analysis",
        muvaffaqiyat: Boolean(t), matnUzunligi: prompt.length,
        davomiylik: Date.now() - boshlandi,
        xato: t ? undefined : "kutilmagan javob shakli",
      })
      if (t) return t
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      console.error(`izohTahlili ${nom}:`, m)
      await sarfYoz({
        provayder: nom.toLowerCase(), vazifa: "comment-analysis",
        muvaffaqiyat: false, matnUzunligi: prompt.length,
        davomiylik: Date.now() - boshlandi, xato: m,
      })
    }
  }
  return null
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  // company yoki user role bo'lsa — ruxsat beriladi
  if (auth.user.role !== "company" && auth.user.role !== "user") {
    return errorResponse("Ruxsat yo'q", 403, "FORBIDDEN")
  }

  try {
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id, name, sphere, contract_no, contract_amount, signed_date, status")
      .eq("client_profile_id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!partner) {
      return jsonResponse({ partner: null })
    }

    /* ================================================================
     * TZ SO'ROVLARI (hamkor -> admin)
     *
     * Ilgari hamkor "menga shunaqa reklama kerak" deb telefon yoki
     * Telegram orqali aytardi va bu tizimda iz qoldirmasdi: kim nima
     * so'raganini, qachon so'raganini va u qay bosqichda ekanini
     * keyin tiklab bo'lmasdi.
     *
     * XAVFSIZLIK: `partner` yuqorida AYNAN shu foydalanuvchining
     * hisobidan topilgan. Hamkor tashqaridan boshqa `partner_id`
     * bera olmaydi — u so'rovda umuman qabul qilinmaydi.
     * ================================================================ */
    if (new URL(req.url).searchParams.get("action") === "briefs") {
      const { data, error } = await supabaseAdmin
        .from("partner_briefs")
        .select("id, title, description, priority, deadline, file_url, file_name, status, admin_note, task_id, created_at, takrorlanish, boshlanish, tugash, keyingi")
        .eq("partner_id", partner.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100)
      if (error) {
        console.error("briefs:", error.message)
        return errorResponse("Topshiriqlarni yuklab bo'lmadi", 500)
      }

      /**
       * Blogerlarga yuborilgan TZ ning BAJARILISHI ham qaytadi.
       * Hamkor uchun eng muhim savol shu: "so'rovim qabul qilindi"
       * emas, "nechta bloger boshladi va nechtasi tugatdi".
       */
      const taskIds = (data || []).map((b) => b.task_id).filter(Boolean) as string[]
      const holat: Record<string, { jami: number; boshlandi: number; bajarildi: number }> = {}
      if (taskIds.length) {
        const { data: biriktirilgan } = await supabaseAdmin
          .from("blogger_task_assignments")
          .select("task_id, status")
          .in("task_id", taskIds)
          .is("deleted_at", null)
        for (const a of (biriktirilgan || []) as { task_id: string; status: string }[]) {
          const h = holat[a.task_id] || { jami: 0, boshlandi: 0, bajarildi: 0 }
          h.jami++
          if (a.status === "in_progress") h.boshlandi++
          if (a.status === "done") h.bajarildi++
          holat[a.task_id] = h
        }
      }

      return jsonResponse({
        briefs: (data || []).map((b) => ({
          ...b,
          bajarilish: b.task_id ? (holat[b.task_id as string] || { jami: 0, boshlandi: 0, bajarildi: 0 }) : null,
        })),
      })
    }

    /* ================================================================
     * TZ ASOSIDAGI TO'LIQ HISOBOT
     *
     * Hamkor TZ da nima yozgan bo'lsa — aynan shu bandlar, ularning
     * bajarilishi, kim bajargani, qanday qilingani va qaysi video
     * bilan. Ustiga har blogerning natijasi (ko'rish, layk, izoh).
     *
     * BARCHASI BITTA SO'ROVDA: har TZ uchun alohida so'rov yuborilsa
     * 40 ta TZ li kompaniya uchun 150 dan ortiq so'rov chiqardi.
     * ================================================================ */
    if (new URL(req.url).searchParams.get("action") === "brief-report") {
      const { data: brieflar } = await supabaseAdmin
        .from("partner_briefs")
        .select("id, title, description, priority, deadline, status, admin_note, task_id, created_at, takrorlanish, boshlanish, tugash, keyingi")
        .eq("partner_id", partner.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100)

      const royxat = (brieflar || []) as Record<string, unknown>[]
      const briefIds = royxat.map((b) => b.id as string)

      /**
       * TAKRORLANUVCHI TZ BIR NECHTA TOPSHIRIQ TUG'DIRADI.
       *
       * `partner_briefs.task_id` faqat BIRINCHISINI ko'rsatadi.
       * Kunlik TZ da faqat shunga qarasak, hisobot birinchi kunda
       * qotib qolardi. Shuning uchun barcha davrlar `brief_id`
       * bo'yicha olinadi.
       */
      const { data: davrlar } = briefIds.length
        ? await supabaseAdmin.from("blogger_tasks")
            .select("id, brief_id, takror_raqami, boshlanish, created_at")
            .in("brief_id", briefIds).is("deleted_at", null)
            .order("takror_raqami", { ascending: true })
        : { data: [] }

      const davrRoyxat = (davrlar || []) as Record<string, unknown>[]
      const taskIds = [...new Set([
        ...davrRoyxat.map((d) => d.id as string),
        // Eski so'rovlarda `brief_id` bo'lmasligi mumkin
        ...royxat.map((b) => b.task_id).filter(Boolean) as string[],
      ])]

      const [bandRes, assignRes] = await Promise.all([
        briefIds.length
          ? supabaseAdmin.from("partner_tasks")
              .select("id, brief_id, task_id, title, status, sort_order, done_by, done_at, note")
              .in("brief_id", briefIds).is("deleted_at", null)
              .order("sort_order", { ascending: true })
          : Promise.resolve({ data: [] }),
        taskIds.length
          ? supabaseAdmin.from("blogger_task_assignments")
              .select("id, task_id, blogger_id, status, note")
              .in("task_id", taskIds).is("deleted_at", null)
          : Promise.resolve({ data: [] }),
      ])

      const bandlar = (bandRes.data || []) as Record<string, unknown>[]
      const biriktirmalar = (assignRes.data || []) as
        { id: string; task_id: string; blogger_id: string; status: string; note: string | null }[]

      const assignIds = biriktirmalar.map((a) => a.id)
      const blogerIds = [...new Set(biriktirmalar.map((a) => a.blogger_id))]

      const [videoRes, profRes, blogerRes] = await Promise.all([
        assignIds.length
          ? supabaseAdmin.from("blogger_task_videos")
              .select("assignment_id, blogger_id, video_id, video_link, video_name, video_thumbnail, platform, views_at, likes_at, comments_at, added_at")
              .in("assignment_id", assignIds)
          : Promise.resolve({ data: [] }),
        blogerIds.length
          ? supabaseAdmin.from("profiles").select("id, name, avatar, metadata")
              .in("id", blogerIds).is("deleted_at", null)
          : Promise.resolve({ data: [] }),
        blogerIds.length
          ? supabaseAdmin.from("bloggers").select("id, slug").in("id", blogerIds).is("deleted_at", null)
          : Promise.resolve({ data: [] }),
      ])

      const profillar = (profRes.data || []) as Record<string, unknown>[]
      const tirik = tirikVideolar(profillar)
      const blogerNomi = new Map<string, { name: string; avatar: string | null; slug: string | null }>()
      for (const p of profillar) {
        blogerNomi.set(p.id as string, {
          name: (p.name as string) || "—", avatar: (p.avatar as string) || null, slug: null,
        })
      }
      for (const b of (blogerRes.data || []) as { id: string; slug: string | null }[]) {
        const bor = blogerNomi.get(b.id)
        if (bor) bor.slug = b.slug
      }

      const videolar = (videoRes.data || []) as Record<string, unknown>[]

      /** Video yozuvidan TIRIK raqamlarni oladi, bo'lmasa nusxadan */
      const videoMalumot = (v: Record<string, unknown>) => {
        const jonli = tirik.get(String(v.video_id))
        const plats = jonli?.plats || (v.platform ? [String(v.platform)] : [])
        const views = jonli ? jonli.views : String(v.views_at || 0)
        return {
          video_id: v.video_id,
          link: v.video_link,
          name: jonli?.name || v.video_name || "Video",
          thumbnail: jonli?.thumbnail || v.video_thumbnail || null,
          platform: plats[0] || v.platform || "—",
          views,
          likes: jonli ? jonli.likes : String(v.likes_at || 0),
          comments: jonli ? jonli.comments : String(v.comments_at || 0),
          /**
           * Raqam ishonchlimi. Faqat YouTube API orqali yangilanadi;
           * Instagram/TikTok/Telegram uchun hech kim raqam yozmaydi va
           * "0" bo'lib qoladi. Bunday videoni jamiga qo'shish
           * hisobotni yolg'on qilardi.
           */
          ishonchli: raqamIshonchlimi(plats, views),
          ochirilgan: !jonli,
          blogger_id: v.blogger_id,
          added_at: v.added_at,
        }
      }

      const videoByAssign = new Map<string, ReturnType<typeof videoMalumot>[]>()
      for (const v of videolar) {
        const k = v.assignment_id as string
        const r = videoByAssign.get(k) || []
        r.push(videoMalumot(v))
        videoByAssign.set(k, r)
      }

      const bandByBrief = new Map<string, Record<string, unknown>[]>()
      for (const b of bandlar) {
        const k = b.brief_id as string
        const r = bandByBrief.get(k) || []
        r.push(b)
        bandByBrief.set(k, r)
      }

      /** Topshiriq -> qaysi so'rovga tegishli (barcha davrlar bo'yicha) */
      const taskToBrief = new Map<string, string>()
      for (const d of davrRoyxat) taskToBrief.set(d.id as string, d.brief_id as string)
      for (const b of royxat) {
        if (b.task_id) taskToBrief.set(b.task_id as string, b.id as string)
      }

      /**
       * BIRIKTIRMALAR SO'ROV BO'YICHA.
       *
       * Takrorlanuvchi TZ da bitta bloger har davr uchun alohida
       * biriktirmaga ega. Hisobotda ular BIR bloger bo'lib
       * ko'rinishi kerak — aks holda "har kuni" TZ da bir odam
       * o'ttiz marta ro'yxatga tushardi.
       */
      const assignByBrief = new Map<string, typeof biriktirmalar>()
      for (const a of biriktirmalar) {
        const bid = taskToBrief.get(a.task_id)
        if (!bid) continue
        const r = assignByBrief.get(bid) || []
        r.push(a)
        assignByBrief.set(bid, r)
      }

      /**
       * RAQAMLAR QACHON YANGILANGANI.
       *
       * `yt_at` video yozuvining ichida turadi va `Date.now()` (son)
       * bo'lib saqlanadi. Eng ESKISINI olamiz: hisobot shu paytdan
       * beri o'zgarmagan raqamlarni ko'rsatadi.
       *
       * Buni aytish SHART: raqam bugun 120 000, ertaga 145 000 bo'ladi
       * va chop etilgan ikkita PDF bir-biriga zid ko'rinadi. Sanasiz
       * hamkor qaysi biri to'g'ri ekanini bilmaydi.
       */
      let engEskiYangilanish: number | null = null
      for (const p of profillar) {
        const meta = (p.metadata as Record<string, unknown>) || {}
        for (const v of ((meta.videos as Record<string, unknown>[]) || [])) {
          const vaqt = Number(v.yt_at || 0)
          if (!vaqt) continue
          if (engEskiYangilanish === null || vaqt < engEskiYangilanish) engEskiYangilanish = vaqt
        }
      }

      type BlogerNatija = {
        id: string; name: string; avatar: string | null; slug: string | null
        status: string; note: string | null
        videolar: ReturnType<typeof videoMalumot>[]
        views: number; likes: number; comments: number; nomalum: number
      }

      const hisobot = royxat.map((b) => {
        const bandRoyxat = bandByBrief.get(b.id as string) || []
        const biriktirilgan = assignByBrief.get(b.id as string) || []

        /**
         * BIR BLOGER — BIR QATOR.
         *
         * Takrorlanuvchi TZ da bitta bloger har davr uchun alohida
         * biriktirmaga ega. Ular qo'shib yuborilmasa "har kuni" degan
         * TZ da bitta odam o'ttiz marta ro'yxatga tushardi.
         */
        const blogerXarita = new Map<string, BlogerNatija>()
        for (const a of biriktirilgan) {
          const vs = videoByAssign.get(a.id) || []
          const ishonchli = vs.filter((v) => v.ishonchli)
          const bor = blogerXarita.get(a.blogger_id) || {
            id: a.blogger_id,
            name: blogerNomi.get(a.blogger_id)?.name || "—",
            avatar: blogerNomi.get(a.blogger_id)?.avatar || null,
            slug: blogerNomi.get(a.blogger_id)?.slug || null,
            status: a.status,
            note: a.note,
            videolar: [] as ReturnType<typeof videoMalumot>[],
            views: 0, likes: 0, comments: 0, nomalum: 0,
          }
          bor.videolar.push(...vs)
          bor.views += ishonchli.reduce((s, v) => s + sonGa(v.views), 0)
          bor.likes += ishonchli.reduce((s, v) => s + sonGa(v.likes), 0)
          bor.comments += ishonchli.reduce((s, v) => s + sonGa(v.comments), 0)
          // Raqami noma'lum videolar soni — hisobotda ochiq aytiladi
          bor.nomalum += vs.length - ishonchli.length
          // Eng ilgarilagan holat ko'rsatiladi: bir davrda tugatgan
          // bloger "yangi" bo'lib turmasin
          if (a.status === "done" || (a.status === "in_progress" && bor.status === "new")) bor.status = a.status
          blogerXarita.set(a.blogger_id, bor)
        }
        const blogerlar = [...blogerXarita.values()].sort((x, y) => y.views - x.views)

        const bajarildi = bandRoyxat.filter((x) => x.status === "done").length
        const davrSoni = davrRoyxat.filter((d) => d.brief_id === b.id).length
        return {
          id: b.id,
          /** Takrorlanish — hisobotda "har kuni" deb ko'rinadi */
          takrorlanish: b.takrorlanish || "bir_marta",
          boshlanish: b.boshlanish,
          tugash: b.tugash,
          keyingi: b.keyingi,
          /** Nechta davr yaratilgan (kunlik TZ da kunlar soni) */
          davrSoni: davrSoni || (b.task_id ? 1 : 0),
          title: b.title,
          description: b.description,
          priority: b.priority,
          deadline: b.deadline,
          status: b.status,
          admin_note: b.admin_note,
          created_at: b.created_at,
          bandlar: bandRoyxat.map((x) => ({
            id: x.id,
            title: x.title,
            status: x.status,
            note: x.note,
            done_at: x.done_at,
            done_by: x.done_by,
            done_by_name: x.done_by ? (blogerNomi.get(x.done_by as string)?.name || null) : null,
          })),
          bandJami: bandRoyxat.length,
          bandBajarildi: bajarildi,
          blogerlar,
          views: blogerlar.reduce((s, x) => s + x.views, 0),
          likes: blogerlar.reduce((s, x) => s + x.likes, 0),
          comments: blogerlar.reduce((s, x) => s + x.comments, 0),
          videoJami: blogerlar.reduce((s, x) => s + x.videolar.length, 0),
          nomalum: blogerlar.reduce((s, x) => s + x.nomalum, 0),
        }
      })

      return jsonResponse({
        hisobot,
        raqamlarHolati: engEskiYangilanish,
      })
    }

    /* ================================================================
     * E'TIROZLAR (SHIKOYATLAR)
     *
     * Bloger TZ ni noto'g'ri bajarsa yoki video yoqmasa, hamkorning
     * ayta oladigan joyi yo'q edi: telefon qilardi, admin og'zaki
     * yetkazardi va bu tizimda iz qoldirmasdi — bloger aynan nima
     * noto'g'ri ekanini bilmasdi va xato takrorlanaverardi.
     * ================================================================ */
    if (new URL(req.url).searchParams.get("action") === "shikoyatlar") {
      const { data, error } = await supabaseAdmin
        .from("shikoyatlar")
        .select("id, blogger_id, task_id, video_link, sabab, matn, rasmlar, status, bloger_javobi, admin_izohi, created_at")
        .eq("partner_id", partner.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100)
      if (error) {
        console.error("shikoyatlar:", error.message)
        return errorResponse("E'tirozlarni yuklab bo'lmadi", 500)
      }

      const blogerIds = [...new Set((data || []).map((x) => x.blogger_id as string))]
      const nomlar: Record<string, string> = {}
      if (blogerIds.length) {
        const { data: profs } = await supabaseAdmin
          .from("profiles").select("id, name").in("id", blogerIds)
        for (const p of (profs || []) as { id: string; name: string }[]) nomlar[p.id] = p.name || "—"
      }

      return jsonResponse({
        shikoyatlar: (data || []).map((x) => ({
          ...x, blogger_name: nomlar[x.blogger_id as string] || "—",
        })),
      })
    }

    if (req.method === "POST" && new URL(req.url).searchParams.get("action") === "shikoyat-create") {
      const body = await req.json().catch(() => ({}))
      const matn = String(body.matn || "").trim().slice(0, 3000)
      if (matn.length < 10) {
        // "Yoqmadi" degan e'tiroz blogerga hech narsa bermaydi va u
        // nimani tuzatishni bilmaydi
        return errorResponse("Nima noto'g'ri ekanini aniqroq yozing (kamida 10 belgi)", 400)
      }

      const blogerId = String(body.blogger_id || "")
      if (!blogerId) return errorResponse("Bloger tanlanmagan", 400)

      /**
       * XAVFSIZLIK: e'tiroz faqat SHU KOMPANIYA uchun ishlagan
       * blogerga yozilishi mumkin. Aks holda hamkor tizimdagi
       * istalgan blogerga e'tiroz yozib, uning tarixini
       * bulg'ay olardi.
       */
      const { data: profiles } = await supabaseAdmin
        .from("profiles").select("id, metadata")
        .eq("id", blogerId).is("deleted_at", null).maybeSingle()
      const menikiVideolar = profiles
        ? ((((profiles.metadata as Record<string, unknown>) || {}).videos as Record<string, unknown>[]) || [])
        : []
      const shuKompaniyaga = menikiVideolar.some((v) => v.partner_id === partner.id)

      let tegishli = shuKompaniyaga
      if (!tegishli) {
        // Video hali qo'shilmagan bo'lishi mumkin — TZ orqali ham tekshiramiz
        const { data: brieflar } = await supabaseAdmin
          .from("partner_briefs").select("task_id")
          .eq("partner_id", partner.id).not("task_id", "is", null).is("deleted_at", null)
        const taskIds = (brieflar || []).map((b) => b.task_id as string)
        if (taskIds.length) {
          const { data: bor } = await supabaseAdmin
            .from("blogger_task_assignments").select("id")
            .in("task_id", taskIds).eq("blogger_id", blogerId).is("deleted_at", null).limit(1)
          tegishli = (bor || []).length > 0
        }
      }
      if (!tegishli) return errorResponse("Bu bloger sizning kompaniyangiz uchun ishlamagan", 403)

      const SABABLAR = ["tz_bajarilmagan", "sifat", "notogri_malumot", "brend", "muddat", "boshqa"]
      const sabab = SABABLAR.includes(String(body.sabab)) ? String(body.sabab) : "boshqa"

      // Rasm havolalari faqat http(s): boshqa sxemalar blogerning
      // brauzerida ochilganda xavfli bo'lardi
      const rasmlar = (Array.isArray(body.rasmlar) ? body.rasmlar : [])
        .map((x: unknown) => String(x || "").trim())
        .filter((x: string) => /^https?:\/\//i.test(x))
        .slice(0, 6)

      const { data, error } = await supabaseAdmin.from("shikoyatlar").insert({
        partner_id: partner.id,
        blogger_id: blogerId,
        task_id: String(body.task_id || "") || null,
        video_link: /^https?:\/\//i.test(String(body.video_link || "")) ? String(body.video_link) : null,
        sabab, matn, rasmlar,
        created_by: auth.user.id,
      }).select("id").single()
      if (error) {
        console.error("shikoyat-create:", error.message)
        return errorResponse("E'tirozni yuborib bo'lmadi", 500)
      }
      return jsonResponse({ success: true, id: data.id })
    }

    if (req.method === "POST" && new URL(req.url).searchParams.get("action") === "brief-create") {
      const body = await req.json().catch(() => ({}))
      const title = String(body.title || "").trim().slice(0, 255)
      if (!title) return errorResponse("Sarlavha yozing", 400)

      const description = String(body.description || "").trim().slice(0, 5000)
      if (description.length < 20) {
        // Bo'sh TZ adminga hech narsa bermaydi — u baribir qayta
        // so'rashga majbur bo'lardi
        return errorResponse("Talablarni batafsilroq yozing (kamida 20 belgi)", 400)
      }

      const priority = ["low", "normal", "high"].includes(body.priority) ? body.priority : "normal"
      const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(body.deadline || "")) ? String(body.deadline) : null

      /**
       * TAKRORLANISH VA BOSHLANISH.
       *
       * TZ yuborilgan zahoti ishga tushishi shart emas: hamkor
       * ko'pincha "2 soatdan keyin" yoki "ertaga ertalab" deydi.
       * Vaqt yo'q bo'lsa buni faqat og'zaki kelishuv hal qilardi.
       */
      const takror = takrorYaroqli(body.takrorlanish) ? body.takrorlanish : "bir_marta"
      const boshlanish = boshlanishVaqti(body.kechikish, body.boshlanish)
      const tugash = /^\d{4}-\d{2}-\d{2}$/.test(String(body.tugash || "")) ? String(body.tugash) : null

      // Havola faqat http(s): boshqa sxemalar (javascript:, data:) adminning
      // brauzerida ochilganda xavfli bo'lardi
      const xomHavola = String(body.file_url || "").trim().slice(0, 500)
      const file_url = /^https?:\/\//i.test(xomHavola) ? xomHavola : null

      const { data, error } = await supabaseAdmin
        .from("partner_briefs")
        .insert({
          partner_id: partner.id,
          created_by: auth.user.id,
          title, description, priority, deadline,
          file_url,
          file_name: file_url ? String(body.file_name || "").trim().slice(0, 160) || null : null,
          takrorlanish: takror,
          boshlanish: boshlanish.toISOString(),
          tugash,
          /**
           * `keyingi` ATAYLAB hozir qo'yilmaydi. U faqat admin
           * blogerlarga yuborganda to'ladi — aks holda hali hech kimga
           * yuborilmagan so'rov uchun takrorlar yaratilib ketardi.
           */
        })
        .select("id")
        .single()
      if (error) {
        console.error("brief-create:", error.message)
        return errorResponse("Topshiriqni yuborib bo'lmadi", 500)
      }

      /**
       * TALAB BANDLARI — hisobotning asosi.
       *
       * Bandlar `partner_tasks` ga yoziladi, YANGI jadvalga emas: u
       * jadval allaqachon hamkor hisobotidagi "Jami ishlar" va
       * "Bajarilish %" ni beradi. Bandlar uchun alohida jadval
       * ochilsa, bitta hisobotda ikkita boshqa-boshqa foiz paydo
       * bo'lardi va hamkor qaysi biriga ishonishni bilmasdi.
       *
       * Chegara 50 ta: undan uzun ro'yxat TZ emas, boshqa narsa.
       */
      const bandlar = (Array.isArray(body.bandlar) ? body.bandlar : [])
        .map((x: unknown) => String(x || "").trim().slice(0, 500))
        .filter(Boolean)
        .slice(0, 50)

      if (bandlar.length) {
        const { error: bErr } = await supabaseAdmin.from("partner_tasks").insert(
          bandlar.map((matn: string, i: number) => ({
            partner_id: partner.id,
            brief_id: data.id,
            title: matn,
            status: "pending",
            sort_order: i,
            created_by: auth.user.id,
          })),
        )
        // Bandlar yozilmasa ham TZ ning O'ZI yuborilgan — butun
        // amalni bekor qilish foydalanuvchi uchun yomonroq bo'lardi
        if (bErr) console.error("brief bandlari:", bErr.message)
      }

      return jsonResponse({ success: true, id: data.id, bandlar: bandlar.length })
    }

    /**
     * VIDEO IZOHLARINI O'QISH.
     *
     * Raqam yetarli emas: kompaniya odamlar NIMA yozganini bilishi
     * kerak — maqtovmi, shikoyatmi, savolmi.
     *
     * XAVFSIZLIK: kompaniya faqat O'ZIGA belgilangan videoning
     * izohlarini o'qiy oladi. Aks holda istalgan hamkor istalgan
     * blogerning videosini shu endpoint orqali kuzatib turardi.
     */
    if (new URL(req.url).searchParams.get("action") === "comments") {
      const kalit = Deno.env.get("YOUTUBE_API_KEY")
      if (!kalit) return jsonResponse({ comments: [], sabab: "YouTube kaliti sozlanmagan" })

      const soralgan = new URL(req.url).searchParams.get("video") || ""
      if (!/^[a-zA-Z0-9_-]{11}$/.test(soralgan)) return errorResponse("Video ID noto'g'ri", 400)

      /**
       * VIDEOSI BO'LMAGAN PROFILLAR TORTILMAYDI.
       *
       * `metadata` ichida videolardan tashqari rasmlar, yutuqlar va
       * boshqa narsalar ham saqlanadi. Hammasini olib kelib, keyin
       * bu yerda saralash — tarmoqdan bekorga o'nlab kilobayt
       * tortish degani. O'lchandi: 18 KB o'rniga 1.4 KB.
       */
      const { data: profiles } = await supabaseAdmin
        .from("profiles").select("metadata")
        .is("deleted_at", null).not("metadata->videos", "is", null).limit(1000)
      const tegishli = ((profiles || []) as Record<string, unknown>[]).some((p) => {
        const meta = (p.metadata as Record<string, unknown>) || {}
        return ((meta.videos as Record<string, unknown>[]) || []).some(
          (v) => v.partner_id === partner.id && youtubeId(v.link, v.id) === soralgan,
        )
      })
      if (!tegishli) return errorResponse("Bu video sizning kompaniyangizga tegishli emas", 403)

      try {
        const resp = await fetch(
          `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${soralgan}` +
          `&maxResults=50&order=relevance&textFormat=plainText&key=${kalit}`,
          { signal: AbortSignal.timeout(10_000) },
        )
        const data = await resp.json()
        if (!resp.ok) {
          // Eng keng tarqalgani: muallif izohlarni o'chirib qo'ygan
          const sabab = data?.error?.errors?.[0]?.reason === "commentsDisabled"
            ? "Bu videoda izohlar o'chirilgan"
            : "Izohlarni olib bo'lmadi"
          return jsonResponse({ comments: [], sabab })
        }
        const comments = ((data.items || []) as Record<string, any>[]).map((it) => {
          const s = it.snippet?.topLevelComment?.snippet || {}
          return {
            id: it.id,
            author: s.authorDisplayName || "",
            avatar: s.authorProfileImageUrl || "",
            text: s.textOriginal || s.textDisplay || "",
            likes: Number(s.likeCount || 0),
            date: String(s.publishedAt || "").split("T")[0],
            replies: Number(it.snippet?.totalReplyCount || 0),
          }
        })
        return jsonResponse({ comments, sabab: "" })
      } catch (e) {
        console.error("izohlar:", e instanceof Error ? e.message : e)
        return jsonResponse({ comments: [], sabab: "Izohlarni olib bo'lmadi" })
      }
    }

    /**
     * IZOHLAR TAHLILI — odamlar nima deyapti.
     *
     * Raqam yetarli emas, izohlarni birma-bir o'qish esa vaqt oladi.
     * Bu yerda AI ularni ko'rib chiqadi: ohang nisbati, eng ko'p
     * takrorlangan savol va shikoyat, kompaniya nomi tilga olingan
     * izohlar.
     *
     * TALAB BILAN ishlaydi (avtomatik emas): AI chaqiruvi pul va
     * kvota, sahifa har ochilganda yugurtirish bekorga sarf bo'lardi.
     */
    if (new URL(req.url).searchParams.get("action") === "comment-analysis") {
      const kalit = Deno.env.get("YOUTUBE_API_KEY")
      if (!kalit) return jsonResponse({ tahlil: null, sabab: "YouTube kaliti sozlanmagan" })

      /**
       * VIDEOSI BO'LMAGAN PROFILLAR TORTILMAYDI.
       *
       * `metadata` ichida videolardan tashqari rasmlar, yutuqlar va
       * boshqa narsalar ham saqlanadi. Hammasini olib kelib, keyin
       * bu yerda saralash — tarmoqdan bekorga o'nlab kilobayt
       * tortish degani. O'lchandi: 18 KB o'rniga 1.4 KB.
       */
      const { data: profiles } = await supabaseAdmin
        .from("profiles").select("metadata")
        .is("deleted_at", null).not("metadata->videos", "is", null).limit(1000)

      // Shu kompaniyaga belgilangan YouTube videolari, izohi ko'pidan
      const nomzodlar: { yid: string; izoh: number }[] = []
      for (const p of ((profiles || []) as Record<string, unknown>[])) {
        const meta = (p.metadata as Record<string, unknown>) || {}
        for (const v of ((meta.videos as Record<string, unknown>[]) || [])) {
          if (v.partner_id !== partner.id) continue
          const yid = youtubeId(v.link, v.id)
          if (yid) nomzodlar.push({ yid, izoh: sonGa(v.comments) })
        }
      }
      if (nomzodlar.length === 0) {
        return jsonResponse({ tahlil: null, sabab: "Tahlil uchun YouTube videolari yo'q" })
      }
      nomzodlar.sort((a, b) => b.izoh - a.izoh)

      /**
       * Ko'pi bilan 6 ta video. Chegara ataylab: har biri alohida
       * so'rov va tahlil 200 ta izohdan ortig'ini baribir o'qimaydi —
       * qolgani vaqt va kvotani yeb, natijaga hech narsa qo'shmasdi.
       */
      const tanlangan = nomzodlar.slice(0, 6)
      const guruhlar = await Promise.all(tanlangan.map((n) => izohlarniOl(n.yid, kalit)))
      const izohlar = guruhlar.flat()

      if (izohlar.length === 0) {
        return jsonResponse({
          tahlil: null,
          izohlar: 0,
          videolar: tanlangan.length,
          sabab: "Videolarda izoh yo'q yoki izohlar o'chirilgan",
        })
      }

      const tahlil = await izohTahlili(izohlar, partner.name as string)
      return jsonResponse({
        tahlil,
        izohlar: Math.min(izohlar.length, 200),
        videolar: tanlangan.length,
        sabab: tahlil ? "" : "AI javob bermadi — birozdan keyin urinib ko'ring",
      })
    }

    /**
     * SHU KOMPANIYAGA BELGILANGAN BLOGER VIDEOLARI + STATISTIKA.
     *
     * Videolar `profiles.metadata.videos` massivida saqlanadi (alohida
     * jadval emas), shuning uchun ularni SQL bilan filtrlab bo'lmaydi —
     * blogerlar o'qib olinadi va bu yerda saralanadi. Blogerlar soni
     * yuzlab, shuning uchun bu arzon.
     *
     * ALOHIDA `action` sifatida: hamkor kabineti ochilganda har safar
     * hamma blogerni o'qish shart emas, faqat "Videolar" bo'limida.
     */
    if (new URL(req.url).searchParams.get("action") === "videos") {
      // `slug` profiles'da emas, bloggers'da — havola uchun kerak
      const [{ data: profiles }, { data: bloggers }] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, name, avatar, metadata")
          .is("deleted_at", null).not("metadata->videos", "is", null).limit(1000),
        supabaseAdmin.from("bloggers").select("id, slug").is("deleted_at", null).limit(1000),
      ])
      const slugMap = new Map<string, string>()
      for (const b of (bloggers || []) as { id: string; slug: string | null }[]) {
        if (b.slug) slugMap.set(b.id, b.slug)
      }

      const videolar: Record<string, unknown>[] = []
      for (const p of (profiles || []) as Record<string, unknown>[]) {
        const meta = (p.metadata as Record<string, unknown>) || {}
        for (const v of ((meta.videos as Record<string, unknown>[]) || [])) {
          if (v.partner_id !== partner.id) continue
          videolar.push({
            id: v.id,
            name: v.name,
            link: v.link,
            views: v.views ?? "0",
            likes: v.likes ?? "0",
            comments: v.comments ?? "0",
            duration: v.duration || "",
            description: v.description || "",
            channel: v.channel || "",
            plats: v.plats || [],
            date: v.date || "",
            thumbnail: v.thumbnail || null,
            blogger: { id: p.id, name: p.name, slug: slugMap.get(p.id as string) || null, avatar: p.avatar || null },
          })
        }
      }

      await youtubeRaqamlariniTolatir(videolar, (profiles || []) as Record<string, unknown>[])

      // Yangi videolar tepada
      videolar.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))

      const jamiKorish = videolar.reduce((s, v) => s + sonGa(v.views), 0)
      const jamiYoqtirish = videolar.reduce((s, v) => s + sonGa(v.likes), 0)
      const jamiIzoh = videolar.reduce((s, v) => s + sonGa(v.comments), 0)

      /**
       * PLATFORMA ULUSHI.
       *
       * Video soni ham, ko'rishlar ham sanaladi — kompaniya uchun
       * ikkinchisi muhimroq: 2 ta video 100 000 ko'rish bergan
       * platforma 10 ta video 500 ko'rish bergandan qimmatliroq.
       *
       * Bitta video bir nechta platformada bo'lsa BIRINCHISIGA
       * yoziladi. Aks holda ko'rishlar ikki marta sanalib, ulushlar
       * yig'indisi 100% dan oshib ketardi.
       */
      const platformalar: Record<string, number> = {}
      const platformaKorish: Record<string, number> = {}
      for (const v of videolar) {
        const asosiy = (v.plats as string[])[0] || "Boshqa"
        platformalar[asosiy] = (platformalar[asosiy] || 0) + 1
        platformaKorish[asosiy] = (platformaKorish[asosiy] || 0) + sonGa(v.views)
      }

      /**
       * OYLIK KO'RSATKICH — oxirgi 12 oy.
       *
       * DIQQAT: bu "shu oyda nechta ko'rish bo'ldi" EMAS. Bizda
       * ko'rishlarning kunlik tarixi yo'q — ijtimoiy tarmoq faqat
       * JORIY jami raqamni beradi. Shuning uchun bu "shu oyda
       * CHIQARILGAN videolar bugungi kunga qancha ko'rish yig'gan"
       * degani. Grafik sarlavhasida ham shunday yozilgan — aks holda
       * kompaniya raqamlarni noto'g'ri o'qib qolardi.
       *
       * Video yo'q oylar ham ro'yxatda qoladi (nol bilan): ular
       * tashlab ketilsa vaqt o'qi buzilib, tanaffuslar ko'rinmasdi.
       */
      const hozir = new Date()
      const oylar: { oy: string; views: number; videos: number }[] = []
      const indeks = new Map<string, number>()
      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(hozir.getUTCFullYear(), hozir.getUTCMonth() - i, 1))
        const kalit = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
        indeks.set(kalit, oylar.length)
        oylar.push({ oy: kalit, views: 0, videos: 0 })
      }
      for (const v of videolar) {
        const kalit = String(v.date || "").slice(0, 7)
        const i = indeks.get(kalit)
        if (i === undefined) continue
        oylar[i].views += sonGa(v.views)
        oylar[i].videos += 1
      }

      /** ENG SAMARALI BLOGERLAR — ko'rishlar bo'yicha */
      type BlogerJami = {
        id: string; name: string; slug: string | null; avatar: string | null
        videos: number; views: number; likes: number; comments: number
      }
      const blogerlar = new Map<string, BlogerJami>()
      for (const v of videolar) {
        const b = v.blogger as { id: string; name: string; slug: string | null; avatar: string | null }
        const bor = blogerlar.get(b.id) || {
          id: b.id, name: b.name, slug: b.slug, avatar: b.avatar,
          videos: 0, views: 0, likes: 0, comments: 0,
        }
        bor.videos += 1
        bor.views += sonGa(v.views)
        bor.likes += sonGa(v.likes)
        bor.comments += sonGa(v.comments)
        blogerlar.set(b.id, bor)
      }
      const top = [...blogerlar.values()].sort((a, b) => b.views - a.views)

      return jsonResponse({
        videos: videolar,
        stats: {
          total: videolar.length,
          views: jamiKorish,
          likes: jamiYoqtirish,
          comments: jamiIzoh,
          bloggers: blogerlar.size,
          platforms: platformalar,
          platformViews: platformaKorish,
          monthly: oylar,
          topBloggers: top,
          lastDate: videolar[0]?.date || "",
        },
      })
    }

    const { data: tasks } = await supabaseAdmin
      .from("partner_tasks")
      .select("id, title, status")
      .eq("partner_id", partner.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    return jsonResponse({
      partner: {
        id: partner.id,
        name: partner.name,
        sphere: partner.sphere || "",
        contractNo: partner.contract_no || "",
        amount: partner.contract_amount || 0,
        signedDate: partner.signed_date || "",
        status: partner.status,
        tasks: (tasks || []).map((t: { id: string; title: string; status: string }) => ({
          id: t.id,
          title: t.title,
          status: t.status,
        })),
      },
    })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
