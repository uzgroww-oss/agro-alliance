/**
 * Simple metrics collector – records numeric measurements into the `ai_metrics`
 * table. Workers and providers call this to log latency, token usage, cost,
 * retries, etc.
 */

import { supabaseAdmin } from "./supabase.ts";
import { log } from "./logger.ts";

export async function recordMetric(
  providerId: string,
  modelId: string,
  name: string,
  value: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin.from("ai_metrics").insert({
    provider_id: providerId,
    model_id: modelId,
    metric_name: name,
    metric_value: value,
    metadata: metadata ? JSON.stringify(metadata) : null,
    recorded_at: new Date().toISOString(),
  });
  if (error) {
    log("error", `Failed to record metric ${name}: ${error.message}`);
  }
}
