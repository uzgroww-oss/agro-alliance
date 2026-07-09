/**
 * Facebook Publisher Worker – processes jobs of type `publish_facebook`.
 * Publishes a link or photo to a Facebook Page using the Graph API.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { log } from "../_shared/logger.ts";
import { now } from "../_shared/time.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { checkSocialRateLimit } from "../_shared/socialRateLimiter.ts";
import { getDownloadUrl } from "../_shared/r2Storage.ts";

async function claimJob() {
  const { data, error } = await supabaseAdmin
    .from("social_jobs")
    .select("id, payload")
    .eq("status", "pending")
    .eq("job_type", "publish_facebook")
    .order("priority", { ascending: true })
    .limit(1)
    .single();
  if (error || !data) return null;
  const jobId = data.id as string;
  const postId = (data.payload as any).post_id as string;
  const { error: upd } = await supabaseAdmin.from("social_jobs").update({ status: "processing", started_at: now() }).eq("id", jobId);
  if (upd) { log("error", `Failed to claim Facebook job ${jobId}: ${upd.message}`); return null; }
  return { jobId, postId };
}

async function completeJob(jobId: string, success: boolean, err?: string) {
  await supabaseAdmin.from("social_jobs").update({ status: success ? "completed" : "failed", completed_at: now(), error_message: err ?? null }).eq("id", jobId);
}

async function moveToFailed(jobId: string, postId: string, err: string) {
  await supabaseAdmin.from("failed_social_jobs").insert({ original_job_id: jobId, post_id: postId, job_type: "publish_facebook", payload: { post_id: postId }, error_message: err });
  await supabaseAdmin.from("social_jobs").delete().eq("id", jobId);
}

export default async function handler() {
  const job = await claimJob();
  if (!job) { log("info", "No pending Facebook jobs"); return new Response("No jobs", { status: 200 }); }
  const { jobId, postId } = job;
  const start = Date.now();

  try {
    const allowed = await checkSocialRateLimit("facebook");
    if (!allowed) throw new Error("Facebook rate limit exceeded");

    const { data: post, error: postErr } = await supabaseAdmin.from("social_posts").select("caption, image_file_id, article_id").eq("id", postId).single();
    if (postErr || !post) throw new Error(`Social post ${postId} not found`);
    const caption = (post as any).caption as string;
    const imageFileId = (post as any).image_file_id as string | null;
    const articleId = (post as any).article_id as string;
    const pageToken = Deno.env.get("FACEBOOK_PAGE_TOKEN");
    const pageId = Deno.env.get("FACEBOOK_PAGE_ID");
    if (!pageToken || !pageId) throw new Error("Facebook credentials not configured");

    // Build payload – if we have an image we post a photo, otherwise a simple post with link to article
    let fbResp;
    if (imageFileId) {
      const imgUrl = await getDownloadUrl({ fileId: imageFileId, expiresIn: 3600 });
      const form = new URLSearchParams({
        message: caption,
        url: imgUrl,
        access_token: pageToken,
      });
      fbResp = await fetch(`https://graph.facebook.com/${pageId}/photos`, { method: "POST", body: form });
    } else {
      // Assume article is publicly reachable via its website URL (placeholder)
      const articleUrl = `${Deno.env.get("BASE_WEBSITE_URL")}/article/${articleId}`;
      const form = new URLSearchParams({ message: caption, link: articleUrl, access_token: pageToken });
      fbResp = await fetch(`https://graph.facebook.com/${pageId}/feed`, { method: "POST", body: form });
    }
    const fbData = await fbResp.json();
    if (!fbResp.ok) throw new Error(`Facebook API error: ${JSON.stringify(fbData)}`);

    await supabaseAdmin.from("publish_history").insert({ post_id: postId, platform: "facebook", success: true, response: JSON.stringify(fbData) });
    await completeJob(jobId, true);
    const latency = Date.now() - start;
    await recordMetric("system", "social", "facebook_publish_latency", latency);
    log("info", `Facebook publish job ${jobId} succeeded in ${latency}ms`);
    return new Response("OK", { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin.from("social_jobs").update({ retry_count: supabaseAdmin.raw("retry_count + 1") }).eq("id", jobId);
    const { data: jobRec } = await supabaseAdmin.from("social_jobs").select("retry_count, max_retries").eq("id", jobId).single();
    const retries = (jobRec as any).retry_count as number;
    const maxRetries = (jobRec as any).max_retries as number;
    if (retries >= maxRetries) {
      await moveToFailed(jobId, postId, msg);
      await recordMetric("system", "social", "facebook_publish_failed", 1);
      log("error", `Facebook job ${jobId} failed permanently: ${msg}`);
    } else {
      await completeJob(jobId, false, msg);
      await recordMetric("system", "social", "facebook_publish_retry", 1);
      log("warn", `Facebook job ${jobId} will retry (${retries}/${maxRetries}): ${msg}`);
    }
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
