import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { tirikVideolar } from "../_shared/tzHisobot.ts"

/**
 * me-tasks-update — Bloger o'z topshirig'ini yangilaydi.
 *
 *   PATCH ?id=<assignment_id>                 — holat / o'qildi / izoh
 *   POST  ?id=<assignment_id>&op=video        — TZ ga video biriktirish
 *   POST  ?id=<assignment_id>&op=video-remove — biriktirishni olib tashlash
 *   POST  ?op=band                            — TZ bandini belgilash
 *
 * Yangi edge funksiya OCHILMADI: loyihada allaqachon 100 dan ortiq
 * funksiya bor va deploy limitiga yaqin.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  const url = new URL(req.url)
  const op = url.searchParams.get("op")

  try {
    /* ================================================================
     * TZ BANDINI BELGILASH
     *
     * Band `partner_tasks` da yotadi va u HAMKORGA tegishli. Bloger
     * uni faqat shu shart bilan o'zgartira oladi: band aynan o'sha
     * TZ dan kelib chiqqan va bloger o'sha TZ ga biriktirilgan.
     * Aks holda istalgan bloger istalgan kompaniyaning ishini
     * "bajardim" deb belgilab qo'yardi.
     * ================================================================ */
    if (op === "band" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const bandId = String(body.band_id || "")
      if (!bandId) return errorResponse("band_id talab qilinadi", 400)

      const { data: band } = await supabaseAdmin
        .from("partner_tasks")
        .select("id, brief_id, status")
        .eq("id", bandId)
        .is("deleted_at", null)
        .maybeSingle()
      if (!band || !band.brief_id) return errorResponse("Band topilmadi", 404)

      // Band -> TZ so'rovi -> topshiriq -> shu bloger biriktirilganmi?
      const { data: brief } = await supabaseAdmin
        .from("partner_briefs")
        .select("task_id")
        .eq("id", band.brief_id as string)
        .is("deleted_at", null)
        .maybeSingle()
      if (!brief?.task_id) return errorResponse("Bu band hali blogerlarga yuborilmagan", 403)

      const { data: biriktirma } = await supabaseAdmin
        .from("blogger_task_assignments")
        .select("id")
        .eq("task_id", brief.task_id as string)
        .eq("blogger_id", auth.user.id)
        .is("deleted_at", null)
        .maybeSingle()
      if (!biriktirma) return errorResponse("Bu topshiriq sizga biriktirilmagan", 403)

      const bajarildi = body.bajarildi !== false
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : undefined

      const yangilash: Record<string, unknown> = {
        status: bajarildi ? "done" : "pending",
        done_by: bajarildi ? auth.user.id : null,
        done_at: bajarildi ? new Date().toISOString() : null,
      }
      if (note !== undefined) yangilash.note = note || null

      const { error } = await supabaseAdmin.from("partner_tasks").update(yangilash).eq("id", bandId)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    const id = url.searchParams.get("id")
    if (!id) return errorResponse("id talab qilinadi", 400)

    /* ================================================================
     * VIDEO BIRIKTIRISH
     *
     * XAVFSIZLIK: video AYNAN shu blogerning o'z profilida bo'lishi
     * tekshiriladi. Aks holda bloger boshqa blogerning mashhur
     * videosini o'z topshirig'iga biriktirib, hamkorga "men bajardim"
     * degan yolg'on hisobot ko'rsatardi.
     *
     * Videoning NUSXASI saqlanadi (havola, nom, muqova va o'sha
     * lahzadagi raqamlar): video keyin o'chirilsa ham hisobotdagi
     * dalil qolishi kerak.
     * ================================================================ */
    if (op === "video" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const videoId = String(body.video_id || "")
      if (!videoId) return errorResponse("video_id talab qilinadi", 400)

      const { data: biriktirma } = await supabaseAdmin
        .from("blogger_task_assignments")
        .select("id, task_id")
        .eq("id", id)
        .eq("blogger_id", auth.user.id)
        .is("deleted_at", null)
        .maybeSingle()
      if (!biriktirma) return errorResponse("Topshiriq topilmadi", 404)

      const { data: profil } = await supabaseAdmin
        .from("profiles").select("id, metadata")
        .eq("id", auth.user.id).is("deleted_at", null).maybeSingle()
      const meniki = tirikVideolar(profil ? [profil as Record<string, unknown>] : [])
      const video = meniki.get(videoId)
      if (!video) return errorResponse("Bu video sizning profilingizda yo'q", 403)

      const raqam = (v: string) => Number(String(v).replace(/[^\d]/g, "")) || 0
      const { error } = await supabaseAdmin.from("blogger_task_videos").upsert({
        assignment_id: id,
        blogger_id: auth.user.id,
        video_id: video.id,
        video_link: video.link,
        video_name: video.name,
        video_thumbnail: video.thumbnail,
        platform: video.plats[0] || null,
        views_at: raqam(video.views),
        likes_at: raqam(video.likes),
        comments_at: raqam(video.comments),
      }, { onConflict: "assignment_id,video_link" })
      if (error) {
        console.error("video biriktirish:", error.message)
        return errorResponse("Videoni biriktirib bo'lmadi", 500)
      }

      /**
       * VIDEONING HAMKORINI AVTOMATIK TO'LDIRAMIZ.
       *
       * Bloger video qo'shayotganda kompaniya tanlash ATAYLAB
       * ixtiyoriy qoldirilgan. Tanlanmagan bo'lsa video hamkor
       * kabinetiga umuman tushmasdi — ya'ni TZ bajarilgan, lekin
       * hamkor buni ko'rmasdi va hisobot bo'sh chiqardi.
       */
      if (!video.partner_id) {
        const { data: brief } = await supabaseAdmin
          .from("partner_briefs").select("partner_id")
          .eq("task_id", biriktirma.task_id as string).is("deleted_at", null).maybeSingle()
        if (brief?.partner_id && profil) {
          const meta = ((profil as Record<string, unknown>).metadata as Record<string, unknown>) || {}
          const royxat = ((meta.videos as Record<string, unknown>[]) || []).map((v) =>
            String(v.id) === videoId ? { ...v, partner_id: brief.partner_id } : v)
          await supabaseAdmin.from("profiles")
            .update({ metadata: { ...meta, videos: royxat } })
            .eq("id", auth.user.id)
        }
      }

      return jsonResponse({ success: true })
    }

    if (op === "video-remove" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const link = String(body.video_link || "")
      if (!link) return errorResponse("video_link talab qilinadi", 400)
      const { error } = await supabaseAdmin.from("blogger_task_videos")
        .delete()
        .eq("assignment_id", id)
        .eq("blogger_id", auth.user.id)   // faqat o'zinikini
        .eq("video_link", link)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    if (req.method !== "PATCH" && req.method !== "PUT") return errorResponse("Method not allowed", 405)

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.status !== undefined) {
      if (!["new", "in_progress", "done"].includes(body.status)) return errorResponse("Noto'g'ri status", 400)

      /**
       * VAQTI KELMAGAN ISHNI BAJARIB BO'LMAYDI.
       *
       * Hamkor "2 soatdan keyin boshlansin" degan bo'lsa, undan
       * oldin "bajarildi" bosilishi hisobotda ish boshlanishidan
       * oldin tugagan bo'lib chiqardi — bu hujjat sifatida ishonchni
       * yo'qotardi. Tekshiruv SERVERDA: interfeysdagi bloklash
       * so'rovni to'g'ridan-to'g'ri yuborishdan saqlamaydi.
       */
      if (body.status !== "new") {
        const { data: vaqt } = await supabaseAdmin
          .from("blogger_task_assignments")
          .select("task:blogger_tasks!task_id(boshlanish)")
          .eq("id", id).eq("blogger_id", auth.user.id).is("deleted_at", null)
          .maybeSingle()
        const bosh = (vaqt?.task as unknown as { boshlanish?: string } | null)?.boshlanish
        if (bosh && new Date(bosh).getTime() > Date.now()) {
          return errorResponse("Bu topshiriq hali boshlanmagan", 409)
        }
      }
      updates.status = body.status
    }
    if (body.is_read !== undefined) updates.is_read = !!body.is_read
    if (body.note !== undefined) updates.note = String(body.note)

    // Faqat o'z topshirig'ini yangilay oladi
    const { data, error } = await supabaseAdmin
      .from("blogger_task_assignments")
      .update(updates)
      .eq("id", id)
      .eq("blogger_id", auth.user.id)
      .is("deleted_at", null)
      .select("id, status, is_read, note")
      .maybeSingle()
    if (error) return errorResponse(error.message, 500)
    if (!data) return errorResponse("Topshiriq topilmadi", 404)

    return jsonResponse({ success: true, assignment: data })
  } catch (err) {
    console.error("me-tasks-update:", err instanceof Error ? err.message : err)
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
