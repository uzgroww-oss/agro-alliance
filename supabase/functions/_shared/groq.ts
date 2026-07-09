/**
 * Groq AI helper — fast, free AI with Llama 3.
 * Uses GROQ_API_KEY from Supabase Secrets.
 * Fallback: Gemini → basic translation.
 */

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
  opts?: { model?: string; temperature?: number; maxTokens?: number; retries?: number },
): Promise<{ text: string; tokens: number }> {
  const apiKey = getApiKey();
  const model = opts?.model ?? "llama-3.1-8b-instant";
  const maxRetries = opts?.retries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(3000 * attempt);
    }

    const url = `${GROQ_BASE}/chat/completions`;
    const body = {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 2048,
    };

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
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
 * Ask Groq to return JSON. Strips markdown fences and parses.
 */
export async function groqJson<T = unknown>(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number; retries?: number },
): Promise<T> {
  const { text } = await groqChat(prompt, opts);
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
