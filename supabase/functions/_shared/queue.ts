import { supabaseAdmin } from "./supabase.ts"
import { now } from "./time.ts"

export type QueuePriority = "high" | "normal" | "low"
export type QueueStatus = "pending" | "processing" | "completed" | "failed"

export interface QueueJob<T = unknown> {
  id: string
  type: string
  payload: T
  priority: QueuePriority
  status: QueueStatus
  retries: number
  maxRetries: number
  createdAt: string
  scheduledAt?: string
}

export interface QueueResult {
  jobId: string
  success: boolean
  error?: string
}

export class QueueClient {
  async enqueue<T>(
    type: string,
    payload: T,
    priority: QueuePriority = "normal",
    sourceId?: string,
    articleId?: string,
    scheduledAt?: string,
    maxRetries: number = 3,
  ): Promise<QueueResult> {
    const { data, error } = await supabaseAdmin
      .from("news_jobs")
      .insert({
        type,
        payload,
        priority,
        source_id: sourceId ?? null,
        article_id: articleId ?? null,
        status: "pending",
        retries: 0,
        max_retries: maxRetries,
        created_at: now(),
        scheduled_at: scheduledAt ?? null,
      })
      .select("id")
      .single()

    if (error) {
      return { jobId: "", success: false, error: error.message }
    }

    return { jobId: data.id, success: true }
  }

  async dequeue(type: string): Promise<QueueJob | null> {
    const { data, error } = await supabaseAdmin.rpc("claim_next_news_job", {
      p_job_type: type,
    })

    if (error || !data) return null

    return {
      id: data.id,
      type: data.job_type,
      payload: typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload,
      priority: data.priority,
      status: data.status,
      retries: data.retry_count,
      maxRetries: data.max_retries,
      createdAt: data.created_at,
      scheduledAt: data.scheduled_at ?? undefined,
    }
  }

  async complete(jobId: string): Promise<void> {
    await supabaseAdmin
      .from("news_jobs")
      .update({ status: "completed", completed_at: now() })
      .eq("id", jobId)
  }

  async fail(jobId: string, error: string): Promise<void> {
    // Fetch job to inspect retry count
    const { data: job, error: fetchErr } = await supabaseAdmin
      .from("news_jobs")
      .select("retry_count, max_retries, type, payload")
      .eq("id", jobId)
      .single();
    if (!fetchErr && job) {
      if (job.retry_count >= job.max_retries) {
        // Move to dead‑letter queue
        await this.moveToDeadLetter(jobId, error);
        return;
      }
    }
    // Otherwise mark as failed (still may be retried later)
    await supabaseAdmin
      .from("news_jobs")
      .update({ status: "failed", error_message: error, completed_at: now() })
      .eq("id", jobId);
  }

  /** Move a job that exhausted retries to the dead‑letter table. */
  async moveToDeadLetter(jobId: string, error: string): Promise<void> {
    const { data: job, error: fetchErr } = await supabaseAdmin
      .from("news_jobs")
      .select("type, payload, provider_id, model_id, prompt_version")
      .eq("id", jobId)
      .single();
    if (fetchErr || !job) return;
    await supabaseAdmin.from("ai_dead_letter_jobs").insert({
      original_job_id: jobId,
      type: job.type,
      payload: job.payload,
      provider_id: job.provider_id ?? null,
      model_id: job.model_id ?? null,
      prompt_version: job.prompt_version ?? null,
      error_message: error,
      failed_at: now(),
    });
    // Remove original job
    await supabaseAdmin.from("news_jobs").delete().eq("id", jobId);
  }


  async log(
    jobId: string,
    sourceId: string,
    eventType: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await supabaseAdmin.rpc("log_ingestion", {
      p_job_id: jobId,
      p_source_id: sourceId,
      p_event_type: eventType,
      p_message: message,
      p_metadata: metadata ?? null,
    })
  }
}