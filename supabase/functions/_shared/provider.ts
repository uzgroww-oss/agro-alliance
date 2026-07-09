/**
 * AI Provider Framework – core implementation.
 *
 * This module defines a generic LLM provider interface, concrete provider
 * implementations (OpenAI, Anthropic, Cloudflare AI), a registry that loads
 * configuration from the database, health monitoring, capability detection,
 * priority/fail‑over, circuit‑breaker, rate‑limiting and a retry engine.
 */

import { supabaseAdmin } from "./supabase.ts";
import { now } from "./time.ts";
import { log } from "./logger.ts";
import { countTokensForModel } from "./tokenizer.ts";
import { recordMetric } from "./metrics.ts";
import { logAiRequest } from "./aiLogger.ts";

/** Provider capabilities – a provider may implement a subset of these. */
export enum ProviderCapability {
  CHAT = "chat", // Completion / chat based generation
  EMBEDDING = "embedding",
  IMAGE = "image",
  AUDIO = "audio",
}

/** Configuration as stored in `ai_providers` and `ai_models`. */
export interface ProviderConfig {
  id: string;
  name: string; // e.g. "openai", "anthropic", "cloudflare"
  type: "openai" | "anthropic" | "cloudflare" | "azure" | "gemini";
  enabled: boolean;
  priority: number; // lower number = higher priority
  secret_name: string; // name of the secret in Supabase/Env
  config: Record<string, unknown>; // optional extra config per provider
}

export interface ModelConfig {
  id: string;
  provider_id: string;
  model_name: string; // e.g. "gpt-4o-mini"
  max_tokens: number;
  temperature: number;
  top_p?: number;
  enabled: boolean;
  // cost per 1,000 tokens in USD (set by admins)
  cost_per_1k: number;
}

/** LLM request / response shapes */
export interface LlmPayload {
  messages?: { role: string; content: string }[]; // chat style
  prompt?: string; // for completions
  /** For embeddings – raw text */
  input?: string;
  /** Raw model config overrides */
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface LlmUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface LlmResult<T = unknown> {
  content: T;
  usage: LlmUsage;
  /** Cost in USD calculated from usage and model pricing */
  cost: number;
  raw_response: unknown;
}

/** Abstract provider – concrete classes must implement the methods they support. */
export abstract class BaseProvider {
  constructor(public config: ProviderConfig, public model: ModelConfig) {}

  /** Human readable name */
  get name() {
    return this.config.name;
  }

  /** Capability flags – override in subclass */
  abstract capabilities: Set<ProviderCapability>;

  /** Retrieve the secret (API key) from the environment. */
  protected get apiKey(): string | undefined {
    return Deno.env.get(this.config.secret_name);
  }

  /** Health check – providers can override with a cheap endpoint. */
  async healthCheck(): Promise<boolean> {
    // default to a simple HEAD request to the base URL if known
    return !!this.apiKey;
  }

  /** Generic invoke – low‑level call to the provider. */
  abstract invoke<T>(payload: LlmPayload): Promise<LlmResult<T>>;

  /** Optional chat method – wrappers around invoke */
  async chat(messages: { role: string; content: string }[]): Promise<LlmResult<string>> {
    if (!this.capabilities.has(ProviderCapability.CHAT)) {
      throw new Error(`${this.name} does not support chat`);
    }
    const payload: LlmPayload = { messages };
    return await this.invoke<string>(payload);
  }

  /** Optional embedding method */
  async embed(text: string): Promise<LlmResult<number[]>> {
    if (!this.capabilities.has(ProviderCapability.EMBEDDING)) {
      throw new Error(`${this.name} does not support embeddings`);
    }
    const payload: LlmPayload = { input: text };
    return await this.invoke<number[]>(payload);
  }
}

/** Concrete OpenAI provider */
export class OpenAIProvider extends BaseProvider {
  capabilities = new Set([ProviderCapability.CHAT, ProviderCapability.EMBEDDING]);
  private baseUrl = "https://api.openai.com/v1";

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async invoke<T>(payload: LlmPayload): Promise<LlmResult<T>> {
    const start = Date.now();
    const endpoint = payload.input ? "/embeddings" : "/chat/completions";
    const url = `${this.baseUrl}${endpoint}`;
    const body: any = {
      model: this.model.model_name,
      ...payload,
    };
    // enforce max tokens & temperature defaults from model config
    if (!payload.max_tokens) body.max_tokens = this.model.max_tokens;
    if (!payload.temperature) body.temperature = this.model.temperature;
    if (payload.top_p !== undefined) body.top_p = payload.top_p;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI error: ${resp.status} ${err}`);
    }
    const data = await resp.json();
    // Parse usage & content based on endpoint type
    let content: any;
    if (endpoint === "/chat/completions") {
      content = data.choices?.[0]?.message?.content ?? "";
    } else {
      // embeddings endpoint returns data[0].embedding
      content = data.data?.[0]?.embedding ?? [];
    }
    const usage = data.usage as LlmUsage;
    const cost = (usage.total_tokens / 1000) * this.model.cost_per_1k;
    const latency = Date.now() - start;
    // Record metrics and detailed log
    await recordMetric(this.config.id, this.model.id, "latency_ms", latency);
    await recordMetric(this.config.id, this.model.id, "cost_usd", cost);
    await logAiRequest({
      providerId: this.config.id,
      modelId: this.model.id,
      requestTokens: usage.prompt_tokens,
      responseTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      costUsd: cost,
      latencyMs: latency,
      retries: 0,
      success: true,
    });
    return { content, usage, cost, raw_response: data };
  }
}

/** Concrete Anthropic provider */
export class AnthropicProvider extends BaseProvider {
  capabilities = new Set([ProviderCapability.CHAT]);
  private baseUrl = "https://api.anthropic.com/v1";

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey ?? "",
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: this.model.model_name, max_tokens: 1, messages: [] }),
      });
      // Anthropic returns 400 for empty message but we only care about connectivity
      return resp.status !== 401 && resp.status !== 403;
    } catch {
      return false;
    }
  }

  async invoke<T>(payload: LlmPayload): Promise<LlmResult<T>> {
    const start = Date.now();
    const url = `${this.baseUrl}/messages`;
    const body = {
      model: this.model.model_name,
      max_tokens: payload.max_tokens ?? this.model.max_tokens,
      temperature: payload.temperature ?? this.model.temperature,
      top_p: payload.top_p ?? this.model.top_p,
      messages: payload.messages,
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey ?? "",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic error: ${resp.status} ${err}`);
    }
    const data = await resp.json();
    const content = data.content?.[0]?.text ?? "";
    // Approximate token usage using model‑specific tokenizer
    const usage = {
      prompt_tokens: countTokensForModel(JSON.stringify(payload.messages), this.model.model_name),
      completion_tokens: countTokensForModel(content, this.model.model_name),
      total_tokens: countTokensForModel(JSON.stringify(payload.messages), this.model.model_name) + countTokensForModel(content, this.model.model_name),
    } as LlmUsage;
    const cost = (usage.total_tokens / 1000) * this.model.cost_per_1k;
    const latency = Date.now() - start;
    await recordMetric(this.config.id, this.model.id, "latency_ms", latency);
    await recordMetric(this.config.id, this.model.id, "cost_usd", cost);
    await logAiRequest({
      providerId: this.config.id,
      modelId: this.model.id,
      requestTokens: usage.prompt_tokens,
      responseTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      costUsd: cost,
      latencyMs: latency,
      retries: 0,
      success: true,
    });
    return { content: content as unknown as T, usage, cost, raw_response: data };
  }
}

/** Concrete Google Gemini provider */
export class GeminiProvider extends BaseProvider {
  capabilities = new Set([ProviderCapability.CHAT]);
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`,
      );
      return resp.ok;
    } catch {
      return false;
    }
  }

  async invoke<T>(payload: LlmPayload): Promise<LlmResult<T>> {
    const start = Date.now();
    const model = this.model.model_name || "gemini-2.0-flash";
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    const contents = (payload.messages ?? []).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: any = {
      contents,
      generationConfig: {
        maxOutputTokens: payload.max_tokens ?? this.model.max_tokens,
        temperature: payload.temperature ?? this.model.temperature,
        topP: payload.top_p ?? this.model.top_p,
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini error: ${resp.status} ${err}`);
    }

    const data = await resp.json();
    const content =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const usageData = data.usageMetadata ?? {};
    const usage: LlmUsage = {
      prompt_tokens: usageData.promptTokenCount ?? 0,
      completion_tokens: usageData.candidatesTokenCount ?? 0,
      total_tokens: usageData.totalTokenCount ?? 0,
    };
    const cost = (usage.total_tokens / 1000) * this.model.cost_per_1k;
    const latency = Date.now() - start;

    await recordMetric(this.config.id, this.model.id, "latency_ms", latency);
    await recordMetric(this.config.id, this.model.id, "cost_usd", cost);
    await logAiRequest({
      providerId: this.config.id,
      modelId: this.model.id,
      requestTokens: usage.prompt_tokens,
      responseTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      costUsd: cost,
      latencyMs: latency,
      retries: 0,
      success: true,
    });

    return { content: content as unknown as T, usage, cost, raw_response: data };
  }
}

/** Concrete Cloudflare AI provider */
export class CloudflareProvider extends BaseProvider {
  capabilities = new Set([ProviderCapability.CHAT, ProviderCapability.EMBEDDING]);
  private accountId = Deno.env.get("CF_ACCOUNT_ID") ?? "";
  private baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai`;

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: this.model.model_name, messages: [{ role: "user", content: "ping" }] }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async invoke<T>(payload: LlmPayload): Promise<LlmResult<T>> {
    const start = Date.now();
    const endpoint = payload.input ? "/embeddings" : "/run";
    const url = `${this.baseUrl}${endpoint}`;
    const body: any = {
      model: this.model.model_name,
      ...(payload.messages ? { messages: payload.messages } : {}),
      ...(payload.input ? { text: payload.input } : {}),
      max_tokens: payload.max_tokens ?? this.model.max_tokens,
      temperature: payload.temperature ?? this.model.temperature,
      top_p: payload.top_p ?? this.model.top_p,
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Cloudflare AI error: ${resp.status} ${err}`);
    }
    const data = await resp.json();
    let content: any;
    if (endpoint === "/run") {
      content = data.result?.response ?? "";
    } else {
      content = data.result?.embedding ?? [];
    }
    const usage = {
      prompt_tokens: countTokensForModel(JSON.stringify(payload), this.model.model_name),
      completion_tokens: countTokensForModel(content, this.model.model_name),
      total_tokens: countTokensForModel(JSON.stringify(payload), this.model.model_name) + countTokensForModel(content, this.model.model_name),
    } as LlmUsage;
    const cost = (usage.total_tokens / 1000) * this.model.cost_per_1k;
    const latency = Date.now() - start;
    await recordMetric(this.config.id, this.model.id, "latency_ms", latency);
    await recordMetric(this.config.id, this.model.id, "cost_usd", cost);
    await logAiRequest({
      providerId: this.config.id,
      modelId: this.model.id,
      requestTokens: usage.prompt_tokens,
      responseTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      costUsd: cost,
      latencyMs: latency,
      retries: 0,
      success: true,
    });
    return { content: content as unknown as T, usage, cost, raw_response: data };
  }
}

/** Simple whitespace token counter – can be replaced with a proper tokenizer later. */
export function countTokens(text: string | number | unknown[]): number {
  if (Array.isArray(text)) {
    return text.reduce((c, v) => c + countTokens(v as any), 0);
  }
  if (typeof text === "number") return 1;
  if (typeof text !== "string") return 0;
  // Approximate token = word count (split on whitespace)
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Registry that loads providers from the DB and manages health/failover. */
export class ProviderRegistry {
  private providers: BaseProvider[] = [];
  private healthCache: Map<string, boolean> = new Map();
  private circuitState: Map<string, {state: "closed" | "open" | "half-open"; failures: number; backoffMs: number; nextAttempt: number}> = new Map();
  private lastRefresh = 0;
  private refreshIntervalMs = 60_000; // refresh health every minute

  /** Load providers from DB – called lazily on first use. */
  private async loadProviders(): Promise<void> {
    const { data: provs, error } = await supabaseAdmin
      .from("ai_providers")
      .select("*, ai_models(*)")
      .eq("enabled", true)
      .order("priority", { ascending: true });
    if (error) throw error;
    if (!provs) return;
    this.providers = provs.map((p: any) => {
      const model: ModelConfig = p.ai_models[0]; // each provider has exactly one active model for now
      switch (p.type) {
        case "openai":
          return new OpenAIProvider(p as ProviderConfig, model);
        case "anthropic":
          return new AnthropicProvider(p as ProviderConfig, model);
        case "cloudflare":
          return new CloudflareProvider(p as ProviderConfig, model);
        case "gemini":
          return new GeminiProvider(p as ProviderConfig, model);
        default:
          throw new Error(`Unsupported provider type ${p.type}`);
      }
    });
  }

  /** Public method to get a provider that supports the required capability.
   *  It performs health checks, respects circuit‑breaker state and priority ordering.
   */
  async getProvider(capability: ProviderCapability): Promise<BaseProvider | null> {
    // Refresh health cache periodically
    if (Date.now() - this.lastRefresh > this.refreshIntervalMs) {
      await this.refreshHealth();
      this.lastRefresh = Date.now();
    }
    // Ensure providers are loaded
    if (this.providers.length === 0) await this.loadProviders();
    for (const prov of this.providers) {
      if (!prov.capabilities.has(capability)) continue;
      const healthy = this.healthCache.get(prov.name) ?? false;
      if (!healthy) continue;
       const cState = this.circuitState.get(prov.name);
       // Skip if circuit is open and backoff has not elapsed
       if (cState && cState.state === "open" && Date.now() < cState.nextAttempt) continue;
       // If just moved to half‑open, allow a single request
       if (cState && cState.state === "open" && Date.now() >= cState.nextAttempt) {
         cState.state = "half-open";
         this.circuitState.set(prov.name, cState);
       }
       if (cState && cState.state === "half-open" && cState.failures > 0) continue; // already tried half‑open and failed
       return prov;
      return prov;
    }
    return null; // none available
  }

  /** Refresh health status for all loaded providers. */
  async refreshHealth(): Promise<void> {
    for (const prov of this.providers) {
      try {
        const healthy = await prov.healthCheck();
        this.healthCache.set(prov.name, healthy);
        if (!healthy) {
          log("warn", `${prov.name} health check failed`, { function: "ProviderRegistry.refreshHealth" });
        }
      } catch (e) {
        this.healthCache.set(prov.name, false);
        log("error", `Health check exception for ${prov.name}: ${e}`);
      }
    }
  }

  /** Record a failure for a provider – used by the circuit‑breaker with exponential back‑off. */
  recordFailure(providerName: string): void {
    const state = this.circuitState.get(providerName) ?? { state: "closed", failures: 0, backoffMs: 0, nextAttempt: 0 };
    state.failures += 1;
    // If failures exceed threshold, open circuit with exponential back‑off
    const failureThreshold = 5; // could be made configurable per provider
    if (state.failures >= failureThreshold) {
      // Compute backoff: start at 1 minute, double each time
      state.backoffMs = state.backoffMs ? state.backoffMs * 2 : 60_000;
      state.state = "open";
      state.nextAttempt = Date.now() + state.backoffMs;
      log("warn", `Circuit breaker opened for ${providerName}, backoff ${state.backoffMs / 1000}s`);
    }
    this.circuitState.set(providerName, state);
  }

  /** Record a successful call – may close circuit or move from half‑open to closed. */
  recordSuccess(providerName: string): void {
    const state = this.circuitState.get(providerName);
    if (!state) return;
    if (state.state === "half-open" || state.state === "open") {
      // Successful call closes the circuit
      state.state = "closed";
      state.failures = 0;
      state.backoffMs = 0;
      state.nextAttempt = 0;
    } else {
      // Normal operation – reset failures counter
      state.failures = 0;
    }
    this.circuitState.set(providerName, state);
  }
}

/** Global singleton – reused across workers/functions */
export const providerRegistry = new ProviderRegistry();
