import { supabaseAdmin } from "../_shared/supabase.ts"
import { logger } from "../_shared/logger.ts"
import { now } from "../_shared/time.ts"
import { geminiJson } from "../_shared/gemini.ts"

interface SummaryResult {
  summary: string
  summary_ru: string
  summary_en: string
}

Deno.serve(async (_req) => {
  let claimedJob: Record<string, unknown> | null = null

  try {
    const { data: job, error: claimError } = await supabaseAdmin.rpc(
      "claim_next_news_job",
      { p_job_type: "ai_summarize" },
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
      .select("id, title, content, excerpt, language")
      .eq("id", articleId)
      .is("deleted_at", null)
      .single()

    if (fetchError) throw fetchError
    if (!article) throw new Error(`Article ${articleId} not found`)

    const plainText = (article.content ?? "").replace(/<[^>]*>/g, "").trim()

    let summaryUz: string
    let summaryRu: string
    let summaryEn: string

    try {
      const result = await geminiJson<SummaryResult>(
        `You are an agricultural news summarizer. Generate concise summaries in 3 languages.

Article title: ${article.title}
Article content: ${plainText.substring(0, 3000)}

Generate a 2-3 sentence summary for each language. Focus on the key facts.

Return JSON only:
{"summary": "Uzbek summary", "summary_ru": "Russian summary", "summary_en": "English summary"}`,
        { temperature: 0.5, maxTokens: 1024 },
      )
      summaryUz = result.summary || plainText.substring(0, 200)
      summaryRu = result.summary_ru || plainText.substring(0, 200)
      summaryEn = result.summary_en || plainText.substring(0, 200)
    } catch (aiErr) {
      logger.warn(`Gemini summarization failed, using truncation: ${(aiErr as Error).message}`)
      summaryUz = plainText.substring(0, 200)
      summaryRu = plainText.substring(0, 200)
      summaryEn = plainText.substring(0, 200)
    }

    const { error: updateError } = await supabaseAdmin
      .from("news_articles")
      .update({
        excerpt: summaryUz,
        ai_summary_uz: summaryUz,
        ai_summary_ru: summaryRu,
        ai_summary_en: summaryEn,
      })
      .eq("id", articleId)

    if (updateError) throw updateError

    await supabaseAdmin.from("news_jobs").update({
      status: "completed",
      completed_at: now(),
      result: { summary_length: summaryUz.length },
    }).eq("id", (job as any).id)

    await supabaseAdmin.rpc("log_ingestion", {
      p_job_id: (job as any).id,
      p_source_id: (job as any).source_id,
      p_event_type: "ai_processed",
      p_message: "Article summarized by Gemini AI",
      p_metadata: { article_id: articleId, summary_length: summaryUz.length },
    })

    logger.info(`ai_summarize completed for article ${articleId}`, {
      metadata: { job_id: (job as any).id },
    })

    return new Response(JSON.stringify({
      success: true,
      article_id: articleId,
      summary_length: summaryUz.length,
    }), { status: 200 })
  } catch (err) {
    const error = err as Error
    logger.error(`ai_summarize worker failed: ${error.message}`, { metadata: { error: error.stack } })

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
