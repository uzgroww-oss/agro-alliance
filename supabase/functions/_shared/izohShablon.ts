import { supabaseAdmin } from "./supabase.ts"
import { PLATFORMALAR } from "./izohMatn.ts"
import { shablonTanla, type Shablon } from "./izohShablonMatn.ts"

/**
 * TAYYOR JAVOBLAR — BAZA QATLAMI.
 *
 * Sof moslashtirish mantiqi `izohShablonMatn.ts` da (u testdan
 * o'tadi). Bu yerda faqat o'qish/yozish.
 */

export type { Shablon }

const MAYDONLAR = "id, savol, javob, platform, faol, ishlatilgan, oxirgi_ishlatilgan, created_at"

/** Panel uchun: hamma shablon, yangisi tepada */
export async function shablonlarOl(): Promise<Shablon[]> {
  const { data, error } = await supabaseAdmin
    .from("izoh_shablon")
    .select(MAYDONLAR)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) {
    console.error("shablonlarOl:", error.message)
    return []
  }
  return (data || []) as Shablon[]
}

/**
 * Izohga mos shablonni topadi.
 *
 * XATO BO'LSA `null` — ya'ni oqim AI ga o'tadi. Shablon topilmagani
 * normal holat, shuning uchun bu yerda istisno otilmaydi: baza
 * javob bermagani izohni javobsiz qoldirmasligi kerak.
 */
export async function mosShablon(izoh: string, platforma: string): Promise<Shablon | null> {
  const { data, error } = await supabaseAdmin
    .from("izoh_shablon")
    .select("id, savol, javob, platform, faol")
    .is("deleted_at", null)
    .eq("faol", true)
    // Umumiy (null) va shu tarmoqniki — qolgani kerak emas
    .or(`platform.is.null,platform.eq.${platforma}`)
    .limit(200)
  if (error) {
    console.error("mosShablon:", error.message)
    return null
  }
  return shablonTanla((data || []) as Shablon[], izoh, platforma)
}

/**
 * Ishlatilganini belgilaydi — qaysi shablon haqiqatan foydali
 * ekanini panelda ko'rish uchun.
 *
 * Javob KUTILMAYDI va xato yutiladi: bu hisob-kitob, uning
 * yiqilishi javob yuborishga to'sqinlik qilmasligi kerak.
 */
export async function ishlatildi(id: string): Promise<void> {
  try {
    await supabaseAdmin.rpc("izoh_shablon_ishlatildi", { p_id: id })
  } catch (e) {
    console.error("shablon ishlatildi:", e instanceof Error ? e.message : e)
  }
}

function platformaTogrimi(v: unknown): string | null {
  const s = String(v ?? "").trim()
  if (!s || s === "hammasi") return null
  return (PLATFORMALAR as readonly string[]).includes(s) ? s : null
}

/** Yangi shablon yoki mavjudini tahrirlash */
export async function shablonSaqla(q: {
  id?: string
  savol: string
  javob: string
  platform?: unknown
  faol?: boolean
  user?: string
}): Promise<{ ok: boolean; xato?: string }> {
  const savol = q.savol.trim().slice(0, 300)
  const javob = q.javob.trim().slice(0, 1000)
  if (savol.length < 2) return { ok: false, xato: "Savol juda qisqa" }
  if (javob.length < 2) return { ok: false, xato: "Javob juda qisqa" }

  const qator = {
    savol,
    javob,
    platform: platformaTogrimi(q.platform),
    faol: q.faol ?? true,
    updated_at: new Date().toISOString(),
  }

  if (q.id) {
    const { error } = await supabaseAdmin
      .from("izoh_shablon").update(qator).eq("id", q.id).is("deleted_at", null)
    if (error) { console.error("shablonSaqla update:", error.message); return { ok: false, xato: "Saqlab bo'lmadi" } }
    return { ok: true }
  }

  const { error } = await supabaseAdmin
    .from("izoh_shablon").insert({ ...qator, created_by: q.user || null })
  if (error) { console.error("shablonSaqla insert:", error.message); return { ok: false, xato: "Saqlab bo'lmadi" } }
  return { ok: true }
}

/**
 * YUMSHOQ o'chirish: `deleted_at` qo'yiladi.
 *
 * Qatorni butunlay o'chirmaymiz — `izoh_javob` da o'sha shablon bilan
 * yuborilgan javoblar bor va keyin "bu matn qayerdan chiqqan" degan
 * savolga javob topib bo'lmay qolardi.
 */
export async function shablonOchir(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("izoh_shablon")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id).is("deleted_at", null)
    .select("id")
  return !error && (data?.length ?? 0) > 0
}
