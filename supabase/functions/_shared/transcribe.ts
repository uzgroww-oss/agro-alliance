/**
 * Videoning OVOZINI matnga aylantirish (speech-to-text).
 *
 * NEGA KERAK: bitta kadr (rasm) videoda NIMA GAPIRILGANINI ko'rsatmaydi.
 * Foydali post va mos muqova uchun videoning MAZMUNI kerak — u esa
 * ko'pincha ovozda (gapda) bo'ladi, tasvirda emas (masalan odam
 * gapirib turgan video). Shuning uchun ovozni matnga aylantiramiz.
 *
 * Groq Whisper (whisper-large-v3) — tez va bepul. Groq mp4 faylni
 * ham qabul qiladi (ovozini o'zi ajratadi), shuning uchun videoni
 * to'g'ridan-to'g'ri yuboramiz.
 */

const GROQ_BASE = "https://api.groq.com/openai/v1";

// Groq bepul tarifida fayl chegarasi ~25 MB. Xavfsizlik uchun biroz
// pastroq. Undan katta video uchun ovozni o'qiy olmaymiz — bu holda
// muqova xom kadrdan yasaladi.
const MAX_BYTES = 24 * 1024 * 1024;

export function transcribeAvailable(): boolean {
  return Boolean(Deno.env.get("GROQ_API_KEY"));
}

export async function transcribeVideo(videoUrl: string): Promise<string> {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw new Error("GROQ_API_KEY sozlanmagan");

  const vid = await fetch(videoUrl, { signal: AbortSignal.timeout(30_000) });
  if (!vid.ok) throw new Error(`Videoni yuklab bo'lmadi (${vid.status})`);
  const buf = new Uint8Array(await vid.arrayBuffer());
  if (!buf.length) throw new Error("Video bo'sh");
  if (buf.length > MAX_BYTES) {
    throw new Error(`Video juda katta (${Math.round(buf.length / 1024 / 1024)}MB) — ovozni o'qish uchun 24MB gacha bo'lsin`);
  }

  const name = videoUrl.split("/").pop()?.split("?")[0] || "video.mp4";
  const form = new FormData();
  // slice() — o'z buferiga ega toza nusxa (Blob tur mosligi uchun)
  form.append("file", new Blob([buf.slice().buffer as ArrayBuffer], { type: "video/mp4" }), name);
  form.append("model", "whisper-large-v3");
  form.append("response_format", "text");
  // Tilni majburlamaymiz — o'zbek/rus/ingliz bo'lishi mumkin, Whisper
  // o'zi aniqlaydi

  const r = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    if (r.status === 413) throw new Error("Video juda katta — ovozni o'qib bo'lmadi");
    if (r.status === 401 || r.status === 403) throw new Error("Groq kaliti qabul qilinmadi");
    throw new Error(`Ovozni matnga aylantirib bo'lmadi (${r.status}): ${t.slice(0, 120)}`);
  }
  return (await r.text()).trim();
}
