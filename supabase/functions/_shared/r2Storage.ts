/**
 * Storage Service — uses Supabase Storage (built-in) instead of Cloudflare R2.
 * Handles upload initiation, signed URL generation, and basic validation.
 */

import { supabaseAdmin } from "./supabase.ts";
import { log } from "./logger.ts";
import { recordMetric } from "./metrics.ts";

const MAX_UPLOAD_SIZE = Number(Deno.env.get("R2_MAX_UPLOAD_SIZE") ?? "10485760");
const ALLOWED_MIME = (Deno.env.get("R2_ALLOWED_MIME") ?? "image/jpeg,image/jpg,image/png,image/webp,image/gif,image/svg+xml").split(",");
const STORAGE_URL = Deno.env.get("SUPABASE_URL") || "";

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

/** Create a media_files record and return a signed upload URL via Supabase Storage. */
export async function initiateUpload(params: {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  isPublic: boolean;
  uploadedBy: string;
}): Promise<{ fileId: string; signedUrl: string; storageKey: string }> {
  const { originalFilename, mimeType, sizeBytes, isPublic, uploadedBy } = params;

  if (sizeBytes > MAX_UPLOAD_SIZE) {
    throw new Error(`File exceeds maximum allowed size of ${MAX_UPLOAD_SIZE} bytes`);
  }
  if (!ALLOWED_MIME.includes(mimeType)) {
    throw new Error(`MIME type ${mimeType} is not allowed`);
  }

  const extension = getExtension(originalFilename);
  const storageKey = `${crypto.randomUUID()}.${extension}`;
  const bucket = isPublic ? "public" : "private";

  try {
    await supabaseAdmin.storage.getBucket(bucket);
  } catch {
    await supabaseAdmin.storage.createBucket(bucket, { public: isPublic });
  }

  // Insert placeholder record
  const { data, error } = await supabaseAdmin.from("media_files").insert({
    original_filename: originalFilename,
    stored_filename: storageKey,
    storage_key: storageKey,
    bucket,
    mime_type: mimeType,
    extension,
    size_bytes: sizeBytes,
    uploaded_by: uploadedBy,
    status: "uploading",
    is_public: isPublic,
  }).select("id").single();

  if (error) {
    log("error", `Failed to create media file record: ${error.message}`);
    throw error;
  }
  const fileId = data.id as string;

  // Generate signed upload URL via Supabase Storage
  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUploadUrl(storageKey, { upsert: true });

  if (signedError) {
    log("error", `Failed to create signed URL: ${signedError.message}`);
    throw new Error(signedError.message);
  }

  return { fileId, signedUrl: signedData.signedUrl, storageKey };
}

/** Build a public URL for a file. */
export function buildCdnUrl(bucket: string, key: string): string {
  return `${STORAGE_URL}/storage/v1/object/public/${bucket}/${key}`;
}

/** Generate a signed download URL. */
export async function getDownloadUrl(params: {
  fileId: string;
  expiresIn?: number;
  requesterId?: string;
}): Promise<string> {
  const { fileId, expiresIn = 3600, requesterId } = params;
  const { data: file, error } = await supabaseAdmin
    .from("media_files")
    .select("bucket, storage_key, is_public, uploaded_by")
    .eq("id", fileId).single();

  if (error || !file) throw new Error(`File ${fileId} not found`);

  const bucket = (file as any).bucket as string;
  const key = (file as any).storage_key as string;
  const isPublic = (file as any).is_public as boolean;
  const uploader = (file as any).uploaded_by as string | null;

  if (!isPublic) {
    if (!requesterId) throw new Error("Authentication required for private file");
    if (requesterId !== uploader) throw new Error("Access denied for private file");
  }

  const { data, error: signError } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(key, expiresIn);

  if (signError) throw new Error(signError.message);

  await recordMetric("system", "storage", "download_url_generated", 0);
  return data.signedUrl;
}

/** Validate an uploaded file after the client has PUT the object. */
export async function validateUploadedFile(fileId: string): Promise<void> {
  await enqueueProcessingJobs(fileId);

  const { data: file, error } = await supabaseAdmin
    .from("media_files")
    .select("bucket, storage_key, mime_type, size_bytes")
    .eq("id", fileId).single();

  if (error || !file) throw new Error(`Media file ${fileId} not found`);

  const bucket = (file as any).bucket as string;
  const key = (file as any).storage_key as string;

  // Get file info from Supabase Storage
  const { data: fileInfo, error: infoError } = await supabaseAdmin.storage
    .from(bucket)
    .list("", { search: key });

  const { error: updErr } = await supabaseAdmin.from("media_files").update({
    status: "ready",
  }).eq("id", fileId);

  if (updErr) {
    log("error", `Failed to update media file ${fileId}: ${updErr.message}`);
    throw updErr;
  }

  await recordMetric("system", "storage", "upload_success", 1);
  log("info", `Upload validation completed for file ${fileId}`);
}

/** Enqueue image-processing jobs for a ready file */
async function enqueueProcessingJobs(fileId: string): Promise<void> {
  const jobTypes = [
    "thumbnail", "webp", "blurhash", "dominant_color",
    "metadata", "hash", "duplicate_detection",
  ];
  const jobs = jobTypes.map((type) => ({
    file_id: fileId,
    job_type: type,
    status: "pending",
    priority: 0,
    payload: { file_id: fileId },
    max_retries: 3,
  }));
  const { error } = await supabaseAdmin.from("media_jobs").insert(jobs);
  if (error) {
    log("error", `Failed to enqueue processing jobs for ${fileId}: ${error.message}`);
  }
}
