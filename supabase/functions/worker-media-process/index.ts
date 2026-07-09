/**
 * Media Processing Worker – handles asynchronous image transformations.
 * Supported job types (defined in `media_jobs.job_type`):
 *   thumbnail, webp, avif, optimize_jpeg, optimize_png,
 *   blurhash, dominant_color, exif, orientation, metadata,
 *   hash, duplicate_detection
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { log } from "../_shared/logger.ts";
import { now } from "../_shared/time.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { getObject, putObject } from "../_shared/r2Ops.ts";
import {
  generateThumbnail,
  convertToWebp,
  convertToAvif,
  optimizeJpeg,
  optimizePng,
  computeBlurHash,
  extractDominantColor,
  extractExif,
  correctOrientation,
  extractMetadata,
  computeHash,
} from "../_shared/imageProcessor.ts";

/** Claim a pending media job (excluding the upload job which is handled elsewhere). */
async function claimJob(): Promise<{ id: string; jobType: string; fileId: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("media_jobs")
    .select("id, job_type, payload")
    .eq("status", "pending")
    .not("job_type", "eq", "upload")
    .order("priority", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  const jobId = data.id as string;
  const jobType = data.job_type as string;
  const fileId = (data.payload as any)?.file_id as string;

  // Mark as processing
  const { error: updErr } = await supabaseAdmin
    .from("media_jobs")
    .update({ status: "processing", started_at: now() })
    .eq("id", jobId);

  if (updErr) {
    log("error", `Failed to claim job ${jobId}: ${updErr.message}`);
    return null;
  }

  return { id: jobId, jobType, fileId };
}

/** Complete a job – success flag and optional error message */
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

/** Record a transformation entry */
async function recordTransformation(params: {
  fileId: string;
  jobId: string;
  name: string;
  storageKey: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  etag: string;
}) {
  const { fileId, jobId, name, storageKey, mime, size, width, height, etag } = params;
  await supabaseAdmin.from("media_transformations").insert({
    file_id: fileId,
    transformation_name: name,
    storage_key: storageKey,
    mime_type: mime,
    size_bytes: size,
    width,
    height,
    etag,
    job_id: jobId,
  });
}

/** Main handler – processes a single job per invocation */
export default async function handler() {
  const job = await claimJob();
  if (!job) {
    log("info", "No pending media processing jobs");
    return new Response("No jobs", { status: 200 });
  }

  const { id: jobId, jobType, fileId } = job;
  const start = Date.now();

  try {
    // Load file metadata to locate source object
    const { data: file, error: fileErr } = await supabaseAdmin
      .from("media_files")
      .select("bucket, storage_key, mime_type")
      .eq("id", fileId)
      .single();
    if (fileErr || !file) throw new Error(`File ${fileId} not found`);
    const bucket = (file as any).bucket as string;
    const sourceKey = (file as any).storage_key as string;

    // Fetch source buffer (for transformations that need it)
    const sourceBuffer = await getObject(bucket, sourceKey);

    // Process based on job type
    switch (jobType) {
      case "thumbnail": {
        const { data, width, height, size } = await generateThumbnail(sourceBuffer);
        const newKey = `${crypto.randomUUID()}_thumb.jpg`;
        const etag = await putObject(bucket, newKey, data, "image/jpeg");
        await recordTransformation({ fileId, jobId, name: "thumbnail", storageKey: newKey, mime: "image/jpeg", size, width, height, etag });
        break;
      }
      case "webp": {
        const { data, width, height } = await convertToWebp(sourceBuffer);
        const newKey = `${crypto.randomUUID()}.webp`;
        const etag = await putObject(bucket, newKey, data, "image/webp");
        await recordTransformation({ fileId, jobId, name: "webp", storageKey: newKey, mime: "image/webp", size: data.length, width, height, etag });
        break;
      }
      case "avif": {
        const { data, width, height } = await convertToAvif(sourceBuffer);
        const newKey = `${crypto.randomUUID()}.avif`;
        const etag = await putObject(bucket, newKey, data, "image/avif");
        await recordTransformation({ fileId, jobId, name: "avif", storageKey: newKey, mime: "image/avif", size: data.length, width, height, etag });
        break;
      }
      case "optimize_jpeg": {
        const { data, size } = await optimizeJpeg(sourceBuffer);
        const newKey = `${crypto.randomUUID()}_opt.jpg`;
        const etag = await putObject(bucket, newKey, data, "image/jpeg");
        await recordTransformation({ fileId, jobId, name: "optimize_jpeg", storageKey: newKey, mime: "image/jpeg", size, etag });
        break;
      }
      case "optimize_png": {
        const { data, size } = await optimizePng(sourceBuffer);
        const newKey = `${crypto.randomUUID()}_opt.png`;
        const etag = await putObject(bucket, newKey, data, "image/png");
        await recordTransformation({ fileId, jobId, name: "optimize_png", storageKey: newKey, mime: "image/png", size, etag });
        break;
      }
      case "blurhash": {
        const blurhash = await computeBlurHash(sourceBuffer);
        // Store blurhash as metadata in media_files (simple update)
        await supabaseAdmin.from("media_files").update({ blurhash }).eq("id", fileId);
        // No separate transformation record needed
        break;
      }
      case "dominant_color": {
        const color = await extractDominantColor(sourceBuffer);
        await supabaseAdmin.from("media_files").update({ dominant_color: color }).eq("id", fileId);
        break;
      }
      case "exif": {
        const exif = extractExif(sourceBuffer);
        log("info", `EXIF data for ${fileId}: ${JSON.stringify(exif)}`);
        break;
      }
      case "orientation": {
        const corrected = await correctOrientation(sourceBuffer);
        const newKey = `${crypto.randomUUID()}_oriented`; // retain original extension
        const ext = sourceKey.split('.').pop() ?? "bin";
        const mime = (file as any).mime_type as string;
        const finalKey = `${newKey}.${ext}`;
        const etag = await putObject(bucket, finalKey, corrected, mime);
        await recordTransformation({ fileId, jobId, name: "orientation", storageKey: finalKey, mime, size: corrected.length, etag });
        break;
      }
      case "metadata": {
        const meta = await extractMetadata(sourceBuffer);
        await supabaseAdmin.from("media_files").update({ width: meta.width, height: meta.height, mime_type: meta.format }).eq("id", fileId);
        break;
      }
      case "hash": {
        const hash = computeHash(sourceBuffer);
        await supabaseAdmin.from("media_files").update({ checksum: hash }).eq("id", fileId);
        break;
      }
      case "duplicate_detection": {
        // Find other files with the same checksum (excluding self)
        const { data: self, error: selfErr } = await supabaseAdmin.from("media_files").select("checksum").eq("id", fileId).single();
        if (selfErr || !self || !(self as any).checksum) break;
        const checksum = (self as any).checksum as string;
        const { data: dupes, error: dupErr } = await supabaseAdmin
          .from("media_files")
          .select("id, original_filename")
          .eq("checksum", checksum)
          .neq("id", fileId)
          .single();
        if (!dupErr && dupes) {
          // Mark this file as duplicate (simple flag) – you may want a dedicated column.
          await supabaseAdmin.from("media_files").update({ status: "duplicate" }).eq("id", fileId);
          log("warn", `Duplicate detected for ${fileId}: existing file ${dupes.id}`);
        }
        break;
      }
      default:
        throw new Error(`Unsupported job type ${jobType}`);
    }

    await completeJob(jobId, true);
    const latency = Date.now() - start;
    await recordMetric("system", "r2", `worker_${jobType}_latency`, latency);
    log("info", `Processed job ${jobId} (${jobType}) for file ${fileId} in ${latency}ms`);
    return new Response("OK", { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await completeJob(jobId, false, msg);
    await recordMetric("system", "r2", `worker_${jobType}_failure`, 1);
    log("error", `Failed job ${jobId} (${jobType}): ${msg}`);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
