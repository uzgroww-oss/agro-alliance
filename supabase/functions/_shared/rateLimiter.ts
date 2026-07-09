/**
 * Rate Limiter – token bucket implementation using Postgres atomic counters.
 *
 * Limits are defined per‑provider/per‑model in the provider configuration JSON:
 *   {
 *     "rate_limit_per_minute": 1000,
 *     "rate_limit_per_day": 20000
 *   }
 *
 * The function `checkAndConsume` returns true if the request fits within the limits
 * and atomically increments the counters, otherwise false.
 */

import { supabaseAdmin } from "./supabase.ts";
import { log } from "./logger.ts";

/** Result of a rate‑limit check */
export interface RateCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Verify limits and atomically consume a request.
 * Returns {allowed:true} if the request may proceed, otherwise {allowed:false, reason}.
 */
export async function checkAndConsume(
  providerId: string,
  modelId: string,
  tokensRequested: number,
): Promise<RateCheckResult> {
  // Pull limits from provider config – we query the provider row directly.
  const { data: prov, error } = await supabaseAdmin
    .from("ai_providers")
    .select("config")
    .eq("id", providerId)
    .single();
  if (error || !prov) {
    log("error", `RateLimiter: failed to load provider ${providerId}`);
    return { allowed: false, reason: "provider config missing" };
  }
  const cfg = (prov as any).config as Record<string, unknown>;
  const minuteQuota = typeof cfg["rate_limit_per_minute"] === "number" ? (cfg["rate_limit_per_minute"] as number) : 10_000;
  const dayQuota = typeof cfg["rate_limit_per_day"] === "number" ? (cfg["rate_limit_per_day"] as number) : 200_000;

  const { data, error: fnErr } = await supabaseAdmin.rpc("increment_rate_limit", {
    p_provider_id: providerId,
    p_model_id: modelId,
    p_tokens: tokensRequested,
    p_minute_quota: minuteQuota,
    p_day_quota: dayQuota,
  });
  if (fnErr) {
    log("error", `RateLimiter RPC error: ${fnErr.message}`);
    return { allowed: false, reason: fnErr.message };
  }
  // The function returns boolean
  const allowed = data as boolean;
  if (!allowed) {
    return { allowed: false, reason: "quota exceeded" };
  }
  return { allowed: true };
}
