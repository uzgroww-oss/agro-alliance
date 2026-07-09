/**
 * Edge Function – initiates a media upload by returning a signed PUT URL.
 * Expected JSON body:
 *   { originalFilename: string, mimeType: string, sizeBytes: number, isPublic: boolean }
 * The caller must be authenticated; we extract a simple profile ID from a Bearer token.
 */

import { supabaseAdmin } from "../_shared/supabase.ts";
import { initiateUpload } from "../_shared/r2Storage.ts";
import { log } from "../_shared/logger.ts";

export default async function handler(req: Request) {
  const { originalFilename, mimeType, sizeBytes, isPublic } = await req.json();
  const authHeader = req.headers.get("authorization") ?? "";
  const uploadedBy = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!uploadedBy) {
    return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  try {
    const { fileId, signedUrl, storageKey } = await initiateUpload({
      originalFilename,
      mimeType,
      sizeBytes,
      isPublic,
      uploadedBy,
    });
    // Enqueue a validation job after client uploads (the client is expected to call the worker later)
    await supabaseAdmin.from("media_jobs").insert({
      file_id: fileId,
      job_type: "upload",
      status: "pending",
      priority: 0,
      payload: { file_id: fileId },
    });
    return new Response(JSON.stringify({ fileId, signedUrl, storageKey }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("error", `Upload initiation failed: ${msg}`);
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}
