/**
 * Retry Engine – encapsulates exponential back‑off, max attempts, and integrates
 * with the ProviderRegistry's circuit‑breaker tracking.
 */

import { providerRegistry } from "./provider.ts";
import { log } from "./logger.ts";

/** Simple sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Execute an async function with retry logic.
 *  - `fn` is the operation (e.g. a provider LLM call).
 *  - `providerName` is used for circuit‑breaker bookkeeping.
 *  - `maxAttempts` defaults to 5.
 *  - `baseDelay` is the initial back‑off in ms (default 500).
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  providerName: string,
  maxAttempts = 5,
  baseDelay = 500,
): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const result = await fn();
      // Success – reset failure counter in registry
      providerRegistry.recordSuccess(providerName);
      return result;
    } catch (err) {
      // Failure – record it
      providerRegistry.recordFailure(providerName);
      if (attempt >= maxAttempts) {
        log("error", `All retries exhausted for provider ${providerName}: ${err}`);
        throw err;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      log("warn", `Retry ${attempt}/${maxAttempts} for ${providerName} after ${delay}ms – ${err}`);
      await sleep(delay);
    }
  }
}
