import { supabaseAdmin } from "./supabase.ts"
import { geminiChat } from "./gemini.ts"
import { groqChat } from "./groq.ts"
import { nimChat } from "./nim.ts"
import { cfChat, cfChatAvailable } from "./cfChat.ts"
import { aiKalitBormi } from "./aiKalit.ts"
import { sarfYoz } from "./aiKesh.ts"
import {
  otkazSababi,
  PLATFORMALAR,
  promptYasa,
  qisqartir,
  skipmi,
  tozala,
  ZAXIRA_SOZLAMA,
  type IzohSozlama,
  type IzohTil,
  type Platforma,
} from "./izohMatn.ts"

/**
 * YOUTUBE IZOHIGA JAVOB — AI VA SOZLAMALAR.
 *
 * Alohida modul, `youtube-manage/index.ts` ichida emas — chunki uni
 * IKKI joy ishlatadi: paneldagi "AI javob" tugmasi va soatiga bir
 * marta ishlaydigan avtomatik yurish. `Deno.serve` bo'lgan faylni
 * import qilib bo'lmaydi, ya'ni umumiy kod shu yerda turishi shart.
 *
 * Sof mantiq `izohMatn.ts` da — u testdan o'tadi (bu fayl esa
 * `supabase.ts` ni import qilgani uchun testda yuklanmaydi).
 */

export type { IzohSozlama, IzohTil, Platforma }
export { ZAXIRA_SOZLAMA }

/* ==========================================================================
   SOZLAMALAR
   ========================================================================== */

/** Sonni chegara ichiga qamaydi — sozlamaga qo'lda yozilgan qiymat ishonchsiz */
function sonChegara(v: unknown, zaxira: number, eng: number, kop: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return zaxira
  return Math.min(kop, Math.max(eng, Math.round(n)))
}

/** Har tarmoq uchun alohida yoqish kaliti */
const AVTO_KALIT = (p: Platforma) => `izoh_avto_${p}`

export const SOZLAMA_KALITLARI = [
  ...PLATFORMALAR.map(AVTO_KALIT),
  "izoh_ohang",
  "izoh_til",
  "izoh_limit",
  "izoh_uzunlik",
]

/**
 * Sozlamalarni `public_settings` dan o'qiydi.
 *
 * Bazaga yetib bo'lmasa ZAXIRA qiymatlar qaytadi va ularda `avto`
 * O'CHIQ: sozlamani o'qiy olmagan holatda kanal nomidan avtomatik
 * javob yuborish — eng xavfli xatti-harakat.
 */
export async function sozlamalarOl(): Promise<IzohSozlama> {
  try {
    const { data } = await supabaseAdmin
      .from("public_settings")
      .select("key, value")
      .in("key", SOZLAMA_KALITLARI)
      .is("deleted_at", null)

    const m = new Map((data || []).map((r: { key: string; value: string }) => [r.key, r.value]))
    const til = String(m.get("izoh_til") || "auto")
    const avto = { ...ZAXIRA_SOZLAMA.avto }
    for (const p of PLATFORMALAR) avto[p] = String(m.get(AVTO_KALIT(p)) || "false") === "true"
    return {
      avto,
      ohang: String(m.get("izoh_ohang") || "").trim().slice(0, 1000),
      til: (["auto", "uz", "ru", "en"].includes(til) ? til : "auto") as IzohTil,
      limit: sonChegara(m.get("izoh_limit"), 20, 1, 50),
      uzunlik: sonChegara(m.get("izoh_uzunlik"), 200, 60, 500),
    }
  } catch {
    return { ...ZAXIRA_SOZLAMA }
  }
}

/**
 * Bitta sozlamani yozadi. Noma'lum kalit jimgina rad etiladi.
 *
 * `.select()` SHART: mos qator topilmasa `update` xato QAYTARMAYDI,
 * shunchaki nol qator o'zgartiradi. Usiz funksiya "yozdim" deb
 * qaytarardi va panel avtomatik rejim yoqilgan deb ko'rsatib turardi,
 * aslida esa sozlama o'zgarmagan bo'lardi (masalan migratsiya
 * qo'llanmagan bo'lsa).
 */
export async function sozlamaYoz(kalit: string, qiymat: string): Promise<boolean> {
  if (!SOZLAMA_KALITLARI.includes(kalit)) return false
  const { data, error } = await supabaseAdmin
    .from("public_settings")
    .update({ value: qiymat, updated_at: new Date().toISOString() })
    .eq("key", kalit)
    .is("deleted_at", null)
    .select("key")
  return !error && (data?.length ?? 0) > 0
}

/* ==========================================================================
   PROVAYDERLAR ZANJIRI
   ==========================================================================
   Tartib `smm-ai` dagi bilan bir xil sababga ko'ra: Cloudflare matnda
   arzon va tez, Gemini sifatli lekin kvotasi kam, Groq zaxira,
   NVIDIA sekin.

   Zanjir uchun UMUMIY vaqt chegarasi bor: bittasi osilib qolsa
   qolganlariga vaqt qolishi kerak, aks holda avtomatik yurish bitta
   izohda tiqilib qolardi va qolgan izohlar javobsiz qolardi.
   ========================================================================== */

type ChatFn = (
  p: string,
  o?: { maxTokens?: number; timeoutMs?: number },
) => Promise<{ text: string; tokens: number }>

const ZANJIR: { nom: string; fn: ChatFn; timeout: number }[] = [
  { nom: "Cloudflare", fn: cfChat as ChatFn, timeout: 20_000 },
  { nom: "Gemini", fn: geminiChat as ChatFn, timeout: 15_000 },
  { nom: "Groq", fn: groqChat as ChatFn, timeout: 15_000 },
  { nom: "NVIDIA", fn: nimChat as ChatFn, timeout: 25_000 },
]

/** Butun zanjir uchun chegara — bitta izohga bir daqiqadan ko'p ketmasin */
const ZANJIR_BUDGET_MS = 45_000
/** Sinashga arzimaydigan qoldiq vaqt */
const ENG_KAM_MS = 5_000

async function kalitBormi(nom: string): Promise<boolean> {
  if (nom === "Cloudflare") return cfChatAvailable()
  if (nom === "Gemini") return await aiKalitBormi("gemini", "GEMINI_API_KEY")
  if (nom === "Groq") return await aiKalitBormi("groq", "GROQ_API_KEY")
  if (nom === "NVIDIA") return await aiKalitBormi("nvidia", "NVIDIA_API_KEY")
  return false
}

export type JavobNatija =
  | { holat: "javob"; matn: string; provayder: string }
  | { holat: "otkaz"; sabab: string }
  | { holat: "xato"; sabab: string }

/**
 * Izohga javob yozadi.
 *
 * Uchta natija bo'lishi mumkin va uchalasi ham NORMAL:
 *   javob  — matn tayyor
 *   otkaz  — bu izohga javob yozmaslik kerak (arzon tekshiruv yoki AI)
 *   xato   — provayderlarning hech biri ishlamadi
 *
 * Chaqiruvchi uchalasini ham bazaga yozadi, shuning uchun bu funksiya
 * hech qachon istisno otmaydi: avtomatik yurish bitta izoh sababli
 * to'xtab qolmasligi kerak.
 */
export async function javobYoz(q: {
  izoh: string
  muallif?: string
  videoSarlavha?: string
  sozlama: IzohSozlama
  platforma?: Platforma
}): Promise<JavobNatija> {
  const sabab = otkazSababi(q.izoh)
  if (sabab) return { holat: "otkaz", sabab }

  const prompt = promptYasa({
    izoh: q.izoh.trim().slice(0, 1200),
    muallif: (q.muallif || "").slice(0, 60),
    videoSarlavha: (q.videoSarlavha || "").slice(0, 120),
    sozlama: q.sozlama,
    platforma: q.platforma,
  })

  const oxiri = Date.now() + ZANJIR_BUDGET_MS
  const xatolar: string[] = []

  for (const p of ZANJIR) {
    const qoldi = oxiri - Date.now()
    if (qoldi < ENG_KAM_MS) break
    if (!(await kalitBormi(p.nom))) continue

    const boshlandi = Date.now()
    try {
      const r = await p.fn(prompt, {
        // Javob qisqa: 300 token har qanday tilda 200 belgiga yetadi
        maxTokens: 300,
        timeoutMs: Math.min(p.timeout, qoldi),
      })
      const matn = tozala(r.text)
      await sarfYoz({
        provayder: p.nom,
        vazifa: `izoh-${q.platforma || "youtube"}`,
        muvaffaqiyat: true,
        tokenlar: r.tokens,
        matnUzunligi: matn.length,
        davomiylik: Date.now() - boshlandi,
      })

      if (!matn) { xatolar.push(`${p.nom}: bo'sh javob`); continue }
      if (skipmi(matn)) return { holat: "otkaz", sabab: "AI javob berishni tavsiya qilmadi" }
      return { holat: "javob", matn: qisqartir(matn, q.sozlama.uzunlik), provayder: p.nom }
    } catch (e) {
      const xato = e instanceof Error ? e.message : "xatolik"
      xatolar.push(`${p.nom}: ${xato}`)
      await sarfYoz({
        provayder: p.nom,
        vazifa: `izoh-${q.platforma || "youtube"}`,
        muvaffaqiyat: false,
        davomiylik: Date.now() - boshlandi,
        xato,
      })
    }
  }

  return { holat: "xato", sabab: xatolar.join(" | ") || "Hech bir AI provayder sozlanmagan" }
}
