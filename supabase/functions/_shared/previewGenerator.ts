/**
 * Preview generator – returns a CDN URL for a thumbnail version of the article's image.
 * It ensures a thumbnail exists (by checking `media_transformations` with name 'thumbnail')
 * and builds a public URL via the CDN helper.
 */

import { supabaseAdmin } from "./supabase.ts";
import { buildCdnUrl } from "./r2Storage.ts";

export async function getPreviewUrl(imageFileId: string): Promise<string | null> {
  // Find a thumbnail transformation for this file
  const { data, error } = await supabaseAdmin
    .from("media_transformations")
    .select("storage_key")
    .eq("file_id", imageFileId)
    .eq("transformation_name", "thumbnail")
    .single();
  if (error || !data) return null;
  const key = (data as any).storage_key as string;
  // Thumbnail is stored in the same bucket as the source (public by default)
  const { data: file, error: fErr } = await supabaseAdmin.from("media_files").select("bucket").eq("id", imageFileId).single();
  if (fErr || !file) return null;
  const bucket = (file as any).bucket as string;
  return buildCdnUrl(bucket, key);
}
