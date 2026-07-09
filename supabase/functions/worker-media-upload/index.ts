/**
 * Media Upload Worker – validates a file after it has been uploaded to R2.
 * It claims a pending job of type "upload" from the media_jobs table,
 * runs metadata validation, updates the media_files record, and logs metrics.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { log } from "../_shared/logger.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { validateUploadedFile } from "../_shared/r2Storage.ts";
import { now } from "../_shared/time.ts";

/** Claim the next pending upload validation job. */
async function claimJob(): Promise<{ id: string; payload: any } | null> {
  const { data, error } = await supabaseAdmin
    .from("media_jobs")
    .select("id, payload")
    .eq("status", "pending")
    .eq("job_type", "upload")
    .order("priority", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  // Mark as processing to avoid race conditions
  const { error: updErr } = await supabaseAdmin
    .from("media_jobs")
    .update({ status: "processing", started_at: now() })
    .eq("id", data.id);

  if (updErr) {
    log("error", `Failed to claim job ${data.id}: ${updErr.message}`);
    return null;
  }
  return { id: data.id, payload: data.payload };
}

/** Complete the job – mark success or failure */
async function completeJob(jobId: string, success: boolean, errorMsg?: string) {
  await supabaseAdmin
    .from("media_jobs")
    .update({
      status: success ? "completed" : "failed",
      completed_at: now(),
      error_message: errorMsg ?? null,
    })
    .eq("id", jobId);
}

/** Main loop – run once per invocation (Edge Functions are event‑driven). */
export default async function handler() {
  const job = await claimJob();
  if (!job) {
    log("info", "No pending media upload jobs");
    return new Response("No jobs", { status: 200 });
  }

  const start = Date.now();
  const fileId = job.payload?.file_id as string | undefined;
  if (!fileId) {
    await completeJob(job.id, false, "Missing file_id in payload");
    return new Response("Invalid payload", { status: 400 });
  }

  try {
    await validateUploadedFile(fileId);
    await completeJob(job.id, true);
    const latency = Date.now() - start;
    await recordMetric("system", "r2", "worker_upload_latency", latency);
    log("info", `Media upload job ${job.id} processed successfully`, { fileId, latency });
    return new Response("OK", { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await completeJob(job.id, false, msg);
    await recordMetric("system", "r2", "worker_upload_failure", 1);
    log("error", `Media upload job ${job.id} failed: ${msg}`);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
