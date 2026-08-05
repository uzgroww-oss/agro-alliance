import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * admin-tasks-list — Yuborilgan TZ'lar ro'yxati + har birining holat statistikasi.
 * DELETE ?id=... — TZ'ni o'chirish.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const op = url.searchParams.get("op")

    /* ================================================================
     * HAMKORLARDAN KELGAN TZ SO'ROVLARI
     *
     * Ilgari hamkor kompaniya "shunaqa reklama kerak" deb telefon
     * yoki Telegram orqali aytardi — tizimda iz qolmasdi. Endi
     * so'rov shu yerda ko'rinadi va aynan shundan blogerlarga
     * topshiriq yaratiladi.
     *
     * Alohida edge funksiya EMAS: limit (~100) yaqin, shuning uchun
     * amallar mavjud funksiyaga `?op=` bilan qo'shildi.
     * ================================================================ */
    if (op === "briefs") {
      const { data, error } = await supabaseAdmin
        .from("partner_briefs")
        .select("id, partner_id, title, description, priority, deadline, file_url, file_name, status, admin_note, task_id, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200)
      if (error) return errorResponse(error.message, 500)

      // Kompaniya nomi — TZ kimdan kelganini ko'rsatish uchun
      const pids = [...new Set((data || []).map((b) => b.partner_id as string))]
      const nomlar: Record<string, string> = {}
      if (pids.length) {
        const { data: ps } = await supabaseAdmin
          .from("partners").select("id, name").in("id", pids)
        for (const p of (ps || []) as { id: string; name: string }[]) nomlar[p.id] = p.name || "—"
      }

      return jsonResponse({
        briefs: (data || []).map((b) => ({ ...b, partner_name: nomlar[b.partner_id as string] || "—" })),
      })
    }

    /* TZ so'rovining holatini o'zgartirish (ko'rildi / rad etildi) */
    if (op === "brief-update" && (req.method === "POST" || req.method === "PATCH")) {
      const body = await req.json().catch(() => ({}))
      const id = String(body.id || "")
      if (!id) return errorResponse("id talab qilinadi", 400)

      const yangilash: Record<string, unknown> = {}
      if (["new", "seen", "sent", "rejected"].includes(String(body.status))) {
        yangilash.status = String(body.status)
      }
      if (typeof body.admin_note === "string") {
        yangilash.admin_note = body.admin_note.trim().slice(0, 2000) || null
      }
      if (!Object.keys(yangilash).length) return errorResponse("O'zgartirish yo'q", 400)

      const { error } = await supabaseAdmin.from("partner_briefs").update(yangilash).eq("id", id)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    if (op === "brief-delete" && req.method === "DELETE") {
      const id = url.searchParams.get("id")
      if (!id) return errorResponse("id talab qilinadi", 400)
      const { error } = await supabaseAdmin.from("partner_briefs")
        .update({ deleted_at: new Date().toISOString() }).eq("id", id)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    if (req.method === "DELETE") {
      const id = url.searchParams.get("id")
      if (!id) return errorResponse("id talab qilinadi", 400)
      const { error } = await supabaseAdmin.from("blogger_tasks")
        .update({ deleted_at: new Date().toISOString() }).eq("id", id)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ success: true })
    }

    const { data: tasks, error } = await supabaseAdmin
      .from("blogger_tasks")
      .select("id, title, description, priority, deadline, file_url, file_name, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
    if (error) return errorResponse(error.message, 500)

    const taskIds = (tasks || []).map((t: { id: string }) => t.id)
    const statsMap: Record<string, { total: number; new: number; in_progress: number; done: number }> = {}
    // Har bir TZ uchun bloger ismi + holati (admin kim bajarayotganini ko'rsin)
    const bloggersMap: Record<string, Array<{ id: string; name: string; status: string }>> = {}

    if (taskIds.length > 0) {
      const { data: assigns } = await supabaseAdmin
        .from("blogger_task_assignments")
        .select("task_id, status, blogger_id")
        .in("task_id", taskIds)
        .is("deleted_at", null)

      const rows = (assigns || []) as Array<{ task_id: string; status: string; blogger_id: string }>

      // Ismlarni alohida so'rov bilan olamiz (FK nomiga bog'lanib qolmaslik uchun)
      const nameById: Record<string, string> = {}
      const ids = [...new Set(rows.map((r) => r.blogger_id))]
      if (ids.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, name")
          .in("id", ids)
        for (const p of (profs || []) as Array<{ id: string; name: string }>) {
          nameById[p.id] = p.name || "—"
        }
      }

      for (const a of rows) {
        const s = statsMap[a.task_id] || { total: 0, new: 0, in_progress: 0, done: 0 }
        s.total++
        if (a.status === "in_progress") s.in_progress++
        else if (a.status === "done") s.done++
        else s.new++
        statsMap[a.task_id] = s

        if (!bloggersMap[a.task_id]) bloggersMap[a.task_id] = []
        bloggersMap[a.task_id].push({
          id: a.blogger_id,
          name: nameById[a.blogger_id] || "—",
          status: a.status,
        })
      }

      // Tartib: bajarilmoqda → yangi → bajarildi, keyin ism bo'yicha
      const order: Record<string, number> = { in_progress: 0, new: 1, done: 2 }
      for (const k of Object.keys(bloggersMap)) {
        bloggersMap[k].sort((x, y) =>
          (order[x.status] ?? 9) - (order[y.status] ?? 9) || x.name.localeCompare(y.name))
      }
    }

    const result = (tasks || []).map((t: Record<string, unknown>) => ({
      ...t,
      stats: statsMap[t.id as string] || { total: 0, new: 0, in_progress: 0, done: 0 },
      bloggers: bloggersMap[t.id as string] || [],
    }))

    return jsonResponse({ tasks: result })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
