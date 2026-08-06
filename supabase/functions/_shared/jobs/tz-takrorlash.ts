import { supabaseAdmin } from "../supabase.ts"
import { keyingiVaqt, type Takror } from "../takrorlash.ts"

/**
 * TAKRORLANUVCHI TZ — KEYINGI DAVRNI YARATADI.
 *
 * Hamkor "har kuni / har hafta / har oy" bajariladigan TZ bergan
 * bo'lsa, har davr uchun ALOHIDA topshiriq kerak. Bitta topshiriqni
 * qayta ishlatib bo'lmaydi: bloger bir marta "bajarildi" bosgach u
 * abadiy bajarilgan bo'lib turaverardi va takrorlanishning ma'nosi
 * qolmasdi.
 *
 * Har davrda:
 *   1) yangi `blogger_tasks` (o'sha matn, yangi boshlanish vaqti)
 *   2) o'sha blogerlarga biriktirish (holat qaytadan "new")
 *   3) TZ bandlarining YANGI nusxasi (holat qaytadan "pending")
 *
 * Ruxsat `jobs` dispatcheri tomonidan tekshiriladi (cron maxfiy
 * kaliti yoki admin tokeni) — bu modul faqat ishni bajaradi.
 *
 * Soatiga bir marta ishlaydi. Aniq daqiqagacha aniqlik shart emas:
 * "har kuni" degan TZ uchun bir soatlik farq ahamiyatsiz, lekin
 * daqiqada bir marta ishlash bekorga yuk bo'lardi.
 */
export async function run(): Promise<Record<string, unknown>> {
  const hozir = new Date()
  const bugun = hozir.toISOString().slice(0, 10)

  const { data: brieflar, error } = await supabaseAdmin
    .from("partner_briefs")
    .select("id, partner_id, takrorlanish, keyingi, tugash, task_id")
    .neq("takrorlanish", "bir_marta")
    .not("keyingi", "is", null)
    .lte("keyingi", hozir.toISOString())
    .not("task_id", "is", null)          // hali blogerlarga yuborilmagan bo'lsa takrorlanmaydi
    .is("deleted_at", null)
    .limit(100)
  if (error) throw new Error(error.message)

  let yaratildi = 0
  let tugatildi = 0
  const xatolar: string[] = []

  for (const b of (brieflar || []) as Record<string, unknown>[]) {
    const takror = String(b.takrorlanish) as Takror
    const briefId = b.id as string

    try {
      /**
       * MUDDAT TUGAGAN BO'LSA TO'XTATAMIZ.
       *
       * `keyingi` ni null qilamiz — shundan keyin bu so'rov ro'yxatga
       * umuman tushmaydi va har soatda bekorga tekshirilmaydi.
       */
      if (b.tugash && String(b.tugash) < bugun) {
        await supabaseAdmin.from("partner_briefs").update({ keyingi: null }).eq("id", briefId)
        tugatildi++
        continue
      }

      // Oxirgi takrorni namuna sifatida olamiz
      const { data: oxirgi } = await supabaseAdmin
        .from("blogger_tasks")
        .select("id, title, description, priority, deadline, file_url, file_name, takror_raqami")
        .eq("brief_id", briefId)
        .is("deleted_at", null)
        .order("takror_raqami", { ascending: false })
        .limit(1)
        .maybeSingle()

      /**
       * Eski so'rovlarda `brief_id` bo'lmasligi mumkin (bu ustun
       * keyinroq qo'shilgan) — unda `partner_briefs.task_id` orqali
       * topamiz. Aks holda takrorlash birinchi davrdayoq to'xtardi.
       */
      let namuna = oxirgi as Record<string, unknown> | null
      if (!namuna && b.task_id) {
        const { data } = await supabaseAdmin
          .from("blogger_tasks")
          .select("id, title, description, priority, deadline, file_url, file_name, takror_raqami")
          .eq("id", b.task_id as string).is("deleted_at", null).maybeSingle()
        namuna = data as Record<string, unknown> | null
      }
      if (!namuna) { xatolar.push(`${briefId}: namuna topshiriq yo'q`); continue }

      const boshlanish = new Date(String(b.keyingi))
      const raqam = Number(namuna.takror_raqami || 1) + 1

      const { data: yangi, error: tErr } = await supabaseAdmin
        .from("blogger_tasks")
        .insert({
          title: namuna.title,
          description: namuna.description,
          priority: namuna.priority,
          // Muddat har davrda siljiydi: eski sana yangi davrga to'g'ri
          // kelmaydi va bloger darhol "kechikkan" bo'lib qolardi
          deadline: null,
          file_url: namuna.file_url,
          file_name: namuna.file_name,
          brief_id: briefId,
          boshlanish: boshlanish.toISOString(),
          takror_raqami: raqam,
        })
        .select("id")
        .single()
      if (tErr || !yangi) { xatolar.push(`${briefId}: ${tErr?.message || "topshiriq yaratilmadi"}`); continue }

      // O'sha blogerlarga qaytadan biriktiramiz
      const { data: eskiBiriktirma } = await supabaseAdmin
        .from("blogger_task_assignments")
        .select("blogger_id")
        .eq("task_id", namuna.id as string)
        .is("deleted_at", null)

      const blogerlar = [...new Set(((eskiBiriktirma || []) as { blogger_id: string }[]).map((x) => x.blogger_id))]
      if (blogerlar.length) {
        const { error: aErr } = await supabaseAdmin.from("blogger_task_assignments").insert(
          blogerlar.map((bid) => ({ task_id: yangi.id, blogger_id: bid, status: "new" })),
        )
        if (aErr) xatolar.push(`${briefId}: biriktirish — ${aErr.message}`)
      }

      /**
       * BANDLARNING YANGI NUSXASI.
       *
       * Eski davr bandlari o'z holatida qoladi (hisobotda "1-davrda
       * nima bajarildi" ko'rinadi), yangi davr esa toza boshlanadi.
       */
      const { data: bandlar } = await supabaseAdmin
        .from("partner_tasks")
        .select("title, sort_order")
        .eq("brief_id", briefId)
        .eq("task_id", namuna.id as string)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })

      if ((bandlar || []).length) {
        const { error: bErr } = await supabaseAdmin.from("partner_tasks").insert(
          ((bandlar || []) as { title: string; sort_order: number }[]).map((x) => ({
            partner_id: b.partner_id,
            brief_id: briefId,
            task_id: yangi.id,
            title: x.title,
            status: "pending",
            sort_order: x.sort_order,
          })),
        )
        if (bErr) xatolar.push(`${briefId}: bandlar — ${bErr.message}`)
      }

      /**
       * KEYINGI VAQTNI SURAMIZ.
       *
       * Boshlangan vaqtdan emas, REJALASHTIRILGAN vaqtdan suriladi:
       * ish bir necha soat kech ishga tushsa ham jadval siljib
       * ketmasligi kerak.
       *
       * Uzoq to'xtab qolgan bo'lsa (masalan bir hafta) — o'tib
       * ketgan davrlarni birma-bir yaratmaymiz, faqat kelajakdagi
       * eng yaqin vaqtga suramiz. Aks holda bir kunda blogerga
       * yettita bir xil topshiriq tushardi.
       */
      let keyingi = keyingiVaqt(boshlanish, takror)
      while (keyingi && keyingi.getTime() <= hozir.getTime()) {
        keyingi = keyingiVaqt(keyingi, takror)
      }
      await supabaseAdmin.from("partner_briefs")
        .update({ keyingi: keyingi ? keyingi.toISOString() : null })
        .eq("id", briefId)

      yaratildi++
    } catch (e) {
      xatolar.push(`${briefId}: ${e instanceof Error ? e.message : e}`)
    }
  }

  return { korildi: (brieflar || []).length, yaratildi, tugatildi, xatolar }
}
