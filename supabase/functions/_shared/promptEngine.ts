/**
 * Prompt Engine – loads versioned prompt templates from the DB, renders them with variables,
 * supports experiments (by version) and provides a simple API for the AI workers.
 */

import { supabaseAdmin } from "./supabase.ts";
import { log } from "./logger.ts";

export interface PromptTemplate {
  id: string;
  purpose: string; // e.g. 'validation', 'categorisation', 'translation', ...
  version: number;
  template: string;
  created_at: string;
  updated_at: string;
}

/**
 * Load the latest version of a prompt for a given purpose.
 * Returns null if no template exists.
 */
export async function getLatestPrompt(purpose: string): Promise<PromptTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_prompt_templates")
    .select("*")
    .eq("purpose", purpose)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (error) {
    log("error", `Failed to load latest prompt for ${purpose}: ${error.message}`);
    return null;
  }
  return data as PromptTemplate;
}

/** Load a specific version */
export async function getPromptByVersion(purpose: string, version: number): Promise<PromptTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_prompt_templates")
    .select("*")
    .eq("purpose", purpose)
    .eq("version", version)
    .single();
  if (error) {
    log("warn", `Prompt version ${version} for ${purpose} not found: ${error.message}`);
    return null;
  }
  return data as PromptTemplate;
}

/**
 * Render a template by substituting {{variable}} placeholders.
 * Variables not found in the template are ignored.
 */
export function renderPrompt(template: string, variables: Record<string, unknown>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = (variables as any)[key];
    return value !== undefined && value !== null ? String(value) : "";
  });
}

/**
 * Resolve the appropriate prompt for a purpose.
 * If the environment variable EXPERIMENT_ID is set, we attempt to load the
 * version that matches the experiment; otherwise we fall back to the latest.
 */
export async function resolvePrompt(purpose: string, experimentVersion?: number): Promise<PromptTemplate | null> {
  if (experimentVersion !== undefined) {
    const byVer = await getPromptByVersion(purpose, experimentVersion);
    if (byVer) return byVer;
  }
  // If an ENV experiment flag is set, try to read a version from it.
  const envVersionStr = Deno.env.get("EXP_PROMPT_" + purpose.toUpperCase());
  if (envVersionStr) {
    const envVersion = parseInt(envVersionStr, 10);
    if (!isNaN(envVersion)) {
      const envPrompt = await getPromptByVersion(purpose, envVersion);
      if (envPrompt) return envPrompt;
    }
  }
  // Default to latest
  return await getLatestPrompt(purpose);
}

/** Simple wrapper that loads, renders and returns the final prompt text. */
export async function buildPrompt(
  purpose: string,
  variables: Record<string, unknown>,
  experimentVersion?: number,
): Promise<string | null> {
  const tmpl = await resolvePrompt(purpose, experimentVersion);
  if (!tmpl) {
    log("error", `No prompt template found for purpose ${purpose}`);
    return null;
  }
  return renderPrompt(tmpl.template, variables);
}
