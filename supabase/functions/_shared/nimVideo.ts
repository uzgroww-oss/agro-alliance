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
 *
 * SVD NING IKKI QAT'IY TALABI (video chiqmasligining asosiy sababi):
 *   1. Rasm o'lchami AYNAN 1024x576 bo'lishi kerak. FLUX 16:9 da
 *      1344x768 chiqaradi va SVD uni rad etadi.
 *   2. So'rov hajmi ~250 KB dan oshsa, rasm to'g'ridan-to'g'ri
 *      yuborilmaydi — avval NVCF "asset" sifatida yuklanib, keyin
 *      uning raqami beriladi.
 * Ikkalasi ham quyida bajariladi.
 */

const GENAI_BASE = "https://ai.api.nvidia.com/v1/genai";
const STATUS_BASE = "https://api.nvcf.nvidia.com/v2/nvcf/pexec/status";
const ASSET_BASE = "https://api.nvcf.nvidia.com/v2/nvcf/assets";

/** SVD faqat shu o'lchamni qabul qiladi */
const SVD_W = 1024;
const SVD_H = 576;

/** Shu hajmdan oshsa asset sifatida yuklaymiz (base64 belgilar soni) */
const INLINE_LIMIT = 180_000;

function getApiKey(): string {
  const key = Deno.env.get("NVIDIA_API_KEY");
  if (!key) throw new Error("NVIDIA_API_KEY sozlanmagan");
  return key;
}

function model(): string {
  return Deno.env.get("NVIDIA_VIDEO_MODEL") || "stabilityai/stable-video-diffusion";
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  // Katta massivda String.fromCharCode(...bytes) stek chegarasidan
  // oshib ketadi — bo'lak-bo'lak o'giramiz
  let s = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

/**
 * Rasmni SVD talab qiladigan 1024x576 ga keltiradi.
 *
 * "cover" usuli: nisbat buzilmasin deb avval to'ldirib kattalashtiramiz,
 * keyin ortiqchasini o'rtasidan kesamiz. Cho'zilgan rasm videoda
 * yaqqol bilinadi.
 *
 * Kutubxona faqat shu yerda kerak, shuning uchun dinamik import —
 * rasm so'ralganda funksiya uni yuklab o'tirmaydi.
 */
async function toSvdSize(bytes: Uint8Array): Promise<Uint8Array> {
  const { decode } = await import("https://deno.land/x/imagescript@1.2.17/mod.ts");
  const decoded = await decode(bytes);
  // GIF kelsa (ehtimoldan yiroq) birinchi kadrni olamiz
  const img = "width" in decoded ? decoded : (decoded as unknown as { frames: unknown[] }).frames[0];
  const im = img as { width: number; height: number; resize(w: number, h: number): unknown; crop(x: number, y: number, w: number, h: number): unknown; encodeJPEG(q: number): Promise<Uint8Array> };

  if (im.width !== SVD_W || im.height !== SVD_H) {
    const scale = Math.max(SVD_W / im.width, SVD_H / im.height);
    const w = Math.max(SVD_W, Math.round(im.width * scale));
    const h = Math.max(SVD_H, Math.round(im.height * scale));
    im.resize(w, h);
    im.crop(Math.round((w - SVD_W) / 2), Math.round((h - SVD_H) / 2), SVD_W, SVD_H);
  }
  return await im.encodeJPEG(88);
}

/**
 * Katta rasmni NVCF'ga yuklab, uning raqamini qaytaradi.
 * So'rov tanasi chegarasidan oshganda shu yo'l ishlatiladi.
 */
async function uploadAsset(bytes: Uint8Array, apiKey: string): Promise<string> {
  const create = await fetch(ASSET_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ contentType: "image/jpeg", description: "agro-alliance-frame" }),
  });
  if (!create.ok) {
    const t = await create.text().catch(() => "");
    throw new Error(`Rasmni yuklab bo'lmadi (${create.status}): ${t.slice(0, 120)}`);
  }
  const { assetId, uploadUrl } = await create.json() as { assetId: string; uploadUrl: string };

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/jpeg",
      "x-amz-meta-nvcf-asset-description": "agro-alliance-frame",
    },
    // Blob orqali: Uint8Array to'g'ridan-to'g'ri body sifatida
    // qabul qilinmaydi. slice() yangi, o'z buferiga ega nusxa beradi —
    // shundagina tur ArrayBuffer bo'lib to'g'ri keladi.
    body: new Blob([bytes.slice().buffer as ArrayBuffer], { type: "image/jpeg" }),
  });
  if (!put.ok) throw new Error(`Rasm yuklanmadi (${put.status})`);
  return assetId;
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

/** NVIDIA xatosidan odam o'qiy oladigan sabab ajratamiz */
function why(status: number, body: string): string {
  try {
    const j = JSON.parse(body);
    const d = j.detail ?? j.message ?? j.error;
    if (Array.isArray(d) && d[0]?.msg) {
      const loc = Array.isArray(d[0].loc) ? d[0].loc[d[0].loc.length - 1] : "";
      return `${loc ? loc + " — " : ""}${d[0].msg}`;
    }
    if (typeof d === "string") return d.slice(0, 160);
  } catch { /* JSON emas */ }
  return `${status} ${body.slice(0, 160)}`;
}

/**
 * Video yaratishni BOSHLAYDI — kutmaydi.
 *
 * NEGA IKKIGA BO'LINDI: SVD video ~1-2 daqiqa yasaladi. Butun jarayonni
 * bitta so'rovda kutish Supabase edge funksiyasining 150 soniyalik
 * chegarasiga uriladi va "504 idle timeout" beradi. Shuning uchun:
 *   1) startVideo — rasmni yuboradi, NVIDIA'ning so'rov raqamini
 *      (reqId) darhol qaytaradi. Bu tez.
 *   2) pollVideo — o'sha raqam bo'yicha bir marta holatni tekshiradi.
 * Frontend pollVideo'ni bir necha soniyada bir chaqirib turadi —
 * har so'rov qisqa, chegaraga yaqinlashmaydi.
 *
 * Ba'zan NVIDIA darrov 200 bilan tayyor video qaytaradi — o'shanda
 * reqId o'rniga to'g'ridan-to'g'ri video qaytariladi.
 *
 * @param imageB64 base64 JPEG/PNG (prefikssiz)
 */
export async function startVideo(imageB64: string): Promise<{ reqId?: string; video?: string }> {
  const apiKey = getApiKey();
  const m = model();

  // 1-talab: o'lchamni SVD kutgan holga keltiramiz
  let jpeg: Uint8Array;
  try {
    jpeg = await toSvdSize(b64ToBytes(imageB64));
  } catch (e) {
    throw new Error(`Rasmni ${SVD_W}x${SVD_H} ga keltirib bo'lmadi: ${e instanceof Error ? e.message : "xatolik"}`);
  }
  const frameB64 = bytesToB64(jpeg);

  // 2-talab: katta bo'lsa asset sifatida yuklaymiz
  let imageField = `data:image/jpeg;base64,${frameB64}`;
  let assetId = "";
  if (frameB64.length > INLINE_LIMIT) {
    assetId = await uploadAsset(jpeg, apiKey);
    imageField = assetId;
  }

  const send = (body: Record<string, unknown>) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    if (assetId) headers["NVCF-INPUT-ASSET-REFERENCES"] = assetId;
    return fetch(`${GENAI_BASE}/${m}`, { method: "POST", headers, body: JSON.stringify(body) });
  };

  let resp = await send({ image: imageField, cfg_scale: 1.8, seed: 0 });

  // Modellar qabul qiladigan maydonlar o'zgarib turadi — ortiqcha
  // maydon xatosida eng oddiy so'rov bilan qayta urinamiz
  if (resp.status === 422) {
    const t = await resp.clone().text().catch(() => "");
    if (t.includes("Extra inputs are not permitted")) {
      resp = await send({ image: imageField });
    }
  }

  // So'rov tanasi katta bo'lsa — asset yo'liga o'tib qayta urinamiz.
  // Chegara NVIDIA tomonda o'zgarishi mumkin, shuning uchun
  // oldindan taxmin qilish o'rniga javobga qarab hal qilamiz.
  if ((resp.status === 413 || resp.status === 400) && !assetId) {
    assetId = await uploadAsset(jpeg, apiKey);
    imageField = assetId;
    resp = await send({ image: imageField, cfg_scale: 1.8, seed: 0 });
  }

  if (resp.status === 202) {
    const reqId = resp.headers.get("nvcf-reqid");
    if (!reqId) throw new Error("Video so'rovi raqami kelmadi");
    return { reqId };
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    if (resp.status === 404) throw new Error("Video modeli hisobingizda yoqilmagan");
    if (resp.status === 401 || resp.status === 403) throw new Error("NVIDIA kaliti qabul qilinmadi");
    throw new Error(`Video xatosi: ${why(resp.status, t)}`);
  }

  const data = await resp.json().catch(() => ({}));
  const v = extractVideo(data);
  if (!v) throw new Error("Javobda video yo'q");
  return { video: v };
}

/**
 * Boshlangan videoning holatini BIR MARTA tekshiradi (kutmaydi).
 * @returns tayyor bo'lsa {done:true, video}, aks holda {done:false}
 */
export async function pollVideo(reqId: string): Promise<{ done: boolean; video?: string }> {
  const apiKey = getApiKey();
  const r = await fetch(`${STATUS_BASE}/${reqId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (r.status === 202) return { done: false }; // hali tayyor emas
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Video holati: ${why(r.status, t)}`);
  }
  const data = await r.json().catch(() => ({}));
  const v = extractVideo(data);
  if (!v) throw new Error("Javobda video yo'q");
  return { done: true, video: v };
}
