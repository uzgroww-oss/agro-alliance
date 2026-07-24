/**
 * NVIDIA orqali rasm yaratish (text-to-image).
 *
 * Bu integrate.api.nvidia.com dan BOSHQA endpoint — rasm modellari
 * ai.api.nvidia.com/v1/genai/… da turadi va chat modellari ro'yxatida
 * ko'rinmaydi.
 *
 * Model nomlari env orqali o'zgartiriladi: NVIDIA ro'yxatni yangilab
 * turadi va kodni qayta yozmasdan almashtira olish kerak.
 */

const GENAI_BASE = "https://ai.api.nvidia.com/v1/genai";

function getApiKey(): string {
  const key = Deno.env.get("NVIDIA_API_KEY");
  if (!key) throw new Error("NVIDIA_API_KEY sozlanmagan");
  return key;
}

/**
 * Har modelning o'z sozlamasi bor.
 *
 * MUHIM: flux.1-schnell distillangan model — u CFG ishlatmaydi va
 * cfg_scale 0 dan katta bo'lsa 422 qaytaradi. Umumiy sozlama bilan
 * yuborilganda aynan shu xato chiqardi.
 */
type ModelCfg = { cfg: number; steps: number };
const MODEL_PARAMS: Record<string, ModelCfg> = {
  "black-forest-labs/flux.1-schnell": { cfg: 0, steps: 4 },
  "black-forest-labs/flux.1-dev": { cfg: 3.5, steps: 30 },
};
const DEFAULT_PARAMS: ModelCfg = { cfg: 4.5, steps: 30 };

/** Sinaladigan modellar — biri ishlamasa keyingisi */
function models(): string[] {
  const custom = Deno.env.get("NVIDIA_IMAGE_MODELS");
  if (custom) return custom.split(",").map((s) => s.trim()).filter(Boolean);
  return [
    "black-forest-labs/flux.1-schnell", // tez, hisoblarda odatda yoqilgan
    "black-forest-labs/flux.1-dev",
    "stabilityai/stable-diffusion-3-medium",
    "stabilityai/sdxl-turbo",
  ];
}

/**
 * Xato matnini qisqartirish. NVIDIA to'liq JSON qaytaradi va u
 * panelga to'g'ridan-to'g'ri chiqsa ekranni to'ldirib yuboradi.
 */
function shortError(model: string, status: number, body: string): string {
  const name = model.split("/").pop() || model;
  if (status === 404) return `${name}: hisobingizda yoqilmagan`;
  if (status === 401 || status === 403) return `${name}: kalit qabul qilinmadi`;
  if (status === 429) return `${name}: so'rovlar chegarasi`;
  try {
    const j = JSON.parse(body);
    const d = j.detail;
    if (Array.isArray(d) && d[0]?.msg) {
      const loc = Array.isArray(d[0].loc) ? d[0].loc[d[0].loc.length - 1] : "";
      return `${name}: ${loc ? loc + " — " : ""}${d[0].msg}`;
    }
    if (typeof d === "string") return `${name}: ${d.slice(0, 80)}`;
  } catch { /* JSON emas — pastda qisqartiramiz */ }
  return `${name}: ${status} ${body.slice(0, 60)}`;
}

export type GenAspect = "1:1" | "16:9" | "4:5" | "9:16";

/**
 * Javob shakli modeldan modelga farq qiladi. Hammasini bir joyda
 * ushlaymiz — aks holda bitta model o'zgarsa butun funksiya yiqiladi.
 */
function extractBase64(data: Record<string, unknown>): string | null {
  const d = data as {
    artifacts?: { base64?: string }[];
    image?: string;
    images?: string[];
    b64_json?: string;
    data?: { b64_json?: string; url?: string }[];
  };
  const raw =
    d.artifacts?.[0]?.base64 ??
    d.image ??
    d.images?.[0] ??
    d.b64_json ??
    d.data?.[0]?.b64_json ??
    null;
  if (!raw) return null;
  // "data:image/png;base64,…" bo'lsa prefiksni olib tashlaymiz
  const comma = raw.indexOf(",");
  return raw.startsWith("data:") && comma > -1 ? raw.slice(comma + 1) : raw;
}

export async function nimImage(
  prompt: string,
  aspect: GenAspect = "16:9",
): Promise<{ data: string; model: string }> {
  const apiKey = getApiKey();
  const errs: string[] = [];

  for (const model of models()) {
    const params = MODEL_PARAMS[model] || DEFAULT_PARAMS;
    try {
      const resp = await fetch(`${GENAI_BASE}/${model}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          negative_prompt: "text, watermark, logo, blurry, distorted, deformed hands",
          aspect_ratio: aspect,
          cfg_scale: params.cfg,
          steps: params.steps,
          seed: 0,
        }),
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        errs.push(shortError(model, resp.status, t));
        continue;
      }

      const data = await resp.json().catch(() => ({}));
      const b64 = extractBase64(data);
      if (!b64) {
        errs.push(`${model}: javobda rasm yo'q`);
        continue;
      }
      return { data: b64, model };
    } catch (e) {
      errs.push(`${model.split("/").pop()}: ${e instanceof Error ? e.message : "xatolik"}`);
    }
  }

  throw new Error(errs.join(" | ") || "Rasm yaratilmadi");
}
