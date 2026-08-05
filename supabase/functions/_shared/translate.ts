import { geminiJson } from "./gemini.ts";
import { groqJson } from "./groq.ts";
import { cfJson, cfChatAvailable } from "./cfChat.ts";
import { supabaseAdmin } from "./supabase.ts";

/**
 * KONTENT TARJIMASI: o'zbekcha -> ru / en / zh
 *
 * Admin panelidan kiritilgan kontent avtomatik tarjima qilinadi —
 * foydalanuvchi qo'lda hech narsa yozmaydi.
 *
 * Natija news_articles.translations kabi JSONB ustunlarga yoziladi:
 *   { "ru": {"title": "...", "excerpt": "..."}, "en": {...}, "zh": {...} }
 *
 * MUHIM: tarjima MAJBURIY EMAS. Yiqilsa bo'sh obyekt qaytadi va
 * kontent o'zbekcha ko'rinadi — saqlash amali BUZILMAYDI.
 */

export const TARGET_LANGS = ["ru", "en", "zh"] as const;
export type TargetLang = (typeof TARGET_LANGS)[number];

const LANG_NAME: Record<TargetLang, string> = {
  ru: "Russian",
  en: "English",
  zh: "Simplified Chinese",
};

/** Butun tarjima ishi uchun umumiy chegara */
const BUDGET_MS = 45_000;

export type Translations = Partial<Record<TargetLang, Record<string, string>>>;

/** Juda uzun matnni kesamiz — model chegarasi va vaqt uchun */
const MAX_FIELD = 6_000;

/**
 * Tarjima mantig'i versiyasi.
 *
 * Saqlangan tarjima shu versiyadan eski bo'lsa QAYTA tarjima qilinadi.
 * Kerak bo'ldi, chunki birinchi urinishda xitoycha buzuq yozilgan edi
 * va uni qayta yozishning boshqa yo'li yo'q — kod tarjimasi bor
 * yozuvni o'tkazib yuborardi.
 */
export const TR_VERSION = 9;

/**
 * "TARJIMA QILADIGAN NARSA YO'Q" javobi.
 *
 * Bo'sh natijaning IKKI xil sababi bor va ular bir xil emas:
 *   1) matn butunlay himoyalangan nomdan iborat ("AGRO ALLIANCE") —
 *      ish TUGAGAN, qayta urinish kerak emas;
 *   2) AI yiqildi yoki kvota tugadi — ish TUGAMAGAN, keyin qayta
 *      urinish kerak.
 * Birinchisida saqlangan eski tarjima O'CHIRILADI (u endi noto'g'ri),
 * ikkinchisida esa TEGILMAYDI. Farqni shu belgi bildiradi.
 */
export const BOSH_TAYYOR: Translations = Object.freeze(
  { _v: TR_VERSION } as unknown as Translations,
);

/**
 * QO'LDA TARJIMA QILINGAN YOZUV — AI UNGA TEGMAYDI.
 *
 * Saytdagi mavjud kontent qo'lda, sinchiklab tarjima qilingan.
 * AI ni har safar shu matnlarga qo'yib yuborish bir necha zarar
 * keltirardi:
 *   - tayyor, tekshirilgan tarjima har versiya o'zgarganda
 *     yomonroq variant bilan almashardi;
 *   - kvota bekorga sarflanardi;
 *   - "AGRICULTURE Partnership" kabi nuqsonlar qaytib kelardi.
 *
 * Endi AI faqat YANGI qo'shilgan yoki o'zgartirilgan kontentni
 * tarjima qiladi. Admin kontentni tahrirlasa, `translations` tozalanadi
 * va belgi ham yo'qoladi — ya'ni o'zgargan matn qaytadan tarjima
 * bo'ladi, bu to'g'ri.
 */
export function qoldaTarjimami(tr: unknown): boolean {
  return Boolean((tr as Record<string, unknown> | null)?._manual)
}

/** Natijada nechta TIL bor (xizmat maydonlari `_v`, `_p` sanalmaydi) */
function tillarSoni(t: unknown): number {
  const o = (t || {}) as Record<string, unknown>;
  return TARGET_LANGS.filter((l) => o[l]).length;
}

/**
 * Yangi natijani saqlangan tarjima bilan birlashtiradi.
 * Bazaga YOZILADIGAN yakuniy qiymatni qaytaradi.
 */
export function birlashtir(eski: unknown, yangi: Translations): Translations {
  const oldingi = (eski && typeof eski === "object" ? eski : {}) as Translations;
  const iz = (yangi as Record<string, unknown>)._p;

  if (tillarSoni(yangi) === 0) {
    // `_v` bor — tarjima qiladigan narsa yo'q edi (brend nomi).
    // Eskisi (buzuq bo'lishi mumkin) O'CHADI.
    if ("_v" in (yangi as Record<string, unknown>)) {
      return { ...BOSH_TAYYOR, _p: iz } as Translations;
    }
    // `_v` yo'q — AI yiqildi. Eskisi QOLADI, versiya yarim:
    // keyingi urinishda yana harakat qilinadi.
    return { ...oldingi, _v: TR_VERSION - 0.5, _p: iz } as Translations;
  }
  return { ...oldingi, ...yangi };
}

/**
 * Bu yozuv uchun qaysi tillar tarjima qilinishi kerak.
 *
 * Versiya YARIM bo'lsa (masalan 6.5) — o'tgan safar bir tilgina
 * chiqmagan, qolganlari joyida. Faqat yetishmaganini qilamiz, aks
 * holda har urinishda uchala til qaytadan tarjima qilinib, kvota
 * behuda sarflanardi.
 */
export function kerakliTillar(eski: unknown): readonly TargetLang[] {
  const o = (eski || {}) as Translations & { _v?: number };
  if (Number(o._v ?? 0) !== TR_VERSION - 0.5) return TARGET_LANGS;
  const yetishmagan = TARGET_LANGS.filter((l) => !o[l]);
  return yetishmagan.length ? yetishmagan : TARGET_LANGS;
}

/**
 * Bu matnni tarjima qilish KERAKMI?
 *
 * Brend nomlari va qisqa bosh harfli so'zlar ("AGRO", "ALLIANCE")
 * tarjima qilinganda ma'nosiz chiqadi: xitoychada "亞给", ruschada
 * kirillga transliteratsiya. Ularni tegmasdan qoldirgan yaxshiroq.
 */
function tarjimaKerakmi(v: string): boolean {
  const s = v.trim();
  if (s.length < 4) return false;
  if (!/[a-zA-ZЀ-ӿ]/.test(s)) return false; // harf yo'q (raqam, belgi)
  return true;
}

/**
 * Nomlar yashirilgandan KEYIN tarjima qiladigan narsa qoldimi?
 *
 * Masalan "AGRO ALLIANCE" butunlay himoyalangan nom — yashirilgach
 * "__BR0__" bo'lib qoladi. Bunga AI chaqirish behuda: javob baribir
 * o'sha belgi bo'ladi. Vaqt va kvota tejaladi.
 */
function yashiringachMatnBormi(v: string): boolean {
  return /[a-zA-ZЀ-ӿ]/.test(v.replace(/__BR\d+__/g, " "));
}

/**
 * Model javobi YAROQLIMI?
 *
 * Model ba'zan tarjima o'rniga axlat qaytaradi va uni bazaga yozib
 * qo'ysak, saytda o'sha axlat ko'rinadi. Haqiqiy misollar:
 *   {"title": "title"}          — qiymat o'rniga KALIT nomi
 *   "__BR0__ with Us!"          — tiklanmagan belgi (model uni
 *                                 o'zi o'ylab topgan)
 * Bunday javob butunlay rad etiladi: shu til yozilmaydi, yozuv
 * "yarim" deb belgilanadi va keyin qayta tarjima qilinadi.
 */
function javobYaroqlimi(tiklangan: Record<string, string>): boolean {
  for (const [k, v] of Object.entries(tiklangan)) {
    if (v.trim().toLowerCase() === k.toLowerCase()) return false;
    if (/__\s*BR\s*\d+\s*__/i.test(v)) return false;
  }
  return true;
}

/* ==========================================================================
   AI TANAFFUSI — KVOTA TUGAGANDA SAHIFANI SEKINLASHTIRMASLIK
   ==========================================================================
   MUAMMO EDI: tarjima ommaviy sahifa so'rovi ICHIDA bajariladi. Gemini
   kvotasi tugaganda har bir so'rov baribir AI ga urinardi — uch til,
   har biri qayta urinish bilan — va faqat shundan keyin javob
   qaytarardi. Natijada kvota tugagan paytda bosh sahifa bir necha
   soniyaga sekinlashardi, ustiga tarjima ham chiqmasdi. Ya'ni kutish
   bor edi, foyda yo'q.

   YECHIM: kvota xatosi kelgach AI bir muddat UMUMAN chaqirilmaydi.
   Sahifa darhol o'zbekcha qaytadi, tanaffus tugagach urinish o'zi
   qayta boshlanadi.
   ========================================================================== */

const TANAFFUS_MS = 15 * 60 * 1000;
let aiTanaffusGacha = 0;

/** AI hozir chaqirilmaydimi (kvota tugagan) */
export function aiTanaffusdami(): boolean {
  return Date.now() < aiTanaffusGacha;
}

/** Xato kvota/limit haqidami — shundagina tanaffus e'lon qilinadi */
function kvotaXatosimi(m: string): boolean {
  const s = m.toLowerCase();
  return s.includes("quota") || s.includes("exceeded") || s.includes("rate limit") ||
    s.includes("429") || s.includes("resource_exhausted");
}

/** Model ba'zan javobni <p>...</p> ichiga o'rab yuboradi — tozalaymiz */
function tozala(s: string): string {
  return s.replace(/^\s*<p>\s*/i, "").replace(/\s*<\/p>\s*$/i, "").trim();
}

/* ==========================================================================
   HIMOYALANGAN NOMLAR — HECH QACHON TARJIMA QILINMAYDI
   ==========================================================================
   MUAMMO: modelga "brend nomlarini tarjima qilma" deb aytish YETARLI
   EMAS edi. "Agro Alliance" ruschada "Агро Альянс", xitoychada esa
   ma'nosiz belgilarga aylanardi. Odamlar ismi va hamkor kompaniyalar
   nomi ham xuddi shunday buzilardi.

   YECHIM: nomlarni AI ga umuman ko'rsatmaymiz. Yuborishdan oldin ular
   `__BR0__` kabi belgilarga almashtiriladi, javob kelgach asl holiga
   qaytariladi. Model ularni o'zgartira olmaydi, chunki ko'rmaydi ham.
   ========================================================================== */

/**
 * Har doim himoyalanadigan nomlar.
 *
 * DIQQAT: bu yerga faqat HAQIQIY nomlar kiritiladi.
 * Yolg'iz "AGRO" va "ALLIANCE" ATAYLAB YO'Q — ular oddiy so'z sifatida
 * ham ishlatiladi ("agro blogerlar", "agro soha"). Ularni himoyalaganda
 * ruschada "Agroблогеры", xitoychada "Agro博客家人" kabi aralash so'zlar
 * chiqardi. Brend — bu TO'LIQ "Agro Alliance" iborasi.
 */
const BREND = [
  "AGRO ALLIANCE",
  "Agro Alliance",
  "Instagram",
  "Telegram",
  "YouTube",
  "Facebook",
  "TikTok",
  "LinkedIn",
];

/** Bazadan olinadigan nomlar (hamkorlar, jamoa, blogerlar) — izolyat ichida keshlanadi */
let nomKesh: string[] | null = null;
let nomKeshVaqti = 0;
const NOM_KESH_TTL = 10 * 60 * 1000;

async function himoyalangnNomlar(): Promise<string[]> {
  if (nomKesh && Date.now() - nomKeshVaqti < NOM_KESH_TTL) return nomKesh;
  const nomlar = new Set<string>(BREND);
  try {
    const [p, t, b] = await Promise.all([
      supabaseAdmin.from("partners").select("name").is("deleted_at", null).limit(300),
      supabaseAdmin.from("team_members").select("name").is("deleted_at", null).limit(300),
      supabaseAdmin.from("profiles").select("name").is("deleted_at", null).limit(500),
    ]);
    for (const r of [...(p.data || []), ...(t.data || []), ...(b.data || [])]) {
      const n = (r as { name?: string }).name?.trim();
      // Juda qisqa nomlar oddiy so'zlarga to'g'ri kelib qolishi mumkin
      if (n && n.length >= 3) nomlar.add(n);
    }
  } catch (e) {
    console.error("himoyalangnNomlar:", e instanceof Error ? e.message : e);
  }
  // Uzunidan qisqasiga — "Agro Alliance" "AGRO" dan oldin almashsin
  nomKesh = [...nomlar].sort((a, b) => b.length - a.length);
  nomKeshVaqti = Date.now();
  return nomKesh;
}

function qochirish(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Nomlarni belgilarga almashtiradi va qaytarish jadvalini beradi */
function nomlarniYashir(
  fields: Record<string, string>,
  nomlar: string[],
): { yashirilgan: Record<string, string>; jadval: Map<string, string> } {
  const jadval = new Map<string, string>();
  const yashirilgan: Record<string, string> = {};
  let n = 0;

  for (const [k, v] of Object.entries(fields)) {
    let matn = v;
    for (const nom of nomlar) {
      /**
       * SO'Z CHEGARASI SHART.
       *
       * Ilgari oddiy qidiruv edi va "AGRO" so'zi "agrotexnologiyalar"
       * ichida ham topilib, himoyalanib qolardi. Natijada ruscha
       * tarjimada "agroтехнологии" kabi aralash so'z chiqardi.
       * Endi faqat ALOHIDA so'z sifatida turgan nom almashtiriladi.
       */
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${qochirish(nom)})(?![\\p{L}\\p{N}])`, "giu");
      matn = matn.replace(re, (_m, oldin: string, topilgan: string) => {
        // Har xil yozilishi uchun alohida belgi — asl holat saqlanadi
        for (const [belgi, asl] of jadval) if (asl === topilgan) return oldin + belgi;
        const belgi = `__BR${n++}__`;
        jadval.set(belgi, topilgan);
        return oldin + belgi;
      });
    }
    yashirilgan[k] = matn;
  }
  return { yashirilgan, jadval };
}

/** Belgilarni asl nomlarga qaytaradi */
function nomlarniQaytar(s: string, jadval: Map<string, string>): string {
  let out = s;
  for (const [belgi, asl] of jadval) {
    // Model belgini biroz o'zgartirishi mumkin (bo'shliq, registr)
    out = out.replace(new RegExp(qochirish(belgi).replace(/_/g, "_\\s*"), "gi"), asl);
  }
  return out;
}

function buildPrompt(fields: Record<string, string>, lang: TargetLang): string {
  const target = LANG_NAME[lang];
  const payload = JSON.stringify(fields, null, 1);
  return [
    `Translate the following Uzbek website content into ${target}.`,
    "",
    "RULES:",
    `- Return ONLY a JSON object with exactly the same keys.`,
    `- Translate the VALUES into ${target}. Do not translate the keys.`,
    "- Keep the meaning and tone. This is agriculture / agro-media content.",
    // Qisqa sarlavhalar kontekstsiz noto'g'ri chiqardi: "TEZKOR
    // IMKONIYATLAR" -> "NEW OPPORTUNITIES", "BIZNING JAMOA" ->
    // "OUR COMMUNITY". Model matn qayerda turishini bilishi kerak.
    "- Short values are website section headings and button labels. Translate them as natural UI headings, not word-by-word.",
    "- Preserve letter case style: if the source is ALL CAPS, the translation is ALL CAPS too.",
    "- Do NOT translate brand names, people's names, or URLs — keep them as they are.",
    "- Tokens like __BR0__, __BR1__ are placeholders for names. Copy them EXACTLY, unchanged.",
    "- Keep any HTML tags, markdown and line breaks exactly as they appear.",
    "- Do not add commentary, notes or code fences.",
    "",
    "INPUT:",
    payload,
  ].join("\n");
}

/** Javob kutilgan kalitlarni o'z ichiga oladimi */
function valid(kalitlar: string[]) {
  return (v: unknown): boolean => {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    // Kamida bitta kalit tarjima qilingan bo'lsa qabul qilamiz —
    // model ba'zan bo'sh maydonni tashlab ketadi.
    return kalitlar.some((k) => typeof o[k] === "string" && (o[k] as string).trim().length > 0);
  };
}

/** Bitta tilga tarjima. Provayderlar zanjiri: biri yiqilsa keyingisi. */
async function translateTo(
  fields: Record<string, string>,
  lang: TargetLang,
  deadline: number,
  /**
   * TASHXIS: qaysi provayder javob berdi yoki nima sababdan yiqildi.
   * Natija bilan birga `_p` maydoniga yoziladi. Edge funksiya loglarini
   * o'qish imkoni yo'q, shusiz "nega tarjima chiqmadi?" degan savolga
   * javob topib bo'lmaydi — modelmi, kvotami, vaqtmi noma'lum qolardi.
   */
  sabab: string[],
): Promise<Record<string, string> | null> {
  const prompt = buildPrompt(fields, lang);
  const kalitlar = Object.keys(fields);
  const ok = valid(kalitlar);

  /**
   * TARTIB MUHIM: Gemini BIRINCHI.
   *
   * Ilgari Cloudflare birinchi edi va uning kichik modellari XITOYCHANI
   * buzib qo'yardi — "合李频粗学客, 平学人" kabi ma'nosiz belgilar
   * chiqardi. Ruscha va inglizcha yaxshi bo'lgani uchun muammo darrov
   * ko'rinmasdi. Gemini ko'p tilli matnda ancha ishonchli.
   * Cloudflare oxirgi zaxira sifatida qoladi.
   */
  const chain: { nom: string; ishla: (ms: number) => Promise<unknown> }[] = [
    { nom: "Gemini", ishla: (ms) => geminiJson(prompt, { retries: 1, maxTokens: 3000, timeoutMs: ms }) },
  ];

  /**
   * KICHIK MODELLAR TARJIMAGA ZAXIRA BO'LA OLMAYDI.
   *
   * Groq va Cloudflare zanjirda edi va natijasi shunday bo'lgan:
   *   "TEZKOR IMKONIYATLAR"  -> zh "平死约参子"   (ma'nosiz belgilar)
   *   "BIZNING ASOSLARIMIZ"  -> ru "НАШИ АССОСИИ" (mavjud bo'lmagan so'z)
   *   "BIZNING JAMOA"        -> ru "НАШ ПАРТНЁРСТВО"
   * Sabab: bu modellar o'zbek tilini deyarli bilmaydi. Xitoychada
   * muammo ko'zga tashlanardi, ruschada esa ishonarli ko'rinib,
   * aslida noto'g'ri edi — shuning uchun uzoq sezilmadi.
   *
   * QOIDA: noto'g'ri tarjimadan ko'ra TARJIMASIZ (o'zbekcha) qolgani
   * yaxshiroq. Yozuv "yarim" deb belgilanadi va keyingi urinishda
   * yana Gemini bilan uriniladi.
   *
   * Zaxira faqat Gemini kaliti UMUMAN yo'q bo'lsa ishlatiladi —
   * unda hech qanday tarjima bo'lmagandan ko'ra taxminiysi ma'qul.
   */
  if (!Deno.env.get("GEMINI_API_KEY")) {
    chain.push({ nom: "Groq", ishla: (ms) => groqJson(prompt, { retries: 0, maxTokens: 3000, timeoutMs: ms }) });
    if (cfChatAvailable()) {
      chain.push({ nom: "Cloudflare", ishla: (ms) => cfJson(prompt, { maxTokens: 3000, timeoutMs: ms, deadline }) });
    }
  }

  for (const { nom, ishla } of chain) {
    const qolgan = deadline - Date.now();
    if (qolgan < 6_000) { sabab.push(`${lang}:vaqt-tugadi`); break; }
    try {
      const raw = await ishla(Math.min(20_000, qolgan));
      if (ok(raw)) {
        const o = raw as Record<string, unknown>;
        const out: Record<string, string> = {};
        for (const k of kalitlar) {
          if (typeof o[k] === "string" && (o[k] as string).trim()) out[k] = tozala(o[k] as string);
        }
        sabab.push(`${lang}:${nom}`);
        return out;
      }
      sabab.push(`${lang}:${nom}=shaklsiz`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error(`translate ${lang} ${nom}:`, m);
      sabab.push(`${lang}:${nom}=${m.slice(0, 70)}`);
      // Kvota tugagan — keyingi so'rovlar bekorga kutmasin
      if (kvotaXatosimi(m)) aiTanaffusGacha = Date.now() + TANAFFUS_MS;
    }
  }
  return null;
}

/**
 * Berilgan maydonlarni uchala tilga tarjima qiladi.
 *
 * Tillar PARALLEL tarjima qilinadi — ketma-ket bo'lsa uch barobar
 * kutish bo'lardi va byudjetga sig'masdi.
 */
export async function translateFields(
  fields: Record<string, string | null | undefined>,
  langs: readonly TargetLang[] = TARGET_LANGS,
  /** Tashqi muddat (absolyut vaqt). Berilmasa o'z byudjeti ishlatiladi. */
  tashqiDeadline?: number,
): Promise<Translations> {
  // Bo'sh maydonlarni tashlaymiz va uzunlarini kesamiz
  const toza: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "string" && v.trim() && tarjimaKerakmi(v)) toza[k] = v.slice(0, MAX_FIELD);
  }
  if (Object.keys(toza).length === 0) return BOSH_TAYYOR;

  /**
   * Brend nomlari, odamlar ismi va hamkor kompaniyalar AI ga
   * KO'RSATILMAYDI — belgiga almashtiriladi. Model ularni o'zgartira
   * olmaydi, javob kelgach asl holiga qaytariladi.
   */
  const nomlar = await himoyalangnNomlar();
  const { yashirilgan, jadval } = nomlarniYashir(toza, nomlar);

  /**
   * Nomlar yashirilgach faqat belgi qolgan maydonga AI chaqirmaymiz —
   * "AGRO ALLIANCE" butunlay himoyalangan, javob baribir o'sha belgi
   * bo'lardi. Bekorga vaqt va kvota ketardi.
   */
  const yuboriladi: Record<string, string> = {};
  for (const [k, v] of Object.entries(yashirilgan)) {
    if (yashiringachMatnBormi(v)) yuboriladi[k] = v;
  }
  if (Object.keys(yuboriladi).length === 0) return BOSH_TAYYOR;

  const deadline = tashqiDeadline ?? Date.now() + BUDGET_MS;
  const sabab: string[] = [];
  const juftlar = await Promise.all(
    langs.map(async (l) => [l, await translateTo(yuboriladi, l, deadline, sabab)] as const),
  );

  const out: Translations = {};
  for (const [l, natija] of juftlar) {
    if (!natija || Object.keys(natija).length === 0) continue;
    // Belgilarni asl nomlarga qaytaramiz
    const tiklangan: Record<string, string> = {};
    for (const [k, v] of Object.entries(natija)) tiklangan[k] = nomlarniQaytar(v, jadval);
    // Yaroqsiz javob — bu tilni umuman yozmaymiz, keyin qayta uriniladi
    if (!javobYaroqlimi(tiklangan)) continue;
    out[l] = tiklangan;
  }
  /**
   * Versiya belgisi — eski, sifatsiz tarjimalarni keyin ajratish uchun.
   *
   * TO'LIQ EMAS bo'lsa (masalan xitoycha chiqmadi, chunki Gemini
   * kvotasi tugagan edi) versiya YARIM qo'yiladi. Shunda yozuv
   * "tayyor" hisoblanmaydi va keyingi qayta tarjimada yana uriniladi.
   * Aks holda bir marta muvaffaqiyatsiz chiqqan til abadiy o'zbekcha
   * qolib ketardi.
   */
  const soni = Object.keys(out).length;
  if (soni) (out as Record<string, unknown>)._v = soni === langs.length ? TR_VERSION : TR_VERSION - 0.5;
  // Tashxis izi — qaysi provayder ishladi / nega yiqildi
  (out as Record<string, unknown>)._p = sabab.join(" | ").slice(0, 300);
  return out;
}

/**
 * Yozuvni tarjima qilib, `translations` ustuniga saqlaydi.
 *
 * ADMIN saqlash amallaridan keyin chaqiriladi — foydalanuvchi qo'lda
 * hech narsa qilmaydi.
 *
 * MUHIM: HECH QACHON XATO OTMAYDI. Tarjima ixtiyoriy qulaylik, saqlash
 * amalining o'zi undan muhimroq: AI yiqilsa ham yozuv saqlangan qoladi
 * va sayt o'zbekcha ko'rsatadi.
 */
export async function tarjimaYoz(
  table: string,
  id: string,
  fields: Record<string, string | null | undefined>,
): Promise<void> {
  try {
    const tr = await translateFields(fields)
    const { error } = await supabaseAdmin
      .from(table)
      .update({ translations: birlashtir({}, tr) })
      .eq("id", id)
    if (error) console.error(`tarjimaYoz ${table}:`, error.message)
  } catch (e) {
    console.error(`tarjimaYoz ${table}:`, e instanceof Error ? e.message : e)
  }
}

/**
 * TARJIMASI YO'Q YOZUVLARNI FONDA TARJIMA QILADI.
 *
 * MUAMMO EDI: tarjima faqat admin kontentni QAYTA SAQLAGANDA yozilardi.
 * Ya'ni sayt ochilganda bosh sahifa bloklari, hamkorlar, jamoa —
 * hammasi o'zbekcha qolardi, chunki ular allaqachon bazada turgan va
 * hech kim ularni qayta saqlamagan edi. Foydalanuvchi tilni
 * o'zgartirsa, faqat menyu tarjima bo'lib, MAZMUN o'zbekcha qolardi.
 *
 * Endi ommaviy endpoint tarjimasi yo'q yozuvni ko'rsa, uni FONDA
 * tarjima qilib qo'yadi. Javob KUTMAYDI — birinchi tashrifchi
 * o'zbekcha ko'radi, keyingilari tarjimani oladi.
 *
 * `EdgeRuntime.waitUntil` javob yuborilgandan keyin ham ishlashga
 * ruxsat beradi. U bo'lmasa umuman ishga tushirmaymiz — javobni
 * sekinlashtirgandan ko'ra tarjimasiz qolgani yaxshiroq.
 */
export async function fondaTarjima(
  table: string,
  rows: Record<string, unknown>[],
  lang: string | null,
  fields: string[],
): Promise<void> {
  if (!lang || lang === "uz") return
  /**
   * Kvota tugagan bo'lsa darhol chiqamiz — bu yerdan keyin uchta
   * baza so'rovi (himoyalangan nomlar) va AI urinishlari bor, ular
   * baribir natija bermaydi va faqat javobni kechiktiradi.
   */
  if (aiTanaffusdami()) return

  const kerak = rows.filter((r) => {
    const tr = r.translations as (Translations & { _v?: number }) | undefined
    // Qo'lda tarjima qilingan — AI tegmaydi
    if (qoldaTarjimami(tr)) return false
    // Eski versiyadagi tarjima — qayta qilinadi
    if (tr?.[lang as TargetLang] && (tr._v ?? 1) >= TR_VERSION) return false
    // Tarjima qilinadigan matni bormi
    return fields.some((f) => typeof r[f] === "string" && (r[f] as string).trim())
  })
  if (kerak.length === 0) return

  /**
   * NEGA KUTAMIZ (fon emas):
   * Avval `EdgeRuntime.waitUntil` bilan javobdan KEYIN bajarishga
   * urinildi — ishlamadi. Javob yuborilgach izolyat to'xtatiladi va
   * tarjima yarim yo'lda uzilib qoladi; bazaga hech narsa yozilmadi.
   *
   * Endi kutamiz, lekin QATTIQ chegara bilan: bir so'rovda ko'pi bilan
   * 3 ta yozuv va jami 20 soniya. Javob keshlanadi (300s), shuning
   * uchun bu narxni faqat kesh eskirgandagi BIRINCHI tashrifchi to'laydi
   * va har safar yana 3 ta yozuv tarjima bo'lib boradi.
   *
   * Chegaraga urilsa qolganlari keyingi so'rovda davom etadi.
   */
  const deadline = Date.now() + 14_000
  for (const r of kerak.slice(0, 2)) {
    if (Date.now() > deadline) break
    const fl: Record<string, string | null | undefined> = {}
    for (const f of fields) fl[f] = r[f] as string | undefined
    // Qolgan vaqtni uzatamiz — bitta yozuv butun byudjetni yeb qo'ymasin
    const tr = await translateFields(fl, kerakliTillar(r.translations), deadline)

    /**
     * BO'SH NATIJA HAM YOZILADI.
     *
     * MUAMMO EDI: natija bo'sh bo'lsa `continue` qilinardi va ESKI,
     * BUZUQ tarjima o'z holicha qolaverardi. Aynan shundan bosh
     * sahifada "AGRO ALLIANCE" o'rniga inglizchada "AGRICULTURE
     * Partnership" turib qolgan edi — brend nomi endi tarjima
     * qilinmaydi, lekin eski tarjima hech kim tomonidan
     * o'chirilmasdi.
     *
     * `birlashtir` uchala holatni ajratadi: tarjima kerak emas (eskisi
     * o'chadi), AI yiqildi (eskisi qoladi, keyin qayta uriniladi),
     * tarjima chiqdi (birlashtiriladi).
     */
    const yangi = birlashtir(r.translations, tr)

    // Shu javobga ham qo'llaymiz — birinchi tashrifchi ham natijani ko'radi
    r.translations = yangi

    const { error } = await supabaseAdmin
      .from(table)
      .update({ translations: yangi })
      .eq("id", r.id as string)
    if (error) console.error(`fondaTarjima ${table}:`, error.message)
  }
}

/**
 * Yozuvni so'ralgan tilda qaytaradi: tarjima bo'lsa uni, bo'lmasa
 * o'zbekcha maydonni ishlatadi.
 *
 * Ommaviy endpointlarda ishlatiladi.
 */
export function applyLang<T extends Record<string, unknown>>(
  row: T,
  lang: string | null,
  fields: string[],
): T {
  const tr = (row.translations as Translations | undefined)?.[lang as TargetLang];
  const out = { ...row } as Record<string, unknown>;
  /**
   * `translations` MIJOZGA YUBORILMAYDI.
   *
   * Unda uchala tilning nusxasi bor — yangiliklar ro'yxatida bu javob
   * hajmini bir necha barobar oshiradi, mijoz esa undan foydalanmaydi:
   * kerakli til allaqachon shu yerda qo'llanib bo'lingan.
   */
  delete out.translations;
  if (!lang || lang === "uz" || !tr) return out as T;
  for (const f of fields) {
    const v = tr[f];
    if (typeof v !== "string" || !v.trim()) continue;
    /**
     * YAROQSIZ TARJIMA O'QISHDA HAM CHETLAB O'TILADI.
     *
     * Bazada eski, buzuq qiymatlar qolgan: model qiymat o'rniga KALIT
     * nomini ("title") yoki tiklanmagan "__BR0__ with Us!" belgisini
     * qaytargan. Ular endi yozilmaydi, lekin YOZILGANLARI turibdi va
     * saytda ko'rinardi. Shu tekshiruv ularni ko'rsatmaydi — o'rniga
     * asl o'zbekcha matn chiqadi va yozuv keyin qayta tarjima qilinadi.
     */
    if (!javobYaroqlimi({ [f]: v })) continue;
    out[f] = v;
  }
  return out as T;
}

/** So'rovdan til kodini oladi (faqat ma'lum tillar) */
export function langOf(url: URL): string | null {
  const l = url.searchParams.get("lang");
  return l && (TARGET_LANGS as readonly string[]).includes(l) ? l : null;
}
