/**
 * Videoning OVOZINI matnga aylantirish (speech-to-text) — NVIDIA orqali.
 *
 * NEGA KERAK: bitta kadr (rasm) videoda NIMA GAPIRILGANINI ko'rsatmaydi.
 * Foydali post va mos muqova uchun videoning MAZMUNI kerak — u ko'pincha
 * ovozda (gapda) bo'ladi. Shuning uchun ovozni matnga aylantiramiz.
 *
 * MUHIM — ochiq: NVIDIA'da Groq Whisper kabi oddiy "bir so'rovlik" REST
 * ovoz→matn xizmati aniq hujjatlashtirilmagan. Bu yerda bir nechta
 * ehtimoliy REST endpoint sinaladi. Biror biri ishlasa — matn qaytadi.
 * Hech biri ishlamasa, ANIQ xato qaytadi (qaysi endpoint qanday javob
 * bergani bilan) va chaqiruvchi kod muqovani xom kadrdan yasaydi.
 */

const MAX_BYTES = 24 * 1024 * 1024;

export function transcribeAvailable(): boolean {
  return Boolean(Deno.env.get("NVIDIA_API_KEY"));
}

/** Sinaladigan (endpoint, model) juftliklari — env orqali qo'shsa bo'ladi */
function candidates(): { url: string; model: string }[] {
  const extra = Deno.env.get("NVIDIA_ASR_ENDPOINTS"); // "url|model,url|model"
  if (extra) {
    return extra.split(",").map((s) => {
      const [url, model] = s.split("|").map((x) => x.trim());
      return { url, model: model || "" };
    }).filter((c) => c.url);
  }
  // OpenAI uslubidagi /audio/transcriptions ehtimoli (NVIDIA ba'zi
  // xizmatlarni shu ko'rinishda beradi). Model nomlari NVIDIA ASR
  // katalogidan.
  return [
    { url: "https://integrate.api.nvidia.com/v1/audio/transcriptions", model: "nvidia/canary-1b-asr" },
    { url: "https://integrate.api.nvidia.com/v1/audio/transcriptions", model: "nvidia/parakeet-ctc-1.1b-asr" },
    { url: "https://ai.api.nvidia.com/v1/audio/transcriptions", model: "nvidia/canary-1b-asr" },
  ];
}

/** Turli javob shakllaridan matnni ajratamiz */
function extractText(data: unknown, raw: string): string {
  if (typeof data === "object" && data) {
    const d = data as { text?: string; transcript?: string; results?: { text?: string; transcript?: string }[] };
    const t = d.text || d.transcript || d.results?.[0]?.text || d.results?.[0]?.transcript;
    if (t) return String(t).trim();
  }
  // response_format=text bo'lsa oddiy matn keladi
  if (raw && !raw.trim().startsWith("{") && !raw.trim().startsWith("<")) return raw.trim();
  return "";
}

export async function transcribeVideo(videoUrl: string): Promise<string> {
  const key = Deno.env.get("NVIDIA_API_KEY");
  if (!key) throw new Error("NVIDIA_API_KEY sozlanmagan");

  const vid = await fetch(videoUrl, { signal: AbortSignal.timeout(30_000) });
  if (!vid.ok) throw new Error(`Videoni yuklab bo'lmadi (${vid.status})`);
  const buf = new Uint8Array(await vid.arrayBuffer());
  if (!buf.length) throw new Error("Video bo'sh");
  if (buf.length > MAX_BYTES) {
    throw new Error(`Video juda katta (${Math.round(buf.length / 1024 / 1024)}MB) — ovozni o'qish uchun 24MB gacha bo'lsin`);
  }
  const name = videoUrl.split("/").pop()?.split("?")[0] || "video.mp4";
  const bytes = buf.slice().buffer as ArrayBuffer;

  const errs: string[] = [];
  for (const c of candidates()) {
    try {
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: "video/mp4" }), name);
      form.append("model", c.model);
      form.append("response_format", "json");
      const r = await fetch(c.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
      const raw = await r.text().catch(() => "");
      if (!r.ok) {
        const short = c.model.split("/").pop();
        errs.push(`${short}: ${r.status} ${raw.slice(0, 100)}`);
        continue;
      }
      let data: unknown = null;
      try { data = JSON.parse(raw); } catch { /* text bo'lishi mumkin */ }
      const text = extractText(data, raw);
      if (text) return text;
      errs.push(`${c.model.split("/").pop()}: javobda matn yo'q`);
    } catch (e) {
      const short = c.model.split("/").pop();
      errs.push(`${short}: ${e instanceof Error ? (e.name === "TimeoutError" ? "vaqt tugadi" : e.message) : "xato"}`);
    }
  }
  throw new Error(`NVIDIA ovozni o'qiy olmadi — ${errs.join(" | ")}`);
}
