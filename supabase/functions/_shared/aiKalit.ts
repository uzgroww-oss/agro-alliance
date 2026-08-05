import { supabaseAdmin } from "./supabase.ts"

/**
 * AI KALITLARI: avval PANELDAN qo'shilgani, bo'lmasa muhit o'zgaruvchisi.
 *
 * NEGA: ilgari kalit faqat Supabase Secrets'da (Deno env) edi. Kalit
 * tugasa yoki kvota bitsa, muharrir hech narsa qila olmasdi — terminal
 * kerak edi. Endi paneldan yangi kalit qo'shiladi va AI darhol ishlaydi.
 *
 * MUHIT O'ZGARUVCHISI TASHLANMADI: hozirgi ishlayotgan sozlama shunday
 * turibdi va uni buzish AI ni butunlay o'chirib qo'yardi. Panel kaliti
 * bor bo'lsa — u ustun; yo'q bo'lsa — eskisi ishlaydi.
 */

/** Izolyat ichidagi kesh: har chaqiruvda bazaga bormaslik uchun */
const kesh = new Map<string, { qiymat: string | null; vaqt: number }>()
const KESH_MS = 60_000

export async function aiKalit(provayder: string, envNom: string): Promise<string | null> {
  const bor = kesh.get(provayder)
  if (bor && Date.now() - bor.vaqt < KESH_MS) return bor.qiymat

  let qiymat: string | null = null
  try {
    const { data } = await supabaseAdmin.rpc("ai_key_olish", { p_provayder: provayder })
    if (typeof data === "string" && data.trim()) qiymat = data.trim()
  } catch (e) {
    // Baza javob bermasa muhit o'zgaruvchisiga tushamiz — AI to'xtamasin
    console.error(`aiKalit ${provayder}:`, e instanceof Error ? e.message : e)
  }

  if (!qiymat) qiymat = Deno.env.get(envNom) || null
  kesh.set(provayder, { qiymat, vaqt: Date.now() })
  return qiymat
}

/**
 * Kalit bormi — AI ni chaqirmasdan tekshirish uchun.
 *
 * Bu SINXRON emas: panel kaliti bazada. Chaqiruvchilar `await` qilishi
 * kerak, shuning uchun eski sinxron `Boolean(Deno.env.get(...))`
 * tekshiruvlari o'z joyida qoldirildi va bu faqat yangi joylarda
 * ishlatiladi.
 */
export async function aiKalitBormi(provayder: string, envNom: string): Promise<boolean> {
  return Boolean(await aiKalit(provayder, envNom))
}

/** Kalit ishlatilganini belgilaydi — panelda "oxirgi ishlatilgan" ko'rinadi */
export function kalitIshlatildi(provayder: string, xato?: string): void {
  try {
    supabaseAdmin.from("ai_keys")
      .update({ ishlatilgan: new Date().toISOString(), oxirgi_xato: xato ? xato.slice(0, 200) : null })
      .eq("provayder", provayder)
      .eq("faol", true)
      .then(() => {}, () => {})
  } catch { /* ixtiyoriy */ }
}
