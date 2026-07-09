/**
 * Gemini AI helper — direct API calls without provider framework.
 * Uses GEMINI_API_KEY from Supabase Secrets.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not set in Supabase Secrets");
  return key;
}

export async function geminiChat(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<{ text: string; tokens: number }> {
  const apiKey = getApiKey();
  const model = opts?.model ?? "gemini-2.0-flash";
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts?.temperature ?? 0.7,
      maxOutputTokens: opts?.maxTokens ?? 2048,
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const tokens = data.usageMetadata?.totalTokenCount ?? 0;

  return { text, tokens };
}

/**
 * Convenience: ask Gemini to return JSON. Strips markdown fences and parses.
 */
export async function geminiJson<T = unknown>(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<T> {
  const { text } = await geminiChat(prompt, opts);
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
