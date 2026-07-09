import { supabaseAdmin } from "../_shared/supabase.ts"
import { logger } from "../_shared/logger.ts"
import { now } from "../_shared/time.ts"
import { geminiJson } from "../_shared/gemini.ts"

interface Category {
  id: string
  key: string
  name_uz: string
  name_ru: string
  name_en: string
}

interface CategorizeResult {
  category_key: string
  confidence: number
  reasoning: string
}

Deno.serve(async (_req) => {
  let claimedJob: Record<string, unknown> | null = null

  try {
    const { data: job, error: claimError } = await supabaseAdmin.rpc(
      "claim_next_news_job",
      { p_job_type: "ai_categorize" },
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
      .select("id, title, content, language, category_id")
      .eq("id", articleId)
      .is("deleted_at", null)
      .single()

    if (fetchError) throw fetchError
    if (!article) throw new Error(`Article ${articleId} not found`)

    const { data: categories, error: catError } = await supabaseAdmin
      .from("news_categories")
      .select("id, key, name_uz, name_ru, name_en")
      .eq("is_active", true)
      .is("deleted_at", null)

    if (catError) throw catError
    if (!categories || categories.length === 0) throw new Error("No active categories found")

    let result: CategorizeResult
    try {
      const categoryList = (categories as Category[])
        .map((c) => `${c.key}: ${c.name_uz} / ${c.name_en}`)
        .join("\n")

      result = await geminiJson<CategorizeResult>(
        `You are an agricultural news categorizer. Assign the most appropriate category.

Available categories:
${categoryList}

Article title: ${article.title}
Article content: ${(article.content ?? "").replace(/<[^>]*>/g, "").substring(0, 2000)}

Return JSON only:
{"category_key": "the_key", "confidence": 0-100, "reasoning": "brief explanation"}`,
        { temperature: 0.3, maxTokens: 512 },
      )
    } catch (aiErr) {
      logger.warn(`Gemini categorization failed, using keyword fallback: ${(aiErr as Error).message}`)
      const textToMatch = `${article.title ?? ""} ${article.content ?? ""}`.toLowerCase()
      let bestCat: Category | null = null
      let bestScore = 0
      for (const cat of categories as Category[]) {
        const keywords = [cat.key, ...cat.name_uz.split(/\s+/), ...cat.name_en.split(/\s+/)]
          .map((w) => w.toLowerCase().replace(/[^a-zа-яёўғҳққўъ]/g, ""))
        let score = 0
        for (const word of keywords) {
          if (word.length < 3) continue
          if (textToMatch.includes(word)) score += 1
        }
        if (score > bestScore) { bestScore = score; bestCat = cat }
      }
      result = { category_key: bestCat?.key ?? "general", confidence: bestScore > 0 ? 60 : 30, reasoning: "Keyword fallback" }
    }

    const matchedCat = (categories as Category[]).find((c) => c.key === result.category_key)
    const updateFields: Record<string, unknown> = {}

    if (matchedCat) {
      updateFields.ai_category_id = matchedCat.id
      if (!article.category_id) {
        updateFields.category_id = matchedCat.id
      }
    }

    if (Object.keys(updateFields).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("news_articles")
        .update(updateFields)
        .eq("id", articleId)
      if (updateError) throw updateError
    }

    const targetLangs = ["ru", "en"].filter((l) => l !== article.language)
    if (targetLangs.length > 0) {
      await supabaseAdmin.rpc("enqueue_news_job", {
        p_job_type: "ai_translate",
        p_payload: { article_id: articleId, target_languages: targetLangs },
        p_priority: 0,
        p_article_id: articleId,
      })
    }

    await supabaseAdmin.from("news_jobs").update({
      status: "completed",
      completed_at: now(),
      result: { category_id: matchedCat?.id ?? null, category_key: result.category_key, confidence: result.confidence },
    }).eq("id", (job as any).id)

    await supabaseAdmin.rpc("log_ingestion", {
      p_job_id: (job as any).id,
      p_source_id: (job as any).source_id,
      p_event_type: "ai_processed",
      p_message: "Article categorized by Gemini AI",
      p_metadata: { article_id: articleId, category: result.category_key, confidence: result.confidence },
    })

    logger.info(`ai_categorize completed for article ${articleId}`, {
      metadata: { job_id: (job as any).id, category: result.category_key },
    })

    return new Response(JSON.stringify({ success: true, category: result.category_key, confidence: result.confidence }), { status: 200 })
  } catch (err) {
    const error = err as Error
    logger.error(`ai_categorize worker failed: ${error.message}`, { metadata: { error: error.stack } })

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
