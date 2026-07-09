/**
 * Cron job – scans for newly published articles and enqueues social publishing jobs.
 * Runs as a Supabase Edge Function scheduled (e.g., every 15 min).
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { log } from "../_shared/logger.ts";
import { enqueueSocialPublish } from "../_shared/socialQueue.ts";
import { recordMetric } from "../_shared/metrics.ts";

/** Helper to find articles that have not yet been added to social_posts. */
async function findNewPublishedArticles(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("news_articles")
    .select("id")
    .eq("status", "published")
    .not("id", "in", supabaseAdmin.from("social_posts").select("article_id", { head: false } as any))
    .order("published_at", { ascending: true });
  if (error) {
    log("error", `Failed to fetch published articles: ${error.message}`);
    return [];
  }
  return (data as any[]).map((row) => row.id as string);
}

export default async function handler() {
  const start = Date.now();
  const articleIds = await findNewPublishedArticles();
  if (articleIds.length === 0) {
    log("info", "No new articles to enqueue for social publishing");
    return new Response("No work", { status: 200 });
  }

  // For each article, enqueue for all platforms (could be configurable)
  for (const articleId of articleIds) {
    try {
      await enqueueSocialPublish({
        articleId,
        platforms: ["telegram", "instagram", "facebook"],
        // caption and image selection can be enhanced – using defaults for now
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("error", `Failed to enqueue social publish for article ${articleId}: ${msg}`);
    }
  }

  const latency = Date.now() - start;
  await recordMetric("system", "social", "scheduler_latency", latency);
  log("info", `Social publish scheduler processed ${articleIds.length} articles in ${latency}ms`);
  return new Response(`Enqueued ${articleIds.length} articles`, { status: 200 });
}
