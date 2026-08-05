/**
 * Instagram Publisher Worker – processes jobs of type `publish_instagram`.
 * It posts a photo with caption to the configured Instagram Business account.
 */

import { supabaseAdmin } from "../supabase.ts";
import { log } from "../logger.ts";
import { now } from "../time.ts";
import { recordMetric } from "../metrics.ts";
import { checkSocialRateLimit } from "../socialRateLimiter.ts";
import { getDownloadUrl } from "../r2Storage.ts";

/** Claim next pending Instagram job */
async function claimJob() {
  const { data, error } = await supabaseAdmin
    .from("social_jobs")
    .select("id, payload")
    .eq("status", "pending")
    .eq("job_type", "publish_instagram")
    .order("priority", { ascending: true })
    .limit(1)
    .single();
  if (error || !data) return null;
  const jobId = data.id as string;
  const postId = (data.payload as any).post_id as string;
  const { error: upd } = await supabaseAdmin.from("social_jobs").update({ status: "processing", started_at: now() }).eq("id", jobId);
  if (upd) { log("error", `Failed to claim Instagram job ${jobId}: ${upd.message}`); return null; }
  return { jobId, postId };
}

async function completeJob(jobId: string, success: boolean, err?: string) {
  await supabaseAdmin.from("social_jobs").update({ status: success ? "completed" : "failed", completed_at: now(), error_message: err ?? null }).eq("id", jobId);
}

async function moveToFailed(jobId: string, postId: string, err: string) {
  await supabaseAdmin.from("failed_social_jobs").insert({ original_job_id: jobId, post_id: postId, job_type: "publish_instagram", payload: { post_id: postId }, error_message: err });
  await supabaseAdmin.from("social_jobs").delete().eq("id", jobId);
}

export default async function handler() {
  const job = await claimJob();
  if (!job) { log("info", "No pending Instagram jobs"); return new Response("No jobs", { status: 200 }); }
  const { jobId, postId } = job;
  const start = Date.now();

  try {
    const allowed = await checkSocialRateLimit("instagram");
    if (!allowed) throw new Error("Instagram rate limit exceeded");

    const { data: post, error: postErr } = await supabaseAdmin.from("social_posts").select("caption, image_file_id").eq("id", postId).single();
    if (postErr || !post) throw new Error(`Social post ${postId} not found`);
    const caption = (post as any).caption as string;
    const imageFileId = (post as any).image_file_id as string | null;
    const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
    const userId = Deno.env.get("INSTAGRAM_USER_ID");
    if (!token || !userId) throw new Error("Instagram credentials not configured");

    // Obtain a signed URL for the image (valid for a short period)
    const imageUrl = imageFileId ? await getDownloadUrl({ fileId: imageFileId, expiresIn: 3600 }) : null;
    if (!imageUrl) throw new Error("No image available for Instagram post");

    // Step 1 – create media container
    const createResp = await fetch(`https://graph.facebook.com/v15.0/${userId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ image_url: imageUrl, caption, access_token: token }).toString(),
    });
    const createData = await createResp.json();
    if (!createResp.ok) throw new Error(`Instagram container error: ${JSON.stringify(createData)}`);
    const containerId = createData.id;

    // Step 2 – publish container
    const publishResp = await fetch(`https://graph.facebook.com/v15.0/${userId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: containerId, access_token: token }).toString(),
    });
    const publishData = await publishResp.json();
    if (!publishResp.ok) throw new Error(`Instagram publish error: ${JSON.stringify(publishData)}`);

    await supabaseAdmin.from("publish_history").insert({ post_id: postId, platform: "instagram", success: true, response: JSON.stringify(publishData) });
    await completeJob(jobId, true);
    const latency = Date.now() - start;
    await recordMetric("system", "social", "instagram_publish_latency", latency);
    log("info", `Instagram publish job ${jobId} succeeded in ${latency}ms`);
    return new Response("OK", { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Increment retry count
    // retry_count ni oshirish: supabase-js da SQL ifoda yo'q
    // (`supabaseAdmin.raw` umuman mavjud emas — u boshqa kutubxonaning
    // usuli va bu yerda har chaqiruvda xatoga olib kelardi). Shuning
    // uchun joriy qiymat o'qib olinadi va ustiga bittasi qo'shiladi.
    const { data: joriy } = await supabaseAdmin
      .from("social_jobs").select("retry_count").eq("id", jobId).maybeSingle();
    await supabaseAdmin.from("social_jobs")
      .update({ retry_count: Number(joriy?.retry_count ?? 0) + 1 }).eq("id", jobId);
    const { data: jobRec } = await supabaseAdmin.from("social_jobs").select("retry_count, max_retries").eq("id", jobId).single();
    const retries = (jobRec as any).retry_count as number;
    const maxRetries = (jobRec as any).max_retries as number;
    if (retries >= maxRetries) {
      await moveToFailed(jobId, postId, msg);
      await recordMetric("system", "social", "instagram_publish_failed", 1);
      log("error", `Instagram job ${jobId} failed permanently: ${msg}`);
    } else {
      await completeJob(jobId, false, msg);
      await recordMetric("system", "social", "instagram_publish_retry", 1);
      log("warn", `Instagram job ${jobId} will retry (${retries}/${maxRetries}): ${msg}`);
    }
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
