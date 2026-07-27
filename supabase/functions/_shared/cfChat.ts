/**
 * Cloudflare Workers AI — MATN yozish va RASM KO'RISH (vision).
 *
 * Vazifa taqsimoti (foydalanuvchi qaroriga ko'ra):
 *   Gemini     — rasm uchun promt yozadi
 *   Cloudflare — post matnini yozadi va rasm/video kadrini KO'RADI
 *   NVIDIA     — rasmni chizadi
 *
 * MUHIM: Cloudflare videoni to'g'ridan-to'g'ri o'qiy olmaydi. Lekin biz
 * videodan kadr ajratib yuboramiz, shuning uchun vision modeli yetadi.
 *
 * Vision modellari rasmni BAYT MASSIVI ko'rinishida kutadi (base64 emas)
 * — quyida shunga o'giriladi.
 */

import { parseJson } from "./jsonExtract.ts";

const BASE = "https://api.cloudflare.com/client/v4/accounts";

export function cfChatAvailable(): boolean {
  return Boolean(Deno.env.get("CF_ACCOUNT_ID") && Deno.env.get("CF_API_TOKEN"));
}

/** Matn modellari — biri ishlamasa keyingisi */
function textModels(): string[] {
  const custom = Deno.env.get("CF_TEXT_MODELS");
  if (custom) return custom.split(",").map((s) => s.trim()).filter(Boolean);
  return [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/mistral/mistral-7b-instruct-v0.2",
  ];
}

/** Rasmni ko'radigan modellar */
function visionModels(): string[] {
  const custom = Deno.env.get("CF_VISION_MODELS");
  if (custom) return custom.split(",").map((s) => s.trim()).filter(Boolean);
  return [
    "@cf/llava-hf/llava-1.5-7b-hf",
    "@cf/unum/uform-gen2-qwen-500m",
  ];
}

function b64ToNumbers(b64: string): number[] {
  const bin = atob(b64);
  const out = new Array<number>(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Ishlagan model eslab qolinadi — keyingi so'rovlar tez ketsin */
let workingText: string | null = null;
let workingVision: string | null = null;

function ordered(list: string[], remembered: string | null): string[] {
  return remembered && list.includes(remembered)
    ? [remembered, ...list.filter((m) => m !== remembered)]
    : list;
}

export type CfImage = { mimeType: string; data: string };

/**
 * Matn (yoki rasm bilan) so'rov yuboradi va javob matnini qaytaradi.
 */
export async function cfChat(
  prompt: string,
  opts?: { image?: CfImage; maxTokens?: number; timeoutMs?: number },
): Promise<{ text: string; tokens: number }> {
  const acc = Deno.env.get("CF_ACCOUNT_ID");
  const token = Deno.env.get("CF_API_TOKEN");
  if (!acc || !token) throw new Error("Cloudflare sozlanmagan");

  const isVision = Boolean(opts?.image);
  const list = isVision
    ? ordered(visionModels(), workingVision)
    : ordered(textModels(), workingText);
  const maxTokens = opts?.maxTokens ?? 1500;
  const timeoutMs = opts?.timeoutMs ?? 30_000;

  const errs: string[] = [];
  for (const model of list) {
    try {
      // Vision modellari {image: number[], prompt} kutadi,
      // matn modellari esa {messages: [...]}.
      const body: Record<string, unknown> = isVision
        ? { image: b64ToNumbers(opts!.image!.data), prompt, max_tokens: maxTokens }
        : { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens };

      const r = await fetch(`${BASE}/${acc}/ai/run/${model}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const name = model.split("/").pop();
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        if (r.status === 401 || r.status === 403) errs.push(`${name}: token qabul qilinmadi`);
        else if (r.status === 429) errs.push(`${name}: kunlik limit tugadi`);
        else errs.push(`${name}: ${r.status} ${t.slice(0, 90)}`);
        continue;
      }

      const j = await r.json().catch(() => ({})) as {
        result?: { response?: string; description?: string };
        errors?: { message?: string }[];
      };
      const text = (j?.result?.response ?? j?.result?.description ?? "").trim();
      if (!text) {
        errs.push(`${name}: ${j?.errors?.[0]?.message || "bo'sh javob"}`);
        continue;
      }
      if (isVision) workingVision = model; else workingText = model;
      return { text, tokens: 0 };
    } catch (e) {
      const name = model.split("/").pop();
      const msg = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
        ? "javob bermadi (vaqt tugadi)"
        : e instanceof Error ? e.message : "xatolik";
      errs.push(`${name}: ${msg}`);
    }
  }
  throw new Error(errs.join(" | ") || "Cloudflare javob bermadi");
}

/**
 * JSON javob so'raydi. Model javob atrofiga izoh qo'shsa ham
 * qavslar muvozanati bo'yicha ajratib olinadi.
 */
export async function cfJson<T = unknown>(
  prompt: string,
  opts?: { image?: CfImage; maxTokens?: number; timeoutMs?: number },
): Promise<T> {
  const { text } = await cfChat(prompt, opts);
  return parseJson<T>(text);
}
