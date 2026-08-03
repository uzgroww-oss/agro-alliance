import { geminiJson } from "./gemini.ts";
import { groqJson } from "./groq.ts";
import { cfJson, cfChatAvailable } from "./cfChat.ts";

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
    "- Do NOT translate brand names, people's names, or URLs — keep them as they are.",
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
): Promise<Record<string, string> | null> {
  const prompt = buildPrompt(fields, lang);
  const kalitlar = Object.keys(fields);
  const ok = valid(kalitlar);

  const chain: { nom: string; ishla: (ms: number) => Promise<unknown> }[] = [];
  if (cfChatAvailable()) {
    chain.push({ nom: "Cloudflare", ishla: (ms) => cfJson(prompt, { maxTokens: 3000, timeoutMs: ms, deadline }) });
  }
  chain.push({ nom: "Gemini", ishla: (ms) => geminiJson(prompt, { retries: 0, maxTokens: 3000, timeoutMs: ms }) });
  chain.push({ nom: "Groq", ishla: (ms) => groqJson(prompt, { retries: 0, maxTokens: 3000, timeoutMs: ms }) });

  for (const { nom, ishla } of chain) {
    const qolgan = deadline - Date.now();
    if (qolgan < 6_000) break;
    try {
      const raw = await ishla(Math.min(20_000, qolgan));
      if (ok(raw)) {
        const o = raw as Record<string, unknown>;
        const out: Record<string, string> = {};
        for (const k of kalitlar) {
          if (typeof o[k] === "string" && (o[k] as string).trim()) out[k] = (o[k] as string).trim();
        }
        return out;
      }
    } catch (e) {
      console.error(`translate ${lang} ${nom}:`, e instanceof Error ? e.message : e);
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
): Promise<Translations> {
  // Bo'sh maydonlarni tashlaymiz va uzunlarini kesamiz
  const toza: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "string" && v.trim()) toza[k] = v.slice(0, MAX_FIELD);
  }
  if (Object.keys(toza).length === 0) return {};

  const deadline = Date.now() + BUDGET_MS;
  const juftlar = await Promise.all(
    langs.map(async (l) => [l, await translateTo(toza, l, deadline)] as const),
  );

  const out: Translations = {};
  for (const [l, natija] of juftlar) {
    if (natija && Object.keys(natija).length) out[l] = natija;
  }
  return out;
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
  if (!lang || lang === "uz") return row;
  const tr = (row.translations as Translations | undefined)?.[lang as TargetLang];
  if (!tr) return row;
  const out = { ...row } as Record<string, unknown>;
  for (const f of fields) {
    if (typeof tr[f] === "string" && tr[f].trim()) out[f] = tr[f];
  }
  return out as T;
}

/** So'rovdan til kodini oladi (faqat ma'lum tillar) */
export function langOf(url: URL): string | null {
  const l = url.searchParams.get("lang");
  return l && (TARGET_LANGS as readonly string[]).includes(l) ? l : null;
}
