import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { QueueClient } from "../_shared/queue.ts"
import { now } from "../_shared/time.ts"

Deno.serve(async (_req) => {
  try {
    const queue = new QueueClient()

    let job = await queue.dequeue("auto_publish")
    let jobType = "auto_publish"
    if (!job) {
      job = await queue.dequeue("scheduled_publish")
      jobType = "scheduled_publish"
    }

    if (!job) {
      return jsonResponse({ published: false, message: "No pending publish jobs" })
    }

    const payload = job.payload as { article_id: string }
    if (!payload?.article_id) {
      await queue.fail(job.id, "Missing article_id in payload")
      return errorResponse("Missing article_id in payload", 400)
    }

    const { data: article, error: fetchError } = await supabaseAdmin
      .from("news_articles")
      .select("id, title, status, published_at, deleted_at")
      .eq("id", payload.article_id)
      .maybeSingle()

    if (fetchError) {
      await queue.fail(job.id, fetchError.message)
      return errorResponse(fetchError.message, 500)
    }

    if (!article || article.deleted_at) {
      await queue.fail(job.id, "Article not found or deleted")
      return errorResponse("Article not found or deleted", 404)
    }

    const timestamp = now()
    let shouldPublish = false

    if (article.status === "draft" || article.status === "ai_draft") {
      shouldPublish = true
    } else if (article.status === "scheduled") {
      if (article.published_at && new Date(article.published_at) <= new Date()) {
        shouldPublish = true
      }
    }

    if (!shouldPublish) {
      await queue.complete(job.id)
      return jsonResponse({
        published: false,
        article_id: article.id,
        title: article.title,
        reason: "Article not eligible for publishing",
      })
    }

    const { error: updateError } = await supabaseAdmin
      .from("news_articles")
      .update({
        status: "published",
        published_at: article.published_at || timestamp,
        updated_at: timestamp,
      })
      .eq("id", article.id)

    if (updateError) {
      await queue.fail(job.id, updateError.message)
      return errorResponse(updateError.message, 500)
    }

    const { data: existingStat } = await supabaseAdmin
      .from("homepage_stats")
      .select("id, value")
      .eq("key", "total_published")
      .is("deleted_at", null)
      .maybeSingle()

    if (existingStat) {
      const currentVal = parseInt(existingStat.value as string, 10) || 0
      await supabaseAdmin
        .from("homepage_stats")
        .update({ value: String(currentVal + 1) })
        .eq("id", existingStat.id)
    }

    await queue.complete(job.id)

    await supabaseAdmin.rpc("log_ingestion", {
      p_job_id: job.id,
      p_source_id: null,
      p_event_type: "published",
      p_message: `Article "${article.title}" published`,
      p_metadata: { article_id: article.id, job_type: jobType },
    })

    return jsonResponse({
      published: true,
      article_id: article.id,
      title: article.title,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
