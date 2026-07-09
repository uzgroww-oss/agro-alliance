import { supabaseAdmin } from "./supabase.ts";
import { ProviderCapability, providerRegistry } from "./provider.ts";
import { buildPrompt } from "./promptEngine.ts";
import { recordCost, checkBudgets } from "./costTracker.ts";
import { executeWithRetry } from "./retryEngine.ts";
import { generateEmbedding, storeEmbedding, findSimilarArticles } from "./embeddingEngine.ts";
import { log } from "./logger.ts";

export type AiProvider = "cloudflare" | "openai" | "internal";

export interface AiValidationResult {
  isValid: boolean;
  confidence: number;
  reasoning: string;
}

export interface AiCategorizationResult {
  categoryId: string | null;
  categoryName: string;
  score: number;
}

export interface AiTranslationResult {
  translatedText: string;
  detectedLanguage: string;
}

export interface AiSummaryResult {
  summary: string;
  keyPoints: string[];
}

export interface AiSeoResult {
  seoTitle: string;
  seoDescription: string;
  tags: string[];
}

/** Helper to invoke a chat model with retries, cost tracking and budget enforcement. */
async function invokeChat(
  purpose: string,
  variables: Record<string, unknown>,
  jobId?: string,
): Promise<{ content: string; usageTokens: number; cost: number }> {
  // Resolve a provider that supports chat capability
  const provider = await providerRegistry.getProvider(ProviderCapability.CHAT);
  if (!provider) throw new Error("No chat provider available");

  // Budget check before invoking
  const providerConf = (provider as any).config as any; // ProviderConfig
  const withinBudget = await checkBudgets(providerConf);
  if (!withinBudget) throw new Error(`Provider ${provider.name} exceeded budget`);

  // Build prompt from template
  const prompt = await buildPrompt(purpose, variables);
  if (!prompt) throw new Error(`Prompt for ${purpose} not found`);

  // Execute with retry logic and circuit‑breaker integration
  const result = await executeWithRetry(
    async () => {
      return await provider.chat([{ role: "user", content: prompt }]);
    },
    provider.name,
  );

  const usageTokens = result.usage.total_tokens;
  const cost = result.cost;

  // Record cost if job context is provided
  if (jobId) {
    await recordCost({
      jobId,
      providerId: providerConf.id,
      modelId: (provider as any).model.id,
      tokens: usageTokens,
      costUsd: cost,
    });
  }

  return { content: result.content as string, usageTokens, cost };
}

/** Validate content via LLM. */
export async function validateContent(
  title: string,
  content: string,
  jobId?: string,
): Promise<AiValidationResult> {
  const variables = { title, content };
  const { content: llmResponse } = await invokeChat("validation", variables, jobId);
  // Expect LLM to return JSON { isValid, confidence, reasoning }
  try {
    const parsed = JSON.parse(llmResponse) as AiValidationResult;
    return parsed;
  } catch {
    // Fallback heuristic if LLM response is not JSON
    const isValid = !(title.toLowerCase().includes("spam") || content.toLowerCase().includes("spam"));
    const confidence = isValid ? 90 : 40;
    const reasoning = isValid ? "Auto‑validated" : "Potential spam detected";
    return { isValid, confidence, reasoning };
  }
}

/** Categorise content via LLM. */
export async function categorizeContent(
  title: string,
  content: string,
  categories: { id: string; name: string }[],
  jobId?: string,
): Promise<AiCategorizationResult> {
  const variables = { title, content, categories: JSON.stringify(categories) };
  const { content: llmResponse } = await invokeChat("categorisation", variables, jobId);
  try {
    const parsed = JSON.parse(llmResponse) as AiCategorizationResult;
    return parsed;
  } catch {
    // Simple fallback – pick first category if any
    if (categories.length === 0) {
      return { categoryId: null, categoryName: "Uncategorized", score: 0 };
    }
    return {
      categoryId: categories[0].id,
      categoryName: categories[0].name,
      score: 70,
    };
  }
}

/** Translate content via LLM. */
export async function translateContent(
  text: string,
  targetLang: string,
  jobId?: string,
): Promise<AiTranslationResult> {
  const variables = { text, targetLang };
  const { content: llmResponse } = await invokeChat("translation", variables, jobId);
  try {
    const parsed = JSON.parse(llmResponse) as AiTranslationResult;
    return parsed;
  } catch {
    // Fallback – return original text and assume Uzbek source
    return { translatedText: text, detectedLanguage: "uz" };
  }
}

/** Summarise content via LLM. */
export async function summarizeContent(
  content: string,
  maxLength: number = 200,
  jobId?: string,
): Promise<AiSummaryResult> {
  const variables = { content, maxLength };
  const { content: llmResponse } = await invokeChat("summarisation", variables, jobId);
  try {
    const parsed = JSON.parse(llmResponse) as AiSummaryResult;
    return parsed;
  } catch {
    const summary = content.substring(0, maxLength);
    return { summary, keyPoints: [] };
  }
}

/** Generate SEO metadata via LLM. */
export async function generateSeo(
  title: string,
  content: string,
  jobId?: string,
): Promise<AiSeoResult> {
  const variables = { title, content };
  const { content: llmResponse } = await invokeChat("seo", variables, jobId);
  try {
    const parsed = JSON.parse(llmResponse) as AiSeoResult;
    return parsed;
  } catch {
    // Fallback heuristic (same as previous implementation)
    const words = content.split(/\s+/).filter(Boolean);
    const description = words.length > 30 ? words.slice(0, 30).join(" ") + "..." : content;
    const tags = words.length > 3 ? words.slice(0, 5).map((w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase()).filter(Boolean) : [];
    return { seoTitle: title, seoDescription: description, tags };
  }
}

/** Compute a deterministic fingerprint using SHA‑256. */
export async function computeFingerprint(title: string, content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${title}\n${content}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `fp_${hashHex}`;
}

/** Semantic duplicate detection using embeddings. */
export async function isDuplicate(
  title: string,
  content: string,
  articleId?: string,
): Promise<{ isDuplicate: boolean; duplicateOf: string | null }> {
  // First attempt exact fingerprint match (fallback for very new articles)
  const fingerprint = await computeFingerprint(title, content);
  const { data: exact, error } = await supabaseAdmin
    .from("news_articles")
    .select("id")
    .eq("fingerprint", fingerprint)
    .neq("id", articleId ?? "0")
    .maybeSingle();
  if (!error && exact) {
    return { isDuplicate: true, duplicateOf: (exact as any).id };
  }

  // Fallback – semantic similarity via embeddings
  const vector = await generateEmbedding(content);
  // Store temporary embedding for this check only (not persisted)
  const similar = await findSimilarArticles(vector, 0.85);
  const dup = similar.find((s) => s.article_id !== articleId);
  if (dup) return { isDuplicate: true, duplicateOf: dup.article_id };
  // If no duplicate, optionally store embedding for future checks
  if (articleId) {
    await storeEmbedding(articleId, vector);
  }
  return { isDuplicate: false, duplicateOf: null };
}

/** Very light language detection – retained for backward compatibility. */
export function detectLanguage(text: string): string {
  if (!text) return "unknown";
  // Use simple heuristic based on Unicode ranges (Cyrillic vs Latin)
  let cyr = 0,
    lat = 0,
    total = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if ((code >= 0x0400 && code <= 0x04ff) || code === 0x0401 || code === 0x0451) {
      cyr++;
      total++;
    } else if ((code >= 0x0041 && code <= 0x005a) || (code >= 0x0061 && code <= 0x007a)) {
      lat++;
      total++;
    }
  }
  if (total === 0) return "unknown";
  return cyr / total > 0.5 ? "uz-cyrl" : "uz-latn";
}
