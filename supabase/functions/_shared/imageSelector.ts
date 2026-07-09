/**
 * Image selector – picks the most suitable image for a social post.
 * It looks at `media_usage` records that link a media file to the given
 * article and prefers a public, ready image with the largest dimensions.
 */

import { supabaseAdmin } from "./supabase.ts";
import { log } from "./logger.ts";

export async function selectBestImageForArticle(articleId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("media_usage")
    .select("file_id, media_files(width, height, status, is_public)")
    .eq("entity_type", "news_article")
    .eq("entity_id", articleId)
    .order("media_files.width", { ascending: false })
    .order("media_files.height", { ascending: false })
    .limit(1);

  if (error) {
    log("error", `Image selector error: ${error.message}`);
    return null;
  }
  if (!data || data.length === 0) return null;
  const file = data[0] as any;
  const media = file.media_files as any;
  if (media.status !== "ready" || !media.is_public) return null;
  return file.file_id as string;
}
