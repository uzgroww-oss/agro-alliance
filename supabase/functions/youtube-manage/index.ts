import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { ulanishOl, tokenOl, ytFetch } from "../_shared/youtubeAuth.ts"
import { javobYoz, sozlamaYoz, sozlamalarOl } from "../_shared/izohJavob.ts"
import { izohlarniOl, javobYubor, yozuvSaqla } from "../_shared/ytIzoh.ts"

/**
 * YOUTUBE KANALINI BOSHQARISH — hammasi shu panelda.
 *
 *   GET    ?action=videos      — kanal videolari (holati va raqamlari bilan)
 *   GET    ?action=categories  — YouTube turkumlari (yuklashda tanlanadi)
 *   POST   ?action=upload-init — video yuklash seansini ochish
 *   POST   ?action=update      — sarlavha, tavsif, teglar, maxfiylik
 *   POST   ?action=thumbnail   — muqova rasmini qo'yish
 *   DELETE ?action=delete&id=  — videoni o'chirish
 *
 * IZOHLAR (avtomatik javob):
 *   GET    ?action=comments        — izohlar + bizning javob holatimiz
 *   POST   ?action=comment-draft   — bitta izohga AI javob yozdirish
 *   POST   ?action=comment-send    — javobni YouTube'ga yuborish
 *   POST   ?action=comment-skip    — bu izohga javob berilmasin
 *   POST   ?action=comment-config  — sozlamalarni yozish
 *
 * Nega alohida funksiya emas: Supabase loyihada ~100 ta funksiyaga
 * ruxsat beradi va biz chegaraga yaqinmiz. Bir mavzudagi amallar
 * bitta funksiyada `action` bilan ajratiladi.
 *
 * VIDEO FAYLI BU FUNKSIYA ORQALI O'TMAYDI.
 * Edge funksiyaning so'rov hajmi cheklangan, 500 MB lik videoni u
 * yerdan o'tkazib bo'lmaydi. Shuning uchun bu yerda faqat "resumable
 * upload" seansi ochiladi va brauzer faylni TO'G'RIDAN-TO'G'RI
 * YouTube'ga yuboradi. Seans manzili bir martalik va o'zi ruxsat
 * beradi — access token brauzerga umuman berilmaydi.
 */

const API = "https://www.googleapis.com/youtube/v3"

/** Yuklashda va tahrirlashda ruxsat etilgan maxfiylik holatlari */
const MAXFIYLIK = ["public", "unlisted", "private"] as const

function matn(v: unknown, chegara: number): string {
  return String(v ?? "").trim().slice(0, chegara)
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  // Kanalni faqat tahririyat boshqaradi
  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "videos"

  try {
    /* ---------------- Kanal videolari ---------------- */
    if (action === "videos" && req.method === "GET") {
      const cfg = await ulanishOl()
      if (!cfg?.refresh_token && !cfg?.access_token) {
        return jsonResponse({ videos: [], ulangan: false, kanal: null })
      }

      // O'z kanalining "yuklanganlar" pleylisti.
      // `search` ishlatilmaydi: kvotadan 100 barobar ko'p yeydi va
      // yangi yuklangan videoni darrov ko'rsatmaydi.
      const ch = await ytFetch(`${API}/channels?part=snippet,contentDetails,statistics&mine=true`)
      if (!ch.ok) return jsonResponse({ videos: [], ulangan: false, xato: ch.xato })

      const kanalRaw = (ch.data.items as Record<string, any>[])?.[0]
      if (!kanalRaw) return jsonResponse({ videos: [], ulangan: false, xato: "Kanal topilmadi" })

      const kanal = {
        id: kanalRaw.id,
        title: kanalRaw.snippet?.title || "",
        thumbnail: kanalRaw.snippet?.thumbnails?.default?.url || "",
        subscribers: Number(kanalRaw.statistics?.subscriberCount ?? 0),
        videoCount: Number(kanalRaw.statistics?.videoCount ?? 0),
        viewCount: Number(kanalRaw.statistics?.viewCount ?? 0),
      }

      const uploads = kanalRaw.contentDetails?.relatedPlaylists?.uploads
      if (!uploads) return jsonResponse({ videos: [], ulangan: true, kanal })

      const pl = await ytFetch(`${API}/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=50`)
      const idlar = ((pl.data.items as Record<string, any>[]) || [])
        .map((x) => x.contentDetails?.videoId).filter(Boolean)
      if (idlar.length === 0) return jsonResponse({ videos: [], ulangan: true, kanal })

      const v = await ytFetch(`${API}/videos?part=snippet,statistics,status,contentDetails&id=${idlar.join(",")}`)
      const videos = ((v.data.items as Record<string, any>[]) || []).map((it) => ({
        id: it.id,
        title: it.snippet?.title || "",
        description: it.snippet?.description || "",
        tags: it.snippet?.tags || [],
        categoryId: it.snippet?.categoryId || "",
        thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || "",
        publishedAt: String(it.snippet?.publishedAt || "").split("T")[0],
        privacy: it.status?.privacyStatus || "",
        // Yuklangan video darrov tayyor bo'lmaydi — qayta ishlanadi
        uploadStatus: it.status?.uploadStatus || "",
        duration: it.contentDetails?.duration || "",
        views: Number(it.statistics?.viewCount ?? 0),
        likes: Number(it.statistics?.likeCount ?? 0),
        comments: Number(it.statistics?.commentCount ?? 0),
      }))

      return jsonResponse({ videos, ulangan: true, kanal })
    }

    /* ---------------- Turkumlar ---------------- */
    if (action === "categories" && req.method === "GET") {
      const r = await ytFetch(`${API}/videoCategories?part=snippet&regionCode=UZ`)
      if (!r.ok) return jsonResponse({ categories: [] })
      const categories = ((r.data.items as Record<string, any>[]) || [])
        // Ba'zi turkumlarga yangi video biriktirib bo'lmaydi
        .filter((c) => c.snippet?.assignable)
        .map((c) => ({ id: c.id, title: c.snippet?.title || "" }))
      return jsonResponse({ categories })
    }

    /* ---------------- Yuklash seansini ochish ---------------- */
    if (action === "upload-init" && req.method === "POST") {
      const token = await tokenOl()
      if (!token) return errorResponse("YouTube ulanmagan — avval kanalni ulang", 400)

      const body = await req.json().catch(() => ({}))
      const title = matn(body.title, 100)
      if (!title) return errorResponse("Sarlavha kerak", 400)

      const size = Number(body.size || 0)
      if (!size || size < 1) return errorResponse("Fayl hajmi noto'g'ri", 400)

      const privacy = MAXFIYLIK.includes(body.privacy) ? body.privacy : "private"
      const tags = Array.isArray(body.tags)
        ? (body.tags as unknown[]).map((t) => matn(t, 60)).filter(Boolean).slice(0, 20)
        : []

      const meta = {
        snippet: {
          title,
          description: matn(body.description, 5000),
          tags,
          ...(body.categoryId ? { categoryId: String(body.categoryId) } : {}),
        },
        status: {
          privacyStatus: privacy,
          // Google talabi: bola auditoriyasiga mo'ljallanganini
          // ko'rsatish MAJBURIY, aks holda yuklash rad etiladi
          selfDeclaredMadeForKids: Boolean(body.madeForKids),
        },
      }

      const r = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": String(size),
            "X-Upload-Content-Type": matn(body.mime, 100) || "video/*",
          },
          body: JSON.stringify(meta),
          signal: AbortSignal.timeout(20_000),
        },
      )
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        return errorResponse(d?.error?.message || `Yuklash seansi ochilmadi (${r.status})`, 400)
      }
      const uploadUrl = r.headers.get("location") || r.headers.get("Location")
      if (!uploadUrl) return errorResponse("Yuklash manzili qaytmadi", 500)

      return jsonResponse({ uploadUrl })
    }

    /* ---------------- Ma'lumotlarni o'zgartirish ---------------- */
    if (action === "update" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const id = matn(body.id, 20)
      if (!id) return errorResponse("Video ID kerak", 400)

      /**
       * videos.update BUTUN `snippet` ni almashtiradi.
       *
       * Ya'ni yuborilmagan maydon O'CHADI: faqat sarlavhani
       * o'zgartirmoqchi bo'lsak, tavsif va turkum yo'qoladi. Shuning
       * uchun avval mavjud holatni o'qib, ustiga o'zgarishlarni
       * qo'yamiz.
       */
      const bor = await ytFetch(`${API}/videos?part=snippet,status&id=${id}`)
      if (!bor.ok) return errorResponse(bor.xato, 400)
      const eski = (bor.data.items as Record<string, any>[])?.[0]
      if (!eski) return errorResponse("Video topilmadi", 404)

      const snippet: Record<string, unknown> = {
        title: body.title !== undefined ? matn(body.title, 100) : eski.snippet?.title,
        description: body.description !== undefined ? matn(body.description, 5000) : eski.snippet?.description,
        tags: Array.isArray(body.tags)
          ? (body.tags as unknown[]).map((t) => matn(t, 60)).filter(Boolean).slice(0, 20)
          : eski.snippet?.tags,
        categoryId: body.categoryId ? String(body.categoryId) : (eski.snippet?.categoryId || "22"),
      }
      if (!snippet.title) return errorResponse("Sarlavha bo'sh bo'lishi mumkin emas", 400)

      const status: Record<string, unknown> = {
        privacyStatus: MAXFIYLIK.includes(body.privacy) ? body.privacy : eski.status?.privacyStatus,
        selfDeclaredMadeForKids: body.madeForKids !== undefined
          ? Boolean(body.madeForKids)
          : Boolean(eski.status?.selfDeclaredMadeForKids),
      }

      const r = await ytFetch(`${API}/videos?part=snippet,status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, snippet, status }),
      })
      if (!r.ok) return errorResponse(r.xato, 400)
      return jsonResponse({ success: true })
    }

    /* ---------------- Muqova rasmi ---------------- */
    if (action === "thumbnail" && req.method === "POST") {
      const token = await tokenOl()
      if (!token) return errorResponse("YouTube ulanmagan — avval kanalni ulang", 400)

      const body = await req.json().catch(() => ({}))
      const id = matn(body.id, 20)
      const data = String(body.image || "")
      if (!id || !data) return errorResponse("Video ID va rasm kerak", 400)

      // "data:image/png;base64,...." shaklidagi qatordan baytlarni ajratamiz
      const m = data.match(/^data:(image\/[a-z+]+);base64,(.+)$/i)
      if (!m) return errorResponse("Rasm formati noto'g'ri", 400)
      const mime = m[1]
      let bytes: Uint8Array
      try {
        const bin = atob(m[2])
        bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      } catch {
        return errorResponse("Rasmni o'qib bo'lmadi", 400)
      }
      // YouTube chegarasi 2 MB
      if (bytes.length > 2 * 1024 * 1024) {
        return errorResponse("Muqova hajmi 2 MB dan oshmasligi kerak", 400)
      }

      const r = await fetch(
        `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${id}&uploadType=media`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": mime },
          body: bytes.buffer as ArrayBuffer,
          signal: AbortSignal.timeout(30_000),
        },
      )
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        /**
         * Eng ko'p uchraydigan sabab: kanal TASDIQLANMAGAN.
         * Google "forbidden" deb qaytaradi va bu tushunarsiz — aniq
         * aytamiz, aks holda foydalanuvchi rasmni ayblaydi.
         */
        const sabab = String(d?.error?.message || "")
        const aniq = /forbidden|not enabled/i.test(sabab)
          ? "Muqova qo'yish uchun kanal tasdiqlangan bo'lishi kerak (youtube.com/verify)"
          : sabab || `Muqova qo'yilmadi (${r.status})`
        return errorResponse(aniq, 400)
      }
      return jsonResponse({ success: true, thumbnail: d?.items?.[0]?.medium?.url || "" })
    }

    /* ---------------- O'chirish ---------------- */
    if (action === "delete" && req.method === "DELETE") {
      const id = url.searchParams.get("id") || ""
      if (!id) return errorResponse("Video ID kerak", 400)
      const r = await ytFetch(`${API}/videos?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!r.ok) return errorResponse(r.xato, 400)
      return jsonResponse({ success: true })
    }

    /* ================= IZOHLAR ================= */

    /**
     * Izohlar ro'yxati — YouTube'dan kelgan izohlar ustiga bizning
     * javob holatimiz qo'yilgan holda.
     *
     * Ikkala manba ham kerak: YouTube kim nima yozganini biladi,
     * baza esa biz nima qilganimizni (qoralama bormi, o'tkazib
     * yuborilganmi, nega yiqilgan).
     */
    if (action === "comments" && req.method === "GET") {
      const sozlama = await sozlamalarOl()
      const { ok, izohlar, xato, kanal } = await izohlarniOl(50)
      if (!ok) return jsonResponse({ izohlar: [], sozlama, xato })

      const { data: yozuvlar } = await supabaseAdmin
        .from("yt_izoh_javob")
        .select("comment_id, javob, holat, sabab, avto, provayder, yuborilgan_at")
        .in("comment_id", izohlar.map((i) => i.id).slice(0, 200))

      const m = new Map((yozuvlar || []).map((r: Record<string, unknown>) => [String(r.comment_id), r]))

      return jsonResponse({
        sozlama,
        izohlar: izohlar
          // O'z izohimizga javob yozishning ma'nosi yo'q
          .filter((i) => i.muallifKanal !== kanal)
          .map((i) => ({ ...i, yozuv: m.get(i.id) || null })),
      })
    }

    /**
     * Bitta izohga AI javob yozdirish. YouTube'ga YUBORMAYDI —
     * tahririyat avval o'qib chiqadi.
     */
    if (action === "comment-draft" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const id = matn(body.commentId, 80)
      const izoh = matn(body.izoh, 1500)
      if (!id || !izoh) return errorResponse("Izoh ID va matni kerak", 400)

      const sozlama = await sozlamalarOl()
      const n = await javobYoz({
        izoh,
        muallif: matn(body.muallif, 60),
        videoSarlavha: matn(body.videoTitle, 120),
        sozlama,
      })

      const asos = {
        comment_id: id,
        video_id: matn(body.videoId, 20) || "—",
        video_title: matn(body.videoTitle, 200),
        muallif: matn(body.muallif, 100),
        izoh,
        izoh_vaqti: matn(body.vaqt, 40) || null,
        avto: false,
      }

      if (n.holat === "javob") {
        await yozuvSaqla({ ...asos, javob: n.matn, provayder: n.provayder, holat: "qoralama", sabab: null })
        return jsonResponse({ holat: "qoralama", javob: n.matn, provayder: n.provayder })
      }
      if (n.holat === "otkaz") {
        await yozuvSaqla({ ...asos, holat: "otkazildi", sabab: n.sabab })
        return jsonResponse({ holat: "otkazildi", sabab: n.sabab })
      }
      return errorResponse(n.sabab, 502)
    }

    /**
     * Javobni YouTube'ga yuborish.
     *
     * Matn tanadan olinadi, bazadan emas: tahririyat AI yozganini
     * tahrirlagan bo'lishi mumkin va aynan tahrirlangani ketishi
     * kerak.
     */
    if (action === "comment-send" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const id = matn(body.commentId, 80)
      const javob = matn(body.javob, 2000)
      if (!id || !javob) return errorResponse("Izoh ID va javob matni kerak", 400)

      /**
       * IKKI MARTA YUBORILMASIN.
       *
       * Brauzerda tugma bosilgach bloklanadi, lekin bu yetarli emas:
       * ikkita oyna ochiq bo'lishi, so'rov qayta yuborilishi yoki
       * avtomatik yurish bilan ustma-ust tushishi mumkin. Bir izoh
       * ostida kanalning ikkita javobi — ko'zga tashlanadigan xato.
       */
      const { data: bor } = await supabaseAdmin
        .from("yt_izoh_javob")
        .select("holat")
        .eq("comment_id", id)
        .maybeSingle()
      if (bor?.holat === "yuborildi") {
        return errorResponse("Bu izohga javob allaqachon yuborilgan", 409)
      }

      const y = await javobYubor(id, javob)
      const asos = {
        comment_id: id,
        video_id: matn(body.videoId, 20) || "—",
        video_title: matn(body.videoTitle, 200),
        muallif: matn(body.muallif, 100),
        izoh: matn(body.izoh, 1500) || "—",
        javob,
        avto: false,
      }

      if (!y.ok) {
        await yozuvSaqla({ ...asos, holat: "xato", sabab: y.xato })
        return errorResponse(y.xato, 400)
      }
      await yozuvSaqla({ ...asos, holat: "yuborildi", sabab: null, yuborilgan_at: new Date().toISOString() })
      return jsonResponse({ success: true })
    }

    /**
     * "Bu izohga javob kerak emas" — avtomatik yurish uni boshqa
     * ko'rmasin. Aks holda har soatda AI bir xil izohni qayta ko'rib
     * bekorga token sarflardi.
     */
    if (action === "comment-skip" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const id = matn(body.commentId, 80)
      if (!id) return errorResponse("Izoh ID kerak", 400)
      await yozuvSaqla({
        comment_id: id,
        video_id: matn(body.videoId, 20) || "—",
        video_title: matn(body.videoTitle, 200),
        muallif: matn(body.muallif, 100),
        izoh: matn(body.izoh, 1500) || "—",
        holat: "otkazildi",
        sabab: "tahririyat o'tkazib yubordi",
        avto: false,
      })
      return jsonResponse({ success: true })
    }

    /** Sozlamalar — avtomatik rejim, ohang, til, chegaralar */
    if (action === "comment-config" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const yozildi: string[] = []
      for (const [k, v] of Object.entries(body || {})) {
        if (await sozlamaYoz(k, String(v ?? "").slice(0, 1000))) yozildi.push(k)
      }
      if (yozildi.length === 0) return errorResponse("O'zgartiriladigan sozlama topilmadi", 400)
      return jsonResponse({ success: true, sozlama: await sozlamalarOl() })
    }

    return errorResponse("Noma'lum amal", 400)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
