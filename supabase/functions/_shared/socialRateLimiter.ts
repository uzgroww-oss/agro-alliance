/**
 * Social Rate Limiter – token‑bucket implementation shared by all social platform workers.
 * Uses the same `increment_rate_limit` DB function that the AI framework uses.
 */

import { supabaseAdmin } from "./supabase.ts";
import { log } from "./logger.ts";

export async function checkSocialRateLimit(providerName: string, tokens: number = 1): Promise<boolean> {
  // Expect per‑provider config stored in `ai_providers` under `name` (re‑use the table)
  const { data: prov, error } = await supabaseAdmin.from("ai_providers").select("id, config").eq("name", providerName).single();
  if (error || !prov) {
    log("error", `RateLimiter: provider ${providerName} not found`);
    return false;
  }
  const providerId = (prov as any).id as string;
  const cfg = (prov as any).config as Record<string, unknown>;
  const minuteQuota = typeof cfg["rate_limit_per_minute"] === "number" ? (cfg["rate_limit_per_minute"] as number) : 10_000;
  const dayQuota = typeof cfg["rate_limit_per_day"] === "number" ? (cfg["rate_limit_per_day"] as number) : 200_000;

  const { data, error: fnErr } = await supabaseAdmin.rpc("increment_rate_limit", {
    p_provider_id: providerId,
    p_model_id: "social", // dummy model id – not used for counting per model
    p_tokens: tokens,
    p_minute_quota: minuteQuota,
    p_day_quota: dayQuota,
  });
  if (fnErr) {
    log("error", `RateLimiter RPC error for ${providerName}: ${fnErr.message}`);
    return false;
  }
  return data as boolean;
}
