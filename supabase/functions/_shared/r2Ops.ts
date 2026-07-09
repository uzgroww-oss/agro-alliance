/**
 * Low-level storage operations — uses Supabase Storage (built-in).
 */

import { supabaseAdmin } from "./supabase.ts";
import { log } from "./logger.ts";

/** Download a file from Supabase Storage as a Buffer */
export async function getObject(bucket: string, key: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(key);
  if (error) {
    log("error", `Failed to download ${bucket}/${key}: ${error.message}`);
    throw new Error(error.message);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Upload a buffer to Supabase Storage, returns a checksum */
export async function putObject(bucket: string, key: string, data: Buffer, mime: string): Promise<string> {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(key, data, { contentType: mime, upsert: true });

  if (error) {
    log("error", `Failed to upload ${bucket}/${key}: ${error.message}`);
    throw new Error(error.message);
  }

  // Simple checksum based on size + key
  const crypto = await import("node:crypto");
  return crypto.createHash("md5").update(`${key}-${data.length}`).digest("hex");
}
