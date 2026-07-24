/**
 * NVIDIA orqali qisqa video yaratish.
 *
 * MUHIM CHEKLOV — ochiq aytilsin:
 * Bepul API'larda MATNDAN video yasaydigan model yo'q. NVIDIA'da
 * mavjud yagona model — stable-video-diffusion, u RASMDAN video
 * yasaydi (image-to-video).
 *
 * Shuning uchun zanjir: matn -> rasm (FLUX) -> video (SVD).
 *
 * Natija ~4 soniyalik, OVOZSIZ klip. Harakat kamera siljishi va
 * parallaks darajasida bo'ladi — bu syujetli video emas. Reels yoki
 * storis uchun fon sifatida yaraydi, to'liq video o'rnini bosmaydi.
 */

const GENAI_BASE = "https://ai.api.nvidia.com/v1/genai";
const STATUS_BASE = "https://api.nvcf.nvidia.com/v2/nvcf/pexec/status";

function getApiKey(): string {
  const key = Deno.env.get("NVIDIA_API_KEY");
  if (!key) throw new Error("NVIDIA_API_KEY sozlanmagan");
  return key;
}

function model(): string {
  return Deno.env.get("NVIDIA_VIDEO_MODEL") || "stabilityai/stable-video-diffusion";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Javob shakli har xil bo'lishi mumkin — hammasini ushlaymiz */
function extractVideo(data: Record<string, unknown>): string | null {
  const d = data as {
    video?: string;
    artifacts?: { base64?: string; video?: string }[];
    data?: { b64_json?: string; video?: string }[];
    b64_json?: string;
  };
  const raw =
    d.video ??
    d.artifacts?.[0]?.video ??
    d.artifacts?.[0]?.base64 ??
    d.data?.[0]?.video ??
    d.data?.[0]?.b64_json ??
    d.b64_json ??
    null;
  if (!raw) return null;
  const comma = raw.indexOf(",");
  return raw.startsWith("data:") && comma > -1 ? raw.slice(comma + 1) : raw;
}

/**
 * Video uzoq yasaladi, shuning uchun NVIDIA 202 qaytarib, natijani
 * keyinroq beradi. Tayyor bo'lguncha so'rab turamiz.
 */
async function waitForResult(reqId: string, apiKey: string): Promise<Record<string, unknown>> {
  // 30 x 3s = 90 soniya. Ko'proq kutish edge funksiya chegarasidan
  // oshib ketadi va so'rov baribir uziladi.
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const r = await fetch(`${STATUS_BASE}/${reqId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (r.status === 202) continue; // hali tayyor emas
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Video holati: ${r.status} ${t.slice(0, 100)}`);
    }
    return await r.json().catch(() => ({}));
  }
  throw new Error("Video tayyorlanmadi — juda uzoq ketdi");
}

/**
 * Rasmdan video yasaydi.
 * @param imageB64 base64 JPEG/PNG (prefikssiz)
 */
export async function nimVideo(imageB64: string, mimeType = "image/jpeg"): Promise<string> {
  const apiKey = getApiKey();
  const m = model();

  const send = (body: Record<string, unknown>) =>
    fetch(`${GENAI_BASE}/${m}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

  const full: Record<string, unknown> = {
    image: `data:${mimeType};base64,${imageB64}`,
    cfg_scale: 1.8,
    seed: 0,
  };

  let resp = await send(full);

  // Modellar qabul qiladigan maydonlar o'zgarib turadi — ortiqcha
  // maydon xatosida eng oddiy so'rov bilan qayta urinamiz
  if (resp.status === 422) {
    const t = await resp.clone().text().catch(() => "");
    if (t.includes("Extra inputs are not permitted")) {
      resp = await send({ image: `data:${mimeType};base64,${imageB64}` });
    }
  }

  if (resp.status === 202) {
    const reqId = resp.headers.get("nvcf-reqid");
    if (!reqId) throw new Error("Video so'rovi raqami kelmadi");
    const data = await waitForResult(reqId, apiKey);
    const v = extractVideo(data);
    if (!v) throw new Error("Javobda video yo'q");
    return v;
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    if (resp.status === 404) throw new Error("Video modeli hisobingizda yoqilmagan");
    if (resp.status === 401 || resp.status === 403) throw new Error("NVIDIA kaliti qabul qilinmadi");
    throw new Error(`Video xatosi ${resp.status}: ${t.slice(0, 120)}`);
  }

  const data = await resp.json().catch(() => ({}));
  const v = extractVideo(data);
  if (!v) throw new Error("Javobda video yo'q");
  return v;
}
