import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

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

      const { data: profiles } = await supabaseAdmin
        .from("profiles").select("metadata").is("deleted_at", null).limit(1000)
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
        supabaseAdmin.from("profiles").select("id, name, avatar, metadata").is("deleted_at", null).limit(1000),
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
