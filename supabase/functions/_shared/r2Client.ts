/**
 * Cloudflare R2 client wrapper – uses AWS SDK v3 S3 compatible client.
 * All credentials are read from environment variables (Supabase Secret Manager).
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.600.0";

// Required env variables (configured via Supabase Secrets)
const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!; // Cloudflare account ID
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!; // R2 access key ID
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!; // R2 secret access key

// R2 uses a virtual S3 endpoint per account
const R2_ENDPOINT = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

/** Generate a signed PUT URL for uploading an object. */
export async function getSignedUploadUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}

/** Generate a signed GET URL for downloading an object. */
export async function getSignedDownloadUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}

/** Retrieve metadata (size, mime, etag) of an existing object without downloading it. */
export async function headObject(
  bucket: string,
  key: string,
): Promise<{ size: number; mime: string; etag: string }> {
  const cmd = new HeadObjectCommand({ Bucket: bucket, Key: key });
  const resp = await s3.send(cmd);
  return {
    size: resp.ContentLength ?? 0,
    mime: resp.ContentType ?? "application/octet-stream",
    etag: resp.ETag?.replace(/\"/g, "") ?? "",
  };
}
