/**
 * Social Queue utilities – enqueue publishing jobs for an article.
 * This module creates a `social_posts` record per platform and a matching
 * `social_jobs` entry that will be processed by the platform‑specific workers.
 */

import { supabaseAdmin } from "./supabase.ts";
import { log } from "./logger.ts";
import { recordMetric } from "./metrics.ts";

export interface EnqueueOptions {
  articleId: string;
  platforms: ("telegram" | "instagram" | "facebook")[];
  caption?: string;
  imageFileId?: string; // existing media file to use as primary image
  hashtags?: string[];
}

/** Enqueue a social post for each requested platform. */
export async function enqueueSocialPublish(opts: EnqueueOptions): Promise<void> {
  const { articleId, platforms, caption, imageFileId, hashtags } = opts;
  const posts = platforms.map((platform) => ({
    article_id: articleId,
    platform,
    status: "queued",
    caption: caption ?? null,
    image_file_id: imageFileId ?? null,
    hashtags: hashtags ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data: insertedPosts, error: postErr } = await supabaseAdmin.from("social_posts").insert(posts).select("id, platform");
  if (postErr) {
    log("error", `Failed to create social_posts: ${postErr.message}`);
    throw postErr;
  }

  const jobs = (insertedPosts as any[]).map((p) => ({
    post_id: p.id,
    job_type: `publish_${p.platform}`,
    status: "pending",
    priority: 0,
    payload: { post_id: p.id, platform: p.platform },
    max_retries: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: jobErr } = await supabaseAdmin.from("social_jobs").insert(jobs);
  if (jobErr) {
    log("error", `Failed to enqueue social_jobs: ${jobErr.message}`);
    throw jobErr;
  }

  await recordMetric("system", "social", "publish_enqueued", platforms.length);
}
