/**
 * NVIDIA NIM — bepul va cheklovlari keng AI provayderi.
 * https://build.nvidia.com — kalit shu yerdan olinadi.
 *
 * NEGA QO'SHILDI: Gemini bepul tarifida kvota juda tez tugaydi
 * (429 birinchi so'rovdayoq chiqishi mumkin). NIM OpenAI bilan bir xil
 * formatda ishlaydi va rasmni ko'ra oladigan modellari bor, shuning
 * uchun uni zaxira sifatida ulash oson bo'ldi.
 *
 * Model nomi env orqali o'zgartiriladi — NVIDIA ro'yxatni yangilab
 * turadi va kodni qayta yozmasdan almashtira olish kerak.
 */

import { parseJson } from "./jsonExtract.ts";

const NIM_BASE = "https://integrate.api.nvidia.com/v1";

function getApiKey(): string {
  const key = Deno.env.get("NVIDIA_API_KEY");
  if (!key) throw new Error("NVIDIA_API_KEY sozlanmagan");
  return key;
}

function textModel(): string {
  return Deno.env.get("NVIDIA_MODEL") || "meta/llama-3.3-70b-instruct";
}
function visionModel(): string {
  return Deno.env.get("NVIDIA_VISION_MODEL") || "meta/llama-3.2-90b-vision-instruct";
}

export type NimImage = { mimeType: string; data: string };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function nimChat(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number; retries?: number; image?: NimImage; json?: boolean },
): Promise<{ text: string; tokens: number }> {
  const apiKey = getApiKey();
  const model = opts?.model ?? (opts?.image ? visionModel() : textModel());
  const maxRetries = opts?.retries ?? 1;

  // Rasm OpenAI formatida — data URI sifatida matn ichida yuboriladi
  const content: unknown = opts?.image
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${opts.image.mimeType};base64,${opts.image.data}` } },
      ]
    : prompt;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(3000 * attempt);

    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content }],
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 2048,
    };
    if (opts?.json) body.response_format = { type: "json_object" };

    try {
      const resp = await fetch(`${NIM_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (resp.status === 429) {
        if (attempt < maxRetries) continue;
        throw new Error("NVIDIA so'rovlar chegarasi — keyinroq urining");
      }
      if (!resp.ok) {
        // Xato matnini saqlaymiz: model nomi noto'g'ri bo'lsa aynan shu
        // yerda ko'rinadi (NVIDIA ro'yxatni o'zgartirib turadi).
        const err = await resp.text().catch(() => "");
        throw new Error(`NVIDIA xatosi ${resp.status}: ${err.slice(0, 200)}`);
      }

      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      const tokens = data.usage?.total_tokens ?? 0;
      return { text, tokens };
    } catch (e) {
      if (attempt === maxRetries) throw e;
    }
  }
  throw new Error("NVIDIA — kutilmagan tugash");
}

export async function nimJson<T = unknown>(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number; retries?: number; image?: NimImage },
): Promise<T> {
  const { text } = await nimChat(prompt, { ...opts, json: true });
  return parseJson<T>(text);
}
