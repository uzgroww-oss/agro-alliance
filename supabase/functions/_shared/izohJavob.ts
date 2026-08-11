import { supabaseAdmin } from "./supabase.ts"
// Faqat Gemini — sabab pastda, PROVAYDERLAR ZANJIRI izohida.
import { geminiChat } from "./gemini.ts"
import { ishlatildi, mosShablon } from "./izohShablon.ts"
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
   FAQAT GEMINI — tahririyat qarori.

   Ilgari to'rtta provayder zanjiri edi (Cloudflare -> Gemini -> Groq
   -> NVIDIA). Matn sifati provayderdan provayderga sezilarli farq
   qilardi: izoh javobi kanal nomidan OMMAVIY chiqadi, ya'ni bu yerda
   "ishlasa bo'ldi" emas, bir xil va bashorat qilinadigan ohang
   muhimroq. Zaxira provayder tushib qolgan javob boshqacha uslubda
   chiqib, tomoshabinga sezilardi.

   ⚠️ NARXI: zaxira YO'Q. Gemini kvotasi tugasa yoki kaliti
   ishlamasa — javob YOZILMAYDI. Bu jimgina o'tmaydi: holat `xato`
   bo'lib bazaga sababi bilan yoziladi va panelda ko'rinadi, izoh
   esa javobsiz qoladi (keyingi yurishda qayta urinilmaydi — yozuv
   allaqachon bor, qo'lda "AI javob" bosish kerak).

   Boshqa provayderni qaytarish kerak bo'lsa: importni tiklab, shu
   ro'yxatga bitta qator qo'shing va `kalitBormi` ga tegishli
   tarmoqni yozing. Qolgan mantiq o'zgarishsiz ishlaydi.

   Zanjir uchun UMUMIY vaqt chegarasi qoladi: model osilib qolsa
   avtomatik yurish bitta izohda tiqilib qolmasligi kerak.
   ========================================================================== */

type ChatFn = (
  p: string,
  o?: { maxTokens?: number; timeoutMs?: number },
) => Promise<{ text: string; tokens: number }>

/**
 * Chegara 15 -> 25 soniya. Ilgari Gemini sekinlik qilsa Cloudflare yoki
 * Groq javobni ushlab qolardi; endi ortida hech kim yo'q, shuning uchun
 * unga ko'proq vaqt beriladi. 45 soniyalik umumiy byudjetga sig'adi.
 */
const ZANJIR: { nom: string; fn: ChatFn; timeout: number }[] = [
  { nom: "Gemini", fn: geminiChat as ChatFn, timeout: 25_000 },
]

/** Butun zanjir uchun chegara — bitta izohga bir daqiqadan ko'p ketmasin */
const ZANJIR_BUDGET_MS = 45_000
/** Sinashga arzimaydigan qoldiq vaqt */
const ENG_KAM_MS = 5_000

async function kalitBormi(nom: string): Promise<boolean> {
  if (nom === "Gemini") return await aiKalitBormi("gemini", "GEMINI_API_KEY")
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

  /**
   * TAYYOR JAVOB — AI DAN OLDIN.
   *
   * Izohlarning katta qismi bir xil savol ("narxi qancha",
   * "hamkorlik qilasizmi"). Tahririyat javobni bir marta yozib
   * qo'yadi va o'sha savol uchraganda AYNAN o'sha matn ketadi.
   *
   * NEGA AI DAN OLDIN, keyin emas:
   *   - bir xil savolga bir xil javob kafolatlanadi (AI har safar
   *     boshqacha yozardi va kanal nomidan chiqadigan matn uchun bu
   *     yomon);
   *   - AI aynan shu savollarga javob BERA OLMAYDI — prompt narx,
   *     manzil va yetkazib berishni ataylab taqiqlaydi, ya'ni u
   *     baribir SKIP qaytarardi va izoh javobsiz qolardi;
   *   - Gemini so'rovi ketmaydi: tekin, bir zumda va kvota tejaladi
   *     (zaxira provayder yo'q).
   *
   * ARZON FILTRDAN KEYIN turadi: spam izohga shablon bilan javob
   * berishning ma'nosi yo'q.
   *
   * Xato bo'lsa oqim AI ga o'tadi — `mosShablon` istisno otmaydi.
   */
  const shablon = await mosShablon(q.izoh, q.platforma || "youtube")
  if (shablon) {
    // Javob KUTILMAYDI: bu hisob-kitob, javob yuborishni ushlab
    // turmasligi kerak
    void ishlatildi(shablon.id)
    return { holat: "javob", matn: shablon.javob, provayder: "Shablon" }
  }

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
        /**
         * 300 EMAS, 1200.
         *
         * Javobning O'ZI qisqa — 300 token har qanday tilda 200
         * belgiga yetadi va uzunlikni baribir `qisqartir` cheklaydi.
         * Lekin Gemini 2.5 javobdan oldin ichki mulohaza yuritadi va
         * u ham SHU byudjetdan yeydi. 300 bilan mulohaza butun
         * byudjetni yeb, matnga 15-30 belgi qolardi:
         *   "Rahmat, Bekzod!"  /  "Salom, Sardor! Oʻgʻit nar"
         *
         * Mulohazani o'chirish sinab ko'rildi (thinkingConfig) —
         * Gemini 400 qaytardi. Shuning uchun byudjet kengaytirildi.
         * Qo'shimcha token faqat mulohazaga ketadi, javob uzunligiga
         * ta'sir qilmaydi.
         */
        maxTokens: 1200,
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
