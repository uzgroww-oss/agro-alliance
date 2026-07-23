/**
 * AI javobidan JSON bo'lagini ajratib olish.
 *
 * NEGA KERAK: AI modellar ko'pincha JSON atrofiga matn yoki ```json
 * belgilarini qo'shib yuboradi. Oddiy regex bilan ajratish xavfli —
 * masalan /\[[\s\S]*\]/ obyekt ichidagi birinchi massivni tortib oladi
 * va butun javob o'rniga faqat shu bo'lak qaytadi.
 *
 * Bu yerda birinchi ochiluvchi qavsdan boshlab qavslar MUVOZANATI
 * bo'yicha yuriladi. Qo'shtirnoq ichidagi qavslar hisobga olinmaydi.
 */
export function extractJson(text: string): string {
  const t = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  const start = t.search(/[[{]/);
  if (start === -1) throw new Error("javobda JSON yo'q");

  const open = t[start];
  const close = open === "[" ? "]" : "}";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < t.length; i++) {
    const c = t[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }

    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return t.slice(start, i + 1);
    }
  }

  throw new Error("JSON tugallanmagan");
}

export function parseJson<T>(text: string): T {
  const raw = extractJson(text);
  try {
    return JSON.parse(raw) as T;
  } catch {
    // JSON.parse xabari ("Expected value in JSON at position 126") sabab
    // haqida hech narsa aytmaydi. Javobning boshini ko'rsatamiz —
    // model nima qaytarganini darhol bilish uchun.
    throw new Error(`javobni o'qib bo'lmadi: ${raw.slice(0, 120)}`);
  }
}
