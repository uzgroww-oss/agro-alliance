/**
 * Embedding Engine – handles vector generation via LLM providers, storage, and
 * semantic similarity lookup.
 */

import { supabaseAdmin } from "./supabase.ts";
import { log } from "./logger.ts";
import { providerRegistry, ProviderCapability } from "./provider.ts";

/** Cosine similarity between two numeric arrays */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Generate an embedding for a piece of text using the best available provider. */
export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = await providerRegistry.getProvider(ProviderCapability.EMBEDDING);
  if (!provider) {
    throw new Error("No available embedding provider")
  }
  const result = await provider.embed(text);
  // result.content is the numeric vector
  return result.content as unknown as number[];
}

/** Store an embedding for an article. */
export async function storeEmbedding(articleId: string, vector: number[]): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ai_embeddings")
    .upsert({ article_id: articleId, vector })
    .eq("article_id", articleId);
  if (error) {
    log("error", `Failed to store embedding for ${articleId}: ${error.message}`);
  }
}

/** Find similar articles based on cosine similarity. */
export async function findSimilarArticles(
  sourceVector: number[],
  threshold = 0.85,
  limit = 5,
): Promise<Array<{ article_id: string; similarity: number }>> {
  // Pull all stored embeddings – for large datasets a proper vector DB (pgvector) is recommended.
  const { data, error } = await supabaseAdmin
    .from("ai_embeddings")
    .select("article_id, vector");
  if (error) {
    log("error", `Embedding lookup failed: ${error.message}`);
    return [];
  }
  const results: Array<{ article_id: string; similarity: number }> = [];
  for (const row of data as any[]) {
    const vec: number[] = row.vector;
    const sim = cosineSimilarity(sourceVector, vec);
    if (sim >= threshold) {
      results.push({ article_id: row.article_id, similarity: sim });
    }
  }
  // Sort descending by similarity and limit
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}
