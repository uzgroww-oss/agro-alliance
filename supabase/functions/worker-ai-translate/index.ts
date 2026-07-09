import { supabaseAdmin } from "../_shared/supabase.ts"
import { logger } from "../_shared/logger.ts"
import { now } from "../_shared/time.ts"
import { geminiJson } from "../_shared/gemini.ts"

interface TranslateResult {
  title_ru: string
  content_ru: string
  title_en: string
  content_en: string
  summary_ru: string
  summary_en: string
}

Deno.serve(async (_req) => {
  let claimedJob: Record<string, unknown> | null = null

  try {
    const { data: job, error: claimError } = await supabaseAdmin.rpc(
      "claim_next_news_job",
      { p_job_type: "ai_translate" },
    )

    if (claimError) throw claimError
    if (!job || !job.id) {
      return new Response(JSON.stringify({ idle: true }), { status: 200 })
    }

    claimedJob = job as Record<string, unknown>
    const payload = (job as any).payload ?? {}
    const articleId = (job as any).article_id || payload.article_id
    if (!articleId) throw new Error("No article_id in job")

    const targetLanguages: string[] = payload.target_languages ?? ["ru", "en"]

    const { data: article, error: fetchError } = await supabaseAdmin
      .from("news_articles")
      .select("id, title, content, language, ai_summary_uz")
      .eq("id", articleId)
      .is("deleted_at", null)
      .single()

    if (fetchError) throw fetchError
    if (!article) throw new Error(`Article ${articleId} not found`)

    const plainContent = (article.content ?? "").replace(/<[^>]*>/g, "").trim()
    const currentSummary = (article.ai_summary_uz ?? "").substring(0, 500)

    const updates: Record<string, unknown> = {}

    if (targetLanguages.includes("ru")) {
      try {
        const ruResult = await geminiJson<{ title: string; content: string; summary: string }>(
          `Translate this agricultural news article from Uzbek to Russian. Preserve meaning and agricultural terminology.

Original title: ${article.title}
Original content: ${plainContent.substring(0, 3000)}
Original summary: ${currentSummary}

Return JSON only:
{"title": "Russian title", "content": "Russian content (keep similar length)", "summary": "Russian summary (2-3 sentences)"}`,
          { temperature: 0.3, maxTokens: 2048 },
        )
        updates.ai_translation_ru = ruResult.content
        updates.ai_summary_ru = ruResult.summary
      } catch (aiErr) {
        logger.warn(`Gemini RU translate failed: ${(aiErr as Error).message}`)
        updates.ai_translation_ru = plainContent
        updates.ai_summary_ru = currentSummary
      }
    }

    if (targetLanguages.includes("en")) {
      try {
        const enResult = await geminiJson<{ title: string; content: string; summary: string }>(
          `Translate this agricultural news article from Uzbek to English. Preserve meaning and agricultural terminology.

Original title: ${article.title}
Original content: ${plainContent.substring(0, 3000)}
Original summary: ${currentSummary}

Return JSON only:
{"title": "English title", "content": "English content (keep similar length)", "summary": "English summary (2-3 sentences)"}`,
          { temperature: 0.3, maxTokens: 2048 },
        )
        updates.ai_translation_en = enResult.content
        updates.ai_summary_en = enResult.summary
      } catch (aiErr) {
        logger.warn(`Gemini EN translate failed: ${(aiErr as Error).message}`)
        updates.ai_translation_en = plainContent
        updates.ai_summary_en = currentSummary
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("news_articles")
        .update(updates)
        .eq("id", articleId)

      if (updateError) throw updateError
    }

    await supabaseAdmin.from("news_jobs").update({
      status: "completed",
      completed_at: now(),
      result: { target_languages: targetLanguages, translated: Object.keys(updates) },
    }).eq("id", (job as any).id)

    await supabaseAdmin.rpc("log_ingestion", {
      p_job_id: (job as any).id,
      p_source_id: (job as any).source_id,
      p_event_type: "translated",
      p_message: "Article translated by Gemini AI",
      p_metadata: {
        article_id: articleId,
        source_language: article.language,
        target_languages: targetLanguages,
      },
    })

    logger.info(`ai_translate completed for article ${articleId}`, {
      metadata: { job_id: (job as any).id, languages: targetLanguages },
    })

    return new Response(JSON.stringify({
      success: true,
      article_id: articleId,
      languages: targetLanguages,
    }), { status: 200 })
  } catch (err) {
    const error = err as Error
    logger.error(`ai_translate worker failed: ${error.message}`, { metadata: { error: error.stack } })

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
