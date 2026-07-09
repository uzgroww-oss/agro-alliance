/**
 * Edge Function – returns a signed download URL for a given media file.
 * Input (JSON body): { fileId: string, expiresIn?: number }
 *
 * Permissions are checked: public files are available to anyone, private files
 * require the caller to be the uploader (simplified auth).
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { getDownloadUrl } from "../_shared/r2Storage.ts";
import { log } from "../_shared/logger.ts";

export default async function handler(req: Request) {
  const { fileId, expiresIn } = await req.json();
  const authHeader = req.headers.get("authorization") ?? "";
  // Very naive auth extraction – expects a Bearer <profileId> token for demo purposes.
  const requesterId = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  try {
    const signed = await getDownloadUrl({ fileId, expiresIn, requesterId });
    return new Response(JSON.stringify({ url: signed }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("error", `Failed to generate signed download URL: ${msg}`);
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}
