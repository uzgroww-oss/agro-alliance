/**
 * Gemini AI helper — direct API calls with retry and rate-limit awareness.
 * Uses GEMINI_API_KEY from Supabase Secrets.
 */

import { parseJson } from "./jsonExtract.ts";
import { aiKalit } from "./aiKalit.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Kalit avval PANELDAN qo'shilganidan olinadi, bo'lmasa Supabase
 * Secrets'dan. Shu tufayli kvota tugaganda muharrir terminalsiz,
 * to'g'ridan-to'g'ri paneldan yangi kalit qo'ya oladi.
 */
async function getApiKey(): Promise<string> {
  const key = await aiKalit("gemini", "GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not set in Supabase Secrets");
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Kalitni yuborishning uchta usuli bor va Google qaysi biri kerakligini
 * kalit turiga qarab hal qiladi:
 *   1) x-goog-api-key sarlavhasi  — hozirgi tavsiya etilgan usul
 *   2) Authorization: Bearer      — AQ.… turidagi kalitlar uchun
 *   3) ?key=… URL parametri       — eski AIza… kalitlar uchun
 *
 * Qaysi kalit turi berilganini oldindan bilib bo'lmaydi (Google format
 * o'zgartirgan), shuning uchun 401/403 kelsa keyingisiga o'tamiz.
 * Ishlagani ESLAB QOLINADI — keyingi so'rovlar to'g'ridan-to'g'ri
 * o'sha usul bilan ketadi, ortiqcha urinish bo'lmaydi.
 */
type AuthMode = "header" | "bearer" | "query";
const AUTH_MODES: AuthMode[] = ["header", "bearer", "query"];
let workingMode: AuthMode | null = null;

function buildRequest(url: string, apiKey: string, mode: AuthMode) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let finalUrl = url;
  if (mode === "header") headers["x-goog-api-key"] = apiKey;
  else if (mode === "bearer") headers["Authorization"] = `Bearer ${apiKey}`;
  else finalUrl = `${url}?key=${encodeURIComponent(apiKey)}`;
  return { finalUrl, headers };
}

async function fetchWithAuthFallback(
  url: string,
  apiKey: string,
  body: unknown,
  timeoutMs = 25_000,
): Promise<Response> {
  const modes = workingMode ? [workingMode] : AUTH_MODES;
  let last: Response | null = null;

  for (const mode of modes) {
    const { finalUrl, headers } = buildRequest(url, apiKey, mode);
    const resp = await fetch(finalUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    // Faqat autentifikatsiya xatosida keyingi usulni sinaymiz.
    // Boshqa xatolar (429, 400, 500) kalit turiga aloqador emas.
    if (resp.status === 401 || resp.status === 403) {
      // Eslab qolingan usul endi ishlamadi (kalit almashgan bo'lishi
      // mumkin) — keyingi safar hammasini qaytadan sinasin.
      workingMode = null;
      last = resp;
      continue;
    }

    workingMode = mode;
    return resp;
  }

  return last!;
}

/**
 * Rasm bilan so'rov uchun: {mimeType, data} — data base64, prefikssiz.
 * Gemini buni inline_data sifatida qabul qiladi.
 */
export type InlineImage = { mimeType: string; data: string };

export async function geminiChat(
  prompt: string,
  opts?: {
    model?: string; temperature?: number; maxTokens?: number; retries?: number;
    image?: InlineImage; timeoutMs?: number;
  },
): Promise<{ text: string; tokens: number }> {
  const apiKey = await getApiKey();
  const model = opts?.model ?? "gemini-2.0-flash";
  const maxRetries = opts?.retries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Kutish: 2s, 4s — jami 6 sekund.
      // ILGARI: 5s, 10s, 20s = 35 sekund SOF KUTISH, ustiga 4 ta so'rov.
      // Izohda "50s chegarasidan oshmasin" deyilgan edi, lekin hisob
      // noto'g'ri edi — retries=3 uchinchi kechikishni ham qo'shardi.
      // Foydalanuvchi provayder band bo'lganda deyarli bir daqiqa kutardi.
      const delay = 2000 * Math.pow(2, attempt - 1);
      await sleep(delay);
    }

    const url = `${GEMINI_BASE}/models/${model}:generateContent`;
    // Rasm berilsa u matndan OLDIN keladi — model avval rasmni ko'rib,
    // keyin ko'rsatmani o'qiydi. Aks tartibda tavsif yuzaki chiqadi.
    const parts: unknown[] = [];
    if (opts?.image) {
      parts.push({ inline_data: { mime_type: opts.image.mimeType, data: opts.image.data } });
    }
    parts.push({ text: prompt });

    const body = {
      contents: [{ parts }],
      generationConfig: {
        temperature: opts?.temperature ?? 0.7,
        maxOutputTokens: opts?.maxTokens ?? 2048,
      },
    };

    try {
      const resp = await fetchWithAuthFallback(url, apiKey, body, opts?.timeoutMs);

      if (resp.status === 429) {
        if (attempt < maxRetries) continue;
        // MUHIM: Google'ning izohini tashlamaymiz. 429 faqat "juda tez
        // so'rading" degani emas — kvota umuman ajratilmagan bo'lsa ham
        // (API yoqilmagan, to'lov sozlanmagan) shu kod qaytadi.
        // Ilgari bu yerda qat'iy matn bor edi va sababni bilib bo'lmasdi.
        const body = await resp.text().catch(() => "");
        let why = "";
        try {
          const j = JSON.parse(body);
          why = j?.error?.message || "";
        } catch { why = body.slice(0, 200); }
        throw new Error(why ? `Gemini kvotasi: ${why}` : "Gemini kvotasi tugagan");
      }

      if (!resp.ok) {
        // Uzun JSON xato matnini panelga chiqarmaymiz — qisqa sabab yetarli.
        if (resp.status === 401 || resp.status === 403) {
          throw new Error("Gemini kaliti qabul qilinmadi");
        }
        const err = await resp.text();
        throw new Error(`Gemini xatosi ${resp.status}: ${err.slice(0, 160)}`);
      }

      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const tokens = data.usageMetadata?.totalTokenCount ?? 0;

      return { text, tokens };
    } catch (e) {
      if (attempt === maxRetries) throw e;
    }
  }

  throw new Error("Gemini API — unexpected end of retry loop");
}

/**
 * Convenience: ask Gemini to return JSON. Strips markdown fences and parses.
 */
export async function geminiJson<T = unknown>(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number; retries?: number; image?: InlineImage; timeoutMs?: number },
): Promise<T> {
  const { text } = await geminiChat(prompt, opts);
  // Qavslar muvozanati bo'yicha ajratamiz — AI JSON atrofiga matn
  // qo'shib yuborsa ham ishlaydi.
  return parseJson<T>(text);
}
