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

/** Sinaladigan modellar — biri ishlamasa keyingisi */
function models(): string[] {
  const custom = Deno.env.get("NVIDIA_IMAGE_MODELS");
  if (custom) return custom.split(",").map((s) => s.trim()).filter(Boolean);
  return [
    "black-forest-labs/flux.1-schnell", // tez
    "stabilityai/stable-diffusion-3-medium",
    "stabilityai/sdxl-turbo",
  ];
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
          cfg_scale: 4.5,
          steps: 30,
          seed: 0,
        }),
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        errs.push(`${model}: ${resp.status} ${t.slice(0, 120)}`);
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
      errs.push(`${model}: ${e instanceof Error ? e.message : "xatolik"}`);
    }
  }

  throw new Error(errs.join(" | ") || "Rasm yaratilmadi");
}
