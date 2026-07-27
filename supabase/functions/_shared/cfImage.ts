/**
 * Cloudflare Workers AI orqali rasm yaratish.
 *
 * NEGA KERAK: NVIDIA'dagi FLUX `negative_prompt` ni QABUL QILMAYDI —
 * shuning uchun "odam chizma" degan talabni so'rov ichida iltimos
 * qilib turardik va model ba'zan e'tibor bermay, muqovaga odam qo'shib
 * yuborardi. Cloudflare'даги Stable Diffusion XL esa negative_prompt
 * ni qabul qiladi: taqiq QAT'IY bo'ladi.
 *
 * Bepul: Cloudflare hisobida kunlik bepul "neuron" ajratmasi bor va
 * bizning hajm (kuniga o'nlab rasm) unga bemalol sig'adi.
 *
 * Sozlash (Supabase secrets):
 *   CF_ACCOUNT_ID   — Cloudflare hisob raqami
 *   CF_API_TOKEN    — "Workers AI" ruxsatli token
 *   CF_IMAGE_MODELS — (ixtiyoriy) modellar ro'yxati, vergul bilan
 */

const BASE = "https://api.cloudflare.com/client/v4/accounts";

export function cfAvailable(): boolean {
  return Boolean(Deno.env.get("CF_ACCOUNT_ID") && Deno.env.get("CF_API_TOKEN"));
}

/**
 * Sinaladigan modellar. SDXL birinchi — negative_prompt ni u qabul
 * qiladi va aynan shu bizga kerak. FLUX zaxira (tezroq, lekin taqiqsiz).
 */
function models(): string[] {
  const custom = Deno.env.get("CF_IMAGE_MODELS");
  if (custom) return custom.split(",").map((s) => s.trim()).filter(Boolean);
  return [
    "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    "@cf/bytedance/stable-diffusion-xl-lightning",
    "@cf/black-forest-labs/flux-1-schnell",
  ];
}

/** Nisbatdan piksel o'lchami. SDXL 512-1024 oralig'ini yaxshi chizadi. */
function dims(aspect: string): { width: number; height: number } {
  if (aspect === "4:5") return { width: 832, height: 1040 };
  if (aspect === "9:16") return { width: 768, height: 1344 };
  if (aspect === "1:1") return { width: 1024, height: 1024 };
  return { width: 1280, height: 720 }; // 16:9
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

/** Ishlagan model eslab qolinadi — ketma-ket rasmlar tez chizilsin */
let workingModel: string | null = null;

/**
 * @param prompt   inglizcha rasm so'rovi
 * @param aspect   "16:9" | "4:5" | "1:1" | "9:16"
 * @param seed     har xil rasm uchun
 * @param negative TAQIQ: nima bo'lmasligi kerak (odam, yozuv…)
 * @returns base64 rasm (prefikssiz)
 */
export async function cfImage(
  prompt: string,
  aspect = "16:9",
  seed = 0,
  negative = "",
): Promise<{ data: string; model: string }> {
  const acc = Deno.env.get("CF_ACCOUNT_ID");
  const token = Deno.env.get("CF_API_TOKEN");
  if (!acc || !token) throw new Error("Cloudflare sozlanmagan");

  const { width, height } = dims(aspect);
  const list = workingModel
    ? [workingModel, ...models().filter((m) => m !== workingModel)]
    : models();

  const errs: string[] = [];
  for (const model of list) {
    try {
      const body: Record<string, unknown> = { prompt, width, height };
      // FLUX negative_prompt/steps ni qabul qilmaydi — faqat SDXL'ga
      // yuboramiz. seed ham hamma modelda yo'q, shuning uchun ehtiyot.
      const isFlux = model.includes("flux");
      if (!isFlux) {
        if (negative) body.negative_prompt = negative;
        if (seed) body.seed = seed;
        body.num_steps = 20;
      } else if (seed) {
        body.seed = seed;
      }

      const r = await fetch(`${BASE}/${acc}/ai/run/${model}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      if (!r.ok) {
        const t = await r.text().catch(() => "");
        const name = model.split("/").pop();
        if (r.status === 401 || r.status === 403) {
          errs.push(`${name}: token qabul qilinmadi`);
        } else if (r.status === 429) {
          errs.push(`${name}: kunlik limit tugadi`);
        } else {
          errs.push(`${name}: ${r.status} ${t.slice(0, 90)}`);
        }
        continue;
      }

      // MUHIM: javob shakli modelga qarab farq qiladi. SDXL XOM PNG
      // baytlarini qaytaradi, FLUX esa JSON ichida base64 beradi.
      const ctype = r.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        const j = await r.json().catch(() => ({})) as {
          result?: { image?: string };
          success?: boolean;
          errors?: { message?: string }[];
        };
        const img = j?.result?.image;
        if (img) {
          workingModel = model;
          return { data: img, model };
        }
        errs.push(`${model.split("/").pop()}: ${j?.errors?.[0]?.message || "javobda rasm yo'q"}`);
        continue;
      }

      const buf = new Uint8Array(await r.arrayBuffer());
      if (!buf.length) {
        errs.push(`${model.split("/").pop()}: bo'sh javob`);
        continue;
      }
      workingModel = model;
      return { data: bytesToB64(buf), model };
    } catch (e) {
      const name = model.split("/").pop();
      const msg = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
        ? "javob bermadi (vaqt tugadi)"
        : e instanceof Error ? e.message : "xatolik";
      errs.push(`${name}: ${msg}`);
    }
  }
  throw new Error(errs.join(" | ") || "Cloudflare rasm chizmadi");
}
