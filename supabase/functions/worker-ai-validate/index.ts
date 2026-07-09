import { supabaseAdmin } from "../_shared/supabase.ts"
import { logger } from "../_shared/logger.ts"
import { now } from "../_shared/time.ts"
import { geminiJson } from "../_shared/gemini.ts"

interface ValidationResult {
  isValid: boolean
  confidence: number
  reasoning: string
}

Deno.serve(async (_req) => {
  let claimedJob: Record<string, unknown> | null = null

  try {
    const { data: job, error: claimError } = await supabaseAdmin.rpc(
      "claim_next_news_job",
      { p_job_type: "ai_validate" },
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
      .select("id, title, content, status, language")
      .eq("id", articleId)
      .is("deleted_at", null)
      .single()

    if (fetchError) throw fetchError
    if (!article) throw new Error(`Article ${articleId} not found`)

    const strippedContent = (article.content ?? "").replace(/<[^>]*>/g, "").trim()

    if ((article.title?.length ?? 0) < 5 || strippedContent.length < 50) {
      await supabaseAdmin.from("news_jobs").update({
        status: "completed",
        completed_at: now(),
        result: { valid: false, reason: "Content too short" },
      }).eq("id", (job as any).id)
      return new Response(JSON.stringify({ success: true, valid: false }), { status: 200 })
    }

    let result: ValidationResult
    try {
      result = await geminiJson<ValidationResult>(
        `You are an agricultural news content validator. Analyze this article for quality, relevance to agriculture, and authenticity.

Title: ${article.title}
Content: ${strippedContent.substring(0, 3000)}

Return JSON only:
{"isValid": true/false, "confidence": 0-100, "reasoning": "brief explanation"}`,
        { temperature: 0.3, maxTokens: 512 },
      )
    } catch (aiErr) {
      logger.warn(`Gemini validation failed, using heuristic: ${(aiErr as Error).message}`)
      const hasTitle = (article.title?.length ?? 0) > 10
      const hasContent = strippedContent.length > 100
      result = {
        isValid: hasTitle && hasContent,
        confidence: hasTitle && hasContent ? 75 : 40,
        reasoning: "Fallback heuristic validation",
      }
    }

    if (!result.isValid) {
      await supabaseAdmin.from("news_jobs").update({
        status: "completed",
        completed_at: now(),
        result: { valid: false, reason: result.reasoning },
      }).eq("id", (job as any).id)
      return new Response(JSON.stringify({ success: true, valid: false, reasoning: result.reasoning }), { status: 200 })
    }

    const { error: updateError } = await supabaseAdmin
      .from("news_articles")
      .update({
        ai_validated: true,
        ai_validated_at: now(),
        ai_confidence: result.confidence,
      })
      .eq("id", articleId)

    if (updateError) throw updateError

    const pipelineJobs = ["ai_categorize", "ai_summarize", "ai_seo"]
    for (const jobType of pipelineJobs) {
      const { error: enqError } = await supabaseAdmin.rpc("enqueue_news_job", {
        p_job_type: jobType,
        p_payload: { article_id: articleId },
        p_priority: 0,
        p_article_id: articleId,
      })
      if (enqError) logger.warn(`Failed to enqueue ${jobType}: ${enqError.message}`)
    }

    await supabaseAdmin.from("news_jobs").update({
      status: "completed",
      completed_at: now(),
      result: { valid: true, confidence: result.confidence, reasoning: result.reasoning },
    }).eq("id", (job as any).id)

    await supabaseAdmin.rpc("log_ingestion", {
      p_job_id: (job as any).id,
      p_source_id: (job as any).source_id,
      p_event_type: "ai_processed",
      p_message: "Article validated by Gemini AI",
      p_metadata: { article_id: articleId, confidence: result.confidence },
    })

    logger.info(`ai_validate completed for article ${articleId}`, {
      metadata: { job_id: (job as any).id, confidence: result.confidence },
    })

    return new Response(JSON.stringify({ success: true, valid: true, confidence: result.confidence }), { status: 200 })
  } catch (err) {
    const error = err as Error
    logger.error(`ai_validate worker failed: ${error.message}`, {
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
