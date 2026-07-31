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
type ModelCfg = { cfg: number; steps: number; negative: boolean };
const MODEL_PARAMS: Record<string, ModelCfg> = {
  // FLUX negative_prompt ni QABUL QILMAYDI — yuborilsa
  // "Extra inputs are not permitted" xatosi qaytadi.
  "black-forest-labs/flux.1-schnell": { cfg: 0, steps: 4, negative: false },
  "black-forest-labs/flux.1-dev": { cfg: 3.5, steps: 30, negative: false },
};
const DEFAULT_PARAMS: ModelCfg = { cfg: 4.5, steps: 30, negative: true };

/**
 * Ishlagan model ESLAB QOLINADI. Muqova uchun 4 ta rasm ketma-ket
 * chiziladi — har safar barcha modellarni qaytadan sinash (ishlamaydigani
 * 20 soniyadan uzilishini kutish) butun so'rovni sekinlashtirib, vaqt
 * chegarasiga urardi va natijada 0 ta rasm chiqardi. Endi birinchi
 * ishlagan model keyingilarida to'g'ridan-to'g'ri ishlatiladi.
 */
let workingModel: string | null = null;

/** Sinaladigan modellar — biri ishlamasa keyingisi */
function models(): string[] {
  const custom = Deno.env.get("NVIDIA_IMAGE_MODELS");
  const list = custom
    ? custom.split(",").map((s) => s.trim()).filter(Boolean)
    : [
        "black-forest-labs/flux.1-schnell", // tez, hisoblarda odatda yoqilgan
        "black-forest-labs/flux.1-dev",
        "stabilityai/stable-diffusion-3-medium",
        "stabilityai/sdxl-turbo",
      ];
  // Eslab qolingan model bo'lsa — birinchi bo'lib sinaladi
  if (workingModel && list.includes(workingModel)) {
    return [workingModel, ...list.filter((m) => m !== workingModel)];
  }
  return list;
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
  seed = 0,
  /**
   * Butun urinishlar uchun umumiy muddat (absolyut vaqt, Date.now()).
   *
   * MUAMMO EDI: 4 ta model x 20s = 80 soniya, ustiga 429/503 da yana
   * 3s kutib qayta urinish. Rasm chizish yolg'iz o'zi 90 soniyaga
   * cho'zilib, mijoz chegarasidan oshib ketardi.
   */
  deadline?: number,
): Promise<{ data: string; model: string }> {
  const apiKey = getApiKey();
  const errs: string[] = [];

  for (const model of models()) {
    if (deadline && deadline - Date.now() < 5_000) {
      errs.push("vaqt tugadi — qolgan modellar sinalmadi");
      break;
    }
    const params = MODEL_PARAMS[model] || DEFAULT_PARAMS;
    try {
      // MUHIM: har so'rovga vaqt chegarasi. Ilgari chegara yo'q edi va
      // bitta model javob bermay qotib qolsa, butun zanjir to'xtardi —
      // mijoz esa "So'rov vaqti tugadi" deb uzib yuborardi. Endi 20
      // soniyada javob bermasa, keyingi modelga o'tamiz. To'rt model x
      // 20s = 80s, bu 90s mijoz chegarasiga sig'adi.
      const send = (body: Record<string, unknown>) =>
        fetch(`${GENAI_BASE}/${model}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(
            deadline ? Math.min(20_000, Math.max(5_000, deadline - Date.now())) : 20_000,
          ),
        });

      const full: Record<string, unknown> = {
        prompt,
        aspect_ratio: aspect,
        cfg_scale: params.cfg,
        steps: params.steps,
        seed,
      };
      if (params.negative) {
        full.negative_prompt = "text, watermark, logo, blurry, distorted, deformed hands";
      }

      let resp = await send(full);

      // Modellar qabul qiladigan maydonlar ro'yxati har xil va NVIDIA
      // uni o'zgartirib turadi. Ortiqcha maydon xatosida eng oddiy
      // so'rov bilan qayta urinamiz — har maydonni oldindan bilish
      // shart bo'lmaydi.
      if (resp.status === 422) {
        const t = await resp.clone().text().catch(() => "");
        if (t.includes("Extra inputs are not permitted")) {
          resp = await send({ prompt, cfg_scale: params.cfg, seed });
        }
      }

      // Rate-limit (429) yoki band (503 ResourceExhausted) — NVIDIA bepul
      // tarifining "16 so'rov" chegarasi ketma-ket rasmda tez uriladi.
      // Darhol keyingi modelga o'tish o'rniga bir marta KUTIB, SHU
      // modelni qayta uramiz — ko'pincha 2-3 soniyada bo'shaydi.
      // Vaqt qolmagan bo'lsa kutib o'tirmaymiz
      if ((resp.status === 429 || resp.status === 503) &&
          (!deadline || deadline - Date.now() > 10_000)) {
        await new Promise((r) => setTimeout(r, 3000));
        resp = await send(full);
      }

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
      workingModel = model; // keyingi rasmlar shu modeldan boshlaydi
      return { data: b64, model };
    } catch (e) {
      const name = model.split("/").pop();
      // AbortSignal.timeout TimeoutError tashlaydi — uni tushunarli yozamiz
      const msg = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
        ? "javob bermadi (vaqt tugadi)"
        : e instanceof Error ? e.message : "xatolik";
      errs.push(`${name}: ${msg}`);
    }
  }

  throw new Error(errs.join(" | ") || "Rasm yaratilmadi");
}
