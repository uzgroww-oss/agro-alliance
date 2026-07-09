import { supabaseAdmin } from "../_shared/supabase.ts"
import { logger } from "../_shared/logger.ts"
import { now } from "../_shared/time.ts"

const AUTO_PUBLISH_CONFIDENCE_THRESHOLD = 80

Deno.serve(async (_req) => {
  let claimedJob: Record<string, unknown> | null = null

  try {
    const { data: job, error: claimError } = await supabaseAdmin.rpc(
      "claim_next_news_job",
      { p_job_type: "draft_generate" },
    )

    if (claimError) throw claimError
    if (!job || !job.id) {
      return new Response(JSON.stringify({ idle: true }), { status: 200 })
    }

    claimedJob = job as Record<string, unknown>
    const articleId = (job as any).article_id || (job as any).payload?.article_id
    if (!articleId) throw new Error("No article_id in job")

    const { data: article, error: fetchError } = await supabaseAdmin
      .from("news_articles")
      .select("id, title, content, status, category_id, ai_category_id, ai_confidence, ai_translation_uz, ai_translation_ru, ai_translation_en, language")
      .eq("id", articleId)
      .is("deleted_at", null)
      .single()

    if (fetchError) throw fetchError
    if (!article) throw new Error(`Article ${articleId} not found`)

    const updates: Record<string, unknown> = {}

    if (article.status === "ai_draft") {
      updates.status = "draft"
    }

    if (!article.category_id && article.ai_category_id) {
      updates.category_id = article.ai_category_id
    }

    if (!article.content) {
      const lang = article.language ?? "uz"
      const translationField = `ai_translation_${lang}` as keyof typeof article
      const fallbackContent = article[translationField] as string | undefined
      if (fallbackContent) {
        updates.content = fallbackContent
      }
    }

    const hasUpdates = Object.keys(updates).length > 0
    if (hasUpdates) {
      const { error: updateError } = await supabaseAdmin
        .from("news_articles")
        .update(updates)
        .eq("id", articleId)

      if (updateError) throw updateError
    }

    const confidence = article.ai_confidence as number | null
    const threshold = parseInt(
      Deno.env.get("AUTO_PUBLISH_CONFIDENCE_THRESHOLD") ?? String(AUTO_PUBLISH_CONFIDENCE_THRESHOLD),
      10,
    )
    const categoryId = updates.category_id ?? article.category_id

    if (confidence !== null && confidence >= threshold && categoryId) {
      await supabaseAdmin.rpc("enqueue_news_job", {
        p_job_type: "auto_publish",
        p_payload: { article_id: articleId },
        p_priority: 0,
        p_article_id: articleId,
      })
    }

    await supabaseAdmin.from("news_jobs").update({
      status: "completed",
      completed_at: now(),
      result: {
        status_updated: hasUpdates,
        drafted: article.status === "ai_draft",
        auto_publish_enqueued: confidence !== null && confidence >= threshold && !!categoryId,
      },
    }).eq("id", (job as any).id)

    await supabaseAdmin.rpc("log_ingestion", {
      p_job_id: (job as any).id,
      p_source_id: (job as any).source_id,
      p_event_type: "ai_processed",
      p_message: "Draft generated from AI pipeline",
      p_metadata: { article_id: articleId, updates: Object.keys(updates) },
    })

    logger.info(`draft_generate completed for article ${articleId}`, {
      metadata: { job_id: (job as any).id, updates: Object.keys(updates) },
    })

    return new Response(JSON.stringify({ success: true, article_id: articleId, updates: Object.keys(updates) }), {
      status: 200,
    })
  } catch (err) {
    const error = err as Error
    logger.error(`draft_generate worker failed: ${error.message}`, {
      metadata: { error: error.stack },
    })

    if (claimedJob) {
      await supabaseAdmin.from("news_jobs").update({
        status: "failed",
        error_message: error.message,
        completed_at: now(),
      }).eq("id", claimedJob.id)

      await supabaseAdmin.rpc("log_ingestion", {
        p_job_id: claimedJob.id,
        p_source_id: (claimedJob as any).source_id,
        p_event_type: "failed",
        p_message: error.message,
        p_metadata: { error: error.stack },
      })
    }

    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
