/**
 * Centralised AI request logger – writes a row to `ai_job_logs` (or a similar
 * table) with all relevant details for observability and debugging.
 */

import { supabaseAdmin } from "./supabase.ts";
import { log } from "./logger.ts";

export async function logAiRequest(params: {
  jobId?: string;
  providerId: string;
  modelId: string;
  articleId?: string;
  workerId?: string;
  promptVersion?: number;
  requestTokens: number;
  responseTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  retries: number;
  success: boolean;
  errorMessage?: string;
}) {
  const { error } = await supabaseAdmin.from("ai_job_logs").insert({
    job_id: params.jobId ?? null,
    provider_id: params.providerId,
    model_id: params.modelId,
    article_id: params.articleId ?? null,
    worker_id: params.workerId ?? null,
    prompt_version: params.promptVersion ?? null,
    request_tokens: params.requestTokens,
    response_tokens: params.responseTokens,
    total_tokens: params.totalTokens,
    cost_usd: params.costUsd,
    latency_ms: params.latencyMs,
    retry_count: params.retries,
    success: params.success,
    error_message: params.errorMessage ?? null,
    logged_at: new Date().toISOString(),
  });
  if (error) {
    log("error", `Failed to log AI request: ${error.message}`);
  }
}
