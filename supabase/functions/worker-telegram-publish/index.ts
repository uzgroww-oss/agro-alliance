/**
 * Telegram Publisher Worker – processes jobs of type `publish_telegram`.
 * It reads the associated `social_posts` record, builds a caption, selects an
 * image (if any) and sends it via the Telegram Bot API.
 *
 * Rate limiting is enforced via `socialRateLimiter.checkSocialRateLimit`.
 * Metrics and logging are emitted for each attempt.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { log } from "../_shared/logger.ts";
import { now } from "../_shared/time.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { buildCdnUrl } from "../_shared/r2Storage.ts";
import { checkSocialRateLimit } from "../_shared/socialRateLimiter.ts";
import { getDownloadUrl } from "../_shared/r2Storage.ts"; // fallback if needed

/** Claim next pending telegram publish job. */
async function claimJob() {
  const { data, error } = await supabaseAdmin
    .from("social_jobs")
    .select("id, payload")
    .eq("status", "pending")
    .eq("job_type", "publish_telegram")
    .order("priority", { ascending: true })
    .limit(1)
    .single();
  if (error || !data) return null;

  const jobId = data.id as string;
  const postId = (data.payload as any).post_id as string;

  // Mark processing
  const { error: upd } = await supabaseAdmin.from("social_jobs").update({ status: "processing", started_at: now() }).eq("id", jobId);
  if (upd) {
    log("error", `Failed to mark telegram job ${jobId} processing: ${upd.message}`);
    return null;
  }
  return { jobId, postId };
}

/** Complete the job – success flag & optional error. */
async function completeJob(jobId: string, success: boolean, errorMsg?: string) {
  await supabaseAdmin.from("social_jobs").update({
    status: success ? "completed" : "failed",
    completed_at: now(),
    error_message: errorMsg ?? null,
  }).eq("id", jobId);
}

/** Move a job that exhausted retries to the failed queue. */
async function moveToFailed(jobId: string, postId: string, errorMsg: string) {
  // Insert into failed_social_jobs
  await supabaseAdmin.from("failed_social_jobs").insert({
    original_job_id: jobId,
    post_id: postId,
    job_type: "publish_telegram",
    payload: { post_id: postId },
    error_message: errorMsg,
  });
  // Delete original job
  await supabaseAdmin.from("social_jobs").delete().eq("id", jobId);
}

export default async function handler() {
  const job = await claimJob();
  if (!job) {
    log("info", "No pending telegram publish jobs");
    return new Response("No jobs", { status: 200 });
  }
  const { jobId, postId } = job;
  const start = Date.now();

  try {
    // Rate limit check
    const allowed = await checkSocialRateLimit("telegram");
    if (!allowed) throw new Error("Telegram rate limit exceeded");

    // Load post data
    const { data: post, error: postErr } = await supabaseAdmin.from("social_posts").select("caption, image_file_id, hashtags, article_id").eq("id", postId).single();
    if (postErr || !post) throw new Error(`Social post ${postId} not found`);
    const caption = (post as any).caption as string;
    const imageFileId = (post as any).image_file_id as string | null;
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!chatId) throw new Error("Telegram chat ID not configured");
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) throw new Error("Telegram bot token not configured");

    // Build request payload – use sendMessage if no image, else sendPhoto with URL
    let resp;
    if (imageFileId) {
      // Get CDN URL for the image (using thumbnail if exists)
      const imageUrl = await getDownloadUrl({ fileId: imageFileId, expiresIn: 3600, requesterId: undefined });
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("caption", caption);
      form.append("photo", imageUrl);
      resp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: form,
      });
    } else {
      const body = { chat_id: chatId, text: caption };
      resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Telegram API error: ${resp.status} ${txt}`);
    }

    // Record success in publish_history
    await supabaseAdmin.from("publish_history").insert({
      post_id: postId,
      platform: "telegram",
      success: true,
      response: await resp.text(),
    });

    await completeJob(jobId, true);
    const latency = Date.now() - start;
    await recordMetric("system", "social", "telegram_publish_latency", latency);
    log("info", `Telegram publish job ${jobId} succeeded in ${latency}ms`);
    return new Response("OK", { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Increment retry count
    const { error: incErr } = await supabaseAdmin.from("social_jobs").update({ retry_count: supabaseAdmin.raw("retry_count + 1") }).eq("id", jobId);
    if (incErr) log("error", `Failed to increment retry count for ${jobId}: ${incErr.message}`);

    // Check if max retries reached
    const { data: jobRec } = await supabaseAdmin.from("social_jobs").select("retry_count, max_retries").eq("id", jobId).single();
    const retries = (jobRec as any).retry_count as number;
    const maxRetries = (jobRec as any).max_retries as number;
    if (retries >= maxRetries) {
      await moveToFailed(jobId, postId, msg);
      await recordMetric("system", "social", "telegram_publish_failed", 1);
      log("error", `Telegram publish job ${jobId} failed permanently: ${msg}`);
    } else {
      await completeJob(jobId, false, msg);
      await recordMetric("system", "social", "telegram_publish_retry", 1);
      log("warn", `Telegram publish job ${jobId} will be retried (${retries}/${maxRetries}): ${msg}`);
    }
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
