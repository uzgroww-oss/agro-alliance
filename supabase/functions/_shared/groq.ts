/**
 * Groq AI helper — fast, free AI with Llama 3.
 * Uses GROQ_API_KEY from Supabase Secrets.
 * Fallback: Gemini → basic translation.
 */

import { parseJson } from "./jsonExtract.ts";

const GROQ_BASE = "https://api.groq.com/openai/v1";

function getApiKey(): string {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw new Error("GROQ_API_KEY not set");
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function groqChat(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number; retries?: number; json?: boolean; timeoutMs?: number },
): Promise<{ text: string; tokens: number }> {
  const apiKey = getApiKey();
  const model = opts?.model ?? "llama-3.1-8b-instant";
  const maxRetries = opts?.retries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(3000 * attempt);
    }

    const url = `${GROQ_BASE}/chat/completions`;
    // json rejimi — model FAQAT yaroqli JSON qaytaradi.
    // Usiz kichik modellar qo'shtirnoqsiz kalit yoki tushuntirish matni
    // qo'shib yuborardi va JSON.parse yiqilardi.
    // Talab: so'rovda "JSON" so'zi bo'lishi shart (bizning matnda bor).
    // frequency_penalty MUHIM: llama-3.1-8b-instant kichik model va
    // usiz bir xil jumlani o'nlab marta takrorlab ketadi
    // ("Issiqxona uchun foydali takliflar" 20 marta kabi).
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 2048,
      frequency_penalty: 0.6,
      presence_penalty: 0.3,
    };
    if (opts?.json) body.response_format = { type: "json_object" };

    try {
      // Provayder sekin bo'lsa butun so'rovni to'sib qo'yadi —
      // shuning uchun har biriga alohida chegara
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts?.timeoutMs ?? 25_000),
      });

      if (resp.status === 429) {
        if (attempt < maxRetries) continue;
        throw new Error("Groq rate limited");
      }

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Groq error ${resp.status}: ${err}`);
      }

      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      const tokens = data.usage?.total_tokens ?? 0;

      return { text, tokens };
    } catch (e) {
      if (attempt === maxRetries) throw e;
    }
  }

  throw new Error("Groq — unexpected end of retry loop");
}

/**
 * Ask Groq to return JSON.
 *
 * MUHIM: ilgari bu yerda /\[[\s\S]*\]/ regexi ishlatilardi — u avval
 * massiv qidirardi va obyekt ichidagi birinchi massivni (masalan
 * "hashtaglar") tortib olib, butun javobni yo'qotardi. Endi qavslar
 * muvozanati bo'yicha ajratiladi.
 */
export async function groqJson<T = unknown>(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number; retries?: number; timeoutMs?: number },
): Promise<T> {
  const { text } = await groqChat(prompt, { ...opts, json: true });
  return parseJson<T>(text);
}
