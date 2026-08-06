import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { sonGa, tirikVideolar, type TirikVideo } from "../_shared/tzHisobot.ts"

/**
 * me-tasks-list — Blogerga biriktirilgan TZ'lar ro'yxati.
 *
 * Har TZ bilan birga:
 *   - TZ BANDLARI (hamkor yozgan talablar) va ularning holati
 *   - blogerning shu TZ ga biriktirgan videolari
 *   - SHU TZ ustida ishlayotgan boshqa blogerlar va ularning natijasi
 *
 * MUHIM: hamkorning `partner_briefs` qatori blogerga TO'LIQ
 * qaytarilmaydi. Unda `admin_note` bor — bu adminning HAMKORGA yozgan
 * rad javobi ("bu so'rov bema'ni edi" turidagi ichki izoh) va u
 * blogerga ko'rinmasligi kerak.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  try {
    const { data: assigns, error } = await supabaseAdmin
      .from("blogger_task_assignments")
      .select("id, status, is_read, note, created_at, task:blogger_tasks!task_id(id, title, description, priority, deadline, file_url, file_name, created_at, brief_id, boshlanish, takror_raqami)")
      .eq("blogger_id", auth.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
    if (error) return errorResponse(error.message, 500)

    // O'chirilgan TZ'larni chiqarib tashlash + tekis format
    // supabase-js ichma-ich join turini massiv deb chiqaradi, aslida
    // bitta obyekt — shuning uchun qo'lda turlaymiz
    const qatorlar = ((assigns || []) as unknown as Record<string, unknown>[])
      .filter((a) => a.task)
    const vazifa = (a: Record<string, unknown>) => a.task as unknown as Record<string, unknown>
    const taskIds = [...new Set(qatorlar.map((a) => vazifa(a).id as string))]
    const assignIds = qatorlar.map((a) => a.id as string)

    /**
     * HAMMASI BITTA SO'ROVDA.
     *
     * Har TZ uchun alohida so'rov yuborilsa 20 ta topshiriqli bloger
     * uchun 60 dan ortiq so'rov chiqardi (N+1). Bu yerda bir necha
     * so'rov bilan hammasi olinadi.
     */
    const [videoRes, hamkasbRes] = await Promise.all([
      assignIds.length
        ? supabaseAdmin.from("blogger_task_videos")
            .select("assignment_id, video_id, video_link, video_name, video_thumbnail, platform, views_at, likes_at, comments_at, added_at")
            .in("assignment_id", assignIds)
        : Promise.resolve({ data: [] }),
      taskIds.length
        ? supabaseAdmin.from("blogger_task_assignments")
            .select("id, task_id, blogger_id, status")
            .in("task_id", taskIds).is("deleted_at", null)
        : Promise.resolve({ data: [] }),
    ])

    /**
     * BANDLAR TAKROR BO'YICHA.
     *
     * Kunlik TZ da har davr O'Z bandlar nusxasiga ega: 1-kuni
     * belgilangan band 2-kuni ham bajarilgan bo'lib turmasligi kerak.
     * Shuning uchun `brief_id` emas, `task_id` bo'yicha olinadi.
     */
    let bandlar: Record<string, unknown>[] = []
    if (taskIds.length) {
      const { data } = await supabaseAdmin
        .from("partner_tasks")
        .select("id, brief_id, task_id, title, status, sort_order, done_by, done_at, note")
        .in("task_id", taskIds)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
      bandlar = (data || []) as Record<string, unknown>[]
    }

    const bandByTask = new Map<string, Record<string, unknown>[]>()
    for (const b of bandlar) {
      const k = b.task_id as string
      const r = bandByTask.get(k) || []
      r.push(b)
      bandByTask.set(k, r)
    }

    const videolar = (videoRes.data || []) as Record<string, unknown>[]
    const videoByAssign = new Map<string, Record<string, unknown>[]>()
    for (const v of videolar) {
      const k = v.assignment_id as string
      const r = videoByAssign.get(k) || []
      r.push(v)
      videoByAssign.set(k, r)
    }

    /**
     * HAMKASBLAR — shu TZ ustida ishlayotgan boshqa blogerlar.
     *
     * Faqat AYNAN SHU topshiriq bo'yicha: bloger boshqa kampaniyalarda
     * kim bilan ishlayotganini yoki qaysi kompaniyalar bilan
     * shartnomasi borligini ko'rmaydi. Bir kampaniyada birga
     * ishlayotganlar bir-birining natijasini bilishi tabiiy.
     */
    const hamkasblar = (hamkasbRes.data || []) as { id: string; task_id: string; blogger_id: string; status: string }[]
    const hamkasbIds = [...new Set(hamkasblar.map((h) => h.blogger_id))]

    // Blogerlarning tirik videolari — ko'rish/layk raqamlari uchun
    let tirik: Map<string, TirikVideo> = new Map()
    const nomlar = new Map<string, { name: string; avatar: string | null }>()
    if (hamkasbIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, name, avatar, metadata")
        .in("id", hamkasbIds).is("deleted_at", null)
      for (const p of (profs || []) as Record<string, unknown>[]) {
        nomlar.set(p.id as string, { name: (p.name as string) || "—", avatar: (p.avatar as string) || null })
      }
      tirik = tirikVideolar((profs || []) as Record<string, unknown>[])
    }

    // Har TZ uchun barcha biriktirilgan videolar (hamma blogerniki)
    const barchaAssignIds = hamkasblar.map((h) => h.id)
    let barchaVideolar: Record<string, unknown>[] = []
    if (barchaAssignIds.length) {
      const { data } = await supabaseAdmin.from("blogger_task_videos")
        .select("assignment_id, blogger_id, video_id, video_link, views_at, likes_at, comments_at")
        .in("assignment_id", barchaAssignIds)
      barchaVideolar = (data || []) as Record<string, unknown>[]
    }
    const assignToTask = new Map(hamkasblar.map((h) => [h.id, h.task_id]))

    /** TZ -> bloger -> natija */
    const natija = new Map<string, Map<string, { videos: number; views: number; likes: number; comments: number }>>()
    for (const v of barchaVideolar) {
      const tid = assignToTask.get(v.assignment_id as string)
      if (!tid) continue
      const bid = v.blogger_id as string
      const t = natija.get(tid) || new Map()
      const r = t.get(bid) || { videos: 0, views: 0, likes: 0, comments: 0 }
      // TIRIK raqam bor bo'lsa u ustun: biriktirilgan paytdagi nusxa
      // faqat video o'chirilgan holat uchun zaxira
      const jonli = tirik.get(String(v.video_id))
      r.videos += 1
      r.views += jonli ? sonGa(jonli.views) : Number(v.views_at || 0)
      r.likes += jonli ? sonGa(jonli.likes) : Number(v.likes_at || 0)
      r.comments += jonli ? sonGa(jonli.comments) : Number(v.comments_at || 0)
      t.set(bid, r)
      natija.set(tid, t)
    }

    const tasks = qatorlar.map((a: Record<string, unknown>) => {
      const t = vazifa(a)
      const taskId = t.id as string
      const bandRoyxat = bandByTask.get(taskId) || []

      const jamoa = [...(natija.get(taskId) || new Map()).entries()]
        .map(([bid, r]) => ({
          id: bid,
          name: nomlar.get(bid)?.name || "—",
          avatar: nomlar.get(bid)?.avatar || null,
          meniki: bid === auth.user.id,
          ...r,
        }))
        .sort((x, y) => y.views - x.views)

      // Video biriktirmagan, lekin TZ ga bog'langan blogerlar ham
      // ro'yxatda tursin — "kim ishlayapti" savoliga javob shu
      for (const h of hamkasblar.filter((x) => x.task_id === taskId)) {
        if (jamoa.some((j) => j.id === h.blogger_id)) continue
        jamoa.push({
          id: h.blogger_id,
          name: nomlar.get(h.blogger_id)?.name || "—",
          avatar: nomlar.get(h.blogger_id)?.avatar || null,
          meniki: h.blogger_id === auth.user.id,
          videos: 0, views: 0, likes: 0, comments: 0,
        })
      }

      return {
        assignment_id: a.id,
        task_id: taskId,
        status: a.status,
        is_read: a.is_read,
        note: a.note,
        title: t.title,
        description: t.description,
        priority: t.priority,
        deadline: t.deadline,
        file_url: t.file_url,
        file_name: t.file_name,
        created_at: t.created_at,

        /**
         * QACHONDAN BOSHLANADI va NECHANCHI DAVR.
         *
         * Hamkor "2 soatdan keyin" yoki "har hafta" degan bo'lsa,
         * bloger vaqti kelmagan ishni bajarilgan deb belgilay
         * olmasligi kerak — aks holda hisobotda ish boshlanishidan
         * oldin tugagan bo'lib chiqardi.
         */
        boshlanish: t.boshlanish,
        boshlandi: !t.boshlanish || new Date(String(t.boshlanish)).getTime() <= Date.now(),
        takror_raqami: t.takror_raqami,

        /** TZ bandlari — hamkor yozgan talablar */
        bandlar: bandRoyxat.map((b) => ({
          id: b.id,
          title: b.title,
          status: b.status,
          done_by: b.done_by,
          done_at: b.done_at,
          note: b.note,
          meniki: b.done_by === auth.user.id,
        })),

        /** Shu TZ ga biriktirilgan MENING videolarim */
        videolar: (videoByAssign.get(a.id as string) || []).map((v) => {
          const jonli = tirik.get(String(v.video_id))
          return {
            video_id: v.video_id,
            link: v.video_link,
            name: v.video_name,
            thumbnail: v.video_thumbnail,
            platform: v.platform,
            // Tirik raqam bo'lmasa (video o'chirilgan) nusxadagisi
            views: jonli ? jonli.views : String(v.views_at || 0),
            likes: jonli ? jonli.likes : String(v.likes_at || 0),
            comments: jonli ? jonli.comments : String(v.comments_at || 0),
            ochirilgan: !jonli,
            added_at: v.added_at,
          }
        }),

        /** Shu TZ ustida ishlayotganlar va natijalari */
        jamoa,
      }
    })

    const unread = tasks.filter((t) => !t.is_read).length

    /**
     * HAMKORLARNING E'TIROZLARI.
     *
     * Ilgari bloger nima noto'g'ri qilganini bilmasdi: hamkor telefon
     * qilardi, admin og'zaki yetkazardi. Endi e'tiroz aniq sabab,
     * izoh va ekran surati bilan shu yerda ko'rinadi.
     *
     * Kompaniya NOMI ataylab berilmaydi — bloger qaysi kompaniya
     * e'tiroz bildirganini bilishi kerak, shuning uchun beriladi;
     * lekin `admin_izohi` ichki qaror bo'lgani uchun faqat "korildi"
     * dan keyingi holatda ko'rsatiladi.
     */
    const { data: shikoyatlar } = await supabaseAdmin
      .from("shikoyatlar")
      .select("id, partner_id, task_id, video_link, sabab, matn, rasmlar, status, bloger_javobi, admin_izohi, created_at")
      .eq("blogger_id", auth.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50)

    const shikoyatRoyxat = (shikoyatlar || []) as Record<string, unknown>[]
    const pIds = [...new Set(shikoyatRoyxat.map((x) => x.partner_id as string))]
    const pNomlar: Record<string, string> = {}
    if (pIds.length) {
      const { data: ps } = await supabaseAdmin.from("partners").select("id, name").in("id", pIds)
      for (const p of (ps || []) as { id: string; name: string }[]) pNomlar[p.id] = p.name || "—"
    }

    return jsonResponse({
      tasks,
      unread,
      shikoyatlar: shikoyatRoyxat.map((x) => ({
        ...x, partner_name: pNomlar[x.partner_id as string] || "—",
      })),
    })
  } catch (err) {
    console.error("me-tasks-list:", err instanceof Error ? err.message : err)
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
