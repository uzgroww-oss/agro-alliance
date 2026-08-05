import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * admin-tasks-create — Blogerlarga TZ (topshiriq) yuborish.
 * Body: { title, description?, priority?, deadline?, blogger_ids: string[] | "all" }
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== "POST") return errorResponse("Method not allowed", 405)

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const title = String(body.title || "").trim()
    if (!title) return errorResponse("Sarlavha majburiy", 400)

    const priority = ["low", "normal", "high"].includes(body.priority) ? body.priority : "normal"

    /**
     * BITTA SO'ROV — BITTA TOPSHIRIQ.
     *
     * Ilgari tekshiruv yo'q edi: admin bir so'rovni ikki marta
     * yuborsa, birinchi topshiriq bilan bog'lam JIMGINA o'chib,
     * hamkor panelidagi "bajarilish" ikkinchi topshiriqning
     * raqamlarini ko'rsata boshlardi. Endi bazada ham yagona indeks
     * bor, lekin xatoni foydalanuvchiga tushunarli qilib aytamiz.
     */
    const briefIdOldin = String(body.brief_id || "")
    if (briefIdOldin) {
      const { data: bor } = await supabaseAdmin
        .from("partner_briefs").select("task_id")
        .eq("id", briefIdOldin).is("deleted_at", null).maybeSingle()
      if (bor?.task_id) {
        return errorResponse("Bu so'rov allaqachon blogerlarga yuborilgan", 409)
      }
    }

    // Qabul qiluvchi blogerlarni aniqlash
    let bloggerIds: string[] = []
    if (body.blogger_ids === "all" || (Array.isArray(body.blogger_ids) && body.blogger_ids.length === 0)) {
      const { data } = await supabaseAdmin.from("bloggers").select("id").is("deleted_at", null)
      bloggerIds = (data || []).map((b: { id: string }) => b.id)
    } else if (Array.isArray(body.blogger_ids)) {
      bloggerIds = body.blogger_ids.map((x: unknown) => String(x))
    }
    if (bloggerIds.length === 0) return errorResponse("Hech bo'lmaganda bitta bloger tanlang", 400)

    // TZ yaratish
    const { data: task, error: taskErr } = await supabaseAdmin
      .from("blogger_tasks")
      .insert({
        title,
        description: body.description ? String(body.description) : null,
        priority,
        deadline: body.deadline || null,
        file_url: body.file_url ? String(body.file_url) : null,
        file_name: body.file_name ? String(body.file_name) : null,
        created_by: auth.user.id,
      })
      .select("id")
      .single()
    if (taskErr || !task) return errorResponse(taskErr?.message || "TZ yaratilmadi", 500)

    // Har bir blogerga biriktirish
    const rows = bloggerIds.map((bid) => ({ task_id: task.id, blogger_id: bid, status: "new" }))
    const { error: assignErr } = await supabaseAdmin.from("blogger_task_assignments").insert(rows)
    if (assignErr) return errorResponse(assignErr.message, 500)

    /**
     * HAMKOR SO'ROVIDAN YARATILGAN BO'LSA — ZANJIRNI BOG'LAYMIZ.
     *
     * Shusiz hamkor o'z so'rovi blogerlarga yuborilganini ko'ra
     * olmasdi: TZ yaratilardi, lekin u qaysi so'rovdan kelib
     * chiqqani hech qayerda yozilmasdi va hamkor panelida so'rov
     * abadiy "yuborildi" holatida qolib ketardi.
     *
     * Bog'lash muvaffaqiyatsiz bo'lsa ham TZ ning O'ZI yaratilgan
     * va blogerlarga yetib borgan — shuning uchun xato qaytarmaymiz,
     * faqat logga yozamiz.
     */
    const briefId = String(body.brief_id || "")
    if (briefId) {
      const { error: bErr } = await supabaseAdmin
        .from("partner_briefs")
        .update({ status: "sent", task_id: task.id })
        .eq("id", briefId)
      if (bErr) console.error("brief bog'lash:", bErr.message)
    }

    return jsonResponse({ success: true, task_id: task.id, assigned: bloggerIds.length })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
