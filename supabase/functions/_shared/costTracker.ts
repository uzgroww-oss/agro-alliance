/**
 * Cost Tracker – records LLM usage costs, enforces daily/monthly budgets, and provides usage stats.
 * All costs are stored in the `ai_costs` table.
 */

import { supabaseAdmin } from "./supabase.ts";
import { log } from "./logger.ts";
import { ProviderConfig } from "./provider.ts";

/** Insert a cost record for a finished LLM call. */
export async function recordCost(params: {
  jobId: string;
  providerId: string;
  modelId: string;
  tokens: number;
  costUsd: number;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ai_costs")
    .insert({
      job_id: params.jobId,
      provider_id: params.providerId,
      model_id: params.modelId,
      tokens_used: params.tokens,
      cost_usd: params.costUsd,
      timestamp: new Date().toISOString(),
    });
  if (error) {
    log("error", `Failed to record cost: ${error.message}`);
  }
}

/** Compute total cost for a provider for the current day (UTC). */
export async function getDailyCost(providerId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("ai_costs")
    .select("cost_usd")
    .eq("provider_id", providerId)
    .gte("timestamp", new Date().toISOString().slice(0, 10) + "T00:00:00Z")
    .lte("timestamp", new Date().toISOString().slice(0, 10) + "T23:59:59Z");
  if (error) {
    log("error", `Failed to fetch daily cost: ${error.message}`);
    return 0;
  }
  const total = (data as any[]).reduce((sum, row) => sum + Number(row.cost_usd || 0), 0);
  return total;
}

/** Compute total cost for a provider for the current month (UTC). */
export async function getMonthlyCost(providerId: string): Promise<number> {
  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00Z`;
  const { data, error } = await supabaseAdmin
    .from("ai_costs")
    .select("cost_usd")
    .eq("provider_id", providerId)
    .gte("timestamp", monthStart);
  if (error) {
    log("error", `Failed to fetch monthly cost: ${error.message}`);
    return 0;
  }
  const total = (data as any[]).reduce((sum, row) => sum + Number(row.cost_usd || 0), 0);
  return total;
}

/** Check whether a provider is within its configured budgets.
 *  Provider config JSON can contain `daily_budget_usd` and `monthly_budget_usd` fields.
 */
export async function checkBudgets(provider: ProviderConfig): Promise<boolean> {
  const dailyBudget = typeof provider.config?.daily_budget_usd === "number" ? provider.config.daily_budget_usd : null;
  const monthlyBudget = typeof provider.config?.monthly_budget_usd === "number" ? provider.config.monthly_budget_usd : null;

  if (dailyBudget !== null) {
    const used = await getDailyCost(provider.id);
    if (used >= dailyBudget) {
      log("warn", `Provider ${provider.name} exceeded daily budget (${used}/${dailyBudget})`);
      return false;
    }
  }
  if (monthlyBudget !== null) {
    const used = await getMonthlyCost(provider.id);
    if (used >= monthlyBudget) {
      log("warn", `Provider ${provider.name} exceeded monthly budget (${used}/${monthlyBudget})`);
      return false;
    }
  }
  return true;
}
