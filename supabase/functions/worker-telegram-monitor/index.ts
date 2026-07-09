import { supabaseAdmin } from "../_shared/supabase.ts"
import { slugify } from "../_shared/helpers.ts"

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

function extractTelegramChannelName(url: string): string {
  const match = url.match(/t\.me\/([^\/\?#]+)/)
  return match ? match[1] : ""
}

function parseTelegramHtml(html: string): Array<Record<string, string>> {
  const posts: Array<Record<string, string>> = []
  const msgRegex = /<div class="tgme_widget_message_wrapper[^"]*" data-post="([^"]+)">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/gi
  let match: RegExpExecArray | null
  while ((match = msgRegex.exec(html)) !== null) {
    const postId = match[1]
    const block = match[2]

    const textMatch = /<div class="tgme_widget_message_text[^"]*">([\s\S]*?)<\/div>/i.exec(block)
    let text = textMatch ? textMatch[1] : ""

    text = text
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    const dateMatch = /<time[^>]+datetime=["']([^"']+)["']/i.exec(block)
    const date = dateMatch ? dateMatch[1] : new Date().toISOString()

    const linkMatch = /<a[^>]+href=["']([^"']+)["'][^>]*class="tgme_widget_message_link_preview"[^>]*>/i.exec(block)
    let link = ""
    if (linkMatch) link = linkMatch[1]

    const imgMatch = /<img[^>]+src=["']([^"']+)["']/i.exec(block)
    const image = imgMatch ? imgMatch[1] : ""

    if (text) {
      posts.push({ postId, text, date, link, image })
    }
  }
  return posts
}

Deno.serve(async (_req) => {
  try {
    const { data: jobData, error: claimError } = await supabaseAdmin.rpc(
      "claim_next_news_job",
      { p_job_type: "telegram_monitor" }
    )
    if (claimError) throw claimError
    if (!jobData || Object.keys(jobData as Record<string, unknown>).length === 0) {
      return new Response(JSON.stringify({ idle: true }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    const job = jobData as Record<string, unknown>
    const jobId = job.id as string
    const payload = (job.payload || {}) as Record<string, unknown>
    const sourceId = (payload.source_id || job.source_id) as string

    const { data: source, error: sourceError } = await supabaseAdmin
      .from("news_sources")
      .select("id, name, url, language, category_id")
      .eq("id", sourceId)
      .single()
    if (sourceError || !source) {
      await supabaseAdmin.rpc("log_ingestion", {
        p_job_id: jobId,
        p_source_id: sourceId,
        p_event_type: "failed",
        p_message: `Source not found: ${sourceError?.message || "unknown"}`,
      })
      await supabaseAdmin.from("news_jobs").update({
        status: "failed",
        error_message: `Source not found: ${sourceError?.message || "unknown"}`,
        completed_at: new Date().toISOString(),
      }).eq("id", jobId)
      return new Response(JSON.stringify({ error: "Source not found" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    await supabaseAdmin.rpc("log_ingestion", {
      p_job_id: jobId,
      p_source_id: sourceId,
      p_event_type: "started",
      p_message: `Monitoring Telegram: ${source.url}`,
    })

    const channelName = extractTelegramChannelName(source.url)
    const telegramUrl = `https://t.me/s/${channelName}`

    let posts: Array<Record<string, string>> = []
    let fetchError: string | null = null

    try {
      const resp = await fetch(telegramUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      })
      if (resp.ok) {
        const html = await resp.text()
        posts = parseTelegramHtml(html)
      } else {
        fetchError = `HTTP ${resp.status}`
      }
    } catch (e) {
      fetchError = (e as Error).message
    }

    if (fetchError) {
      await supabaseAdmin.rpc("log_ingestion", {
        p_job_id: jobId,
        p_source_id: sourceId,
        p_event_type: "progress",
        p_message: `Telegram fetch issue: ${fetchError}`,
        p_metadata: { error: fetchError },
      })
    }

    let newCount = 0
    let dupCount = 0

    for (const post of posts) {
      const fingerprint = simpleHash(post.postId + post.text.substring(0, 100))

      const { data: existing } = await supabaseAdmin
        .from("news_articles")
        .select("id")
        .eq("ai_source_fingerprint", fingerprint)
        .is("deleted_at", null)
        .maybeSingle()

      if (existing) {
        dupCount++
        continue
      }

      const title = post.text.split("\n")[0].substring(0, 200) || "Telegram post"
      const excerpt = post.text.substring(0, 500)
      const slug = slugify(title) || "telegram-" + Date.now()

      const { data: article, error: insertError } = await supabaseAdmin
        .from("news_articles")
        .insert({
          title,
          slug,
          excerpt: excerpt || null,
          content: post.text || null,
          status: "ai_draft",
          source_name: source.name,
          source_url: post.link || `https://t.me/${channelName}/${post.postId}`,
          cover_image: post.image || null,
          language: source.language || "uz",
          category_id: source.category_id || null,
          ingestion_source_id: sourceId,
          ingestion_job_id: jobId,
          ai_source_fingerprint: fingerprint,
        })
        .select("id")
        .single()

      if (insertError) {
        await supabaseAdmin.rpc("log_ingestion", {
          p_job_id: jobId,
          p_source_id: sourceId,
          p_event_type: "failed",
          p_message: `Insert error: ${insertError.message}`,
          p_metadata: { postId: post.postId },
        })
        continue
      }

      newCount++

      await supabaseAdmin.rpc("enqueue_news_job", {
        p_job_type: "ai_validate",
        p_payload: { article_id: article.id, source: "telegram" },
        p_priority: 1,
        p_source_id: sourceId,
        p_article_id: article.id,
      })
    }

    await supabaseAdmin.from("news_jobs").update({
      status: "completed",
      result: { processed: posts.length, new: newCount, duplicates: dupCount },
      completed_at: new Date().toISOString(),
    }).eq("id", jobId)

    await supabaseAdmin.rpc("log_ingestion", {
      p_job_id: jobId,
      p_source_id: sourceId,
      p_event_type: "completed",
      p_message: `Processed ${posts.length} posts, ${newCount} new, ${dupCount} duplicates`,
      p_metadata: { processed: posts.length, new: newCount, duplicates: dupCount },
    })

    return new Response(JSON.stringify({ processed: posts.length, new: newCount, duplicates: dupCount, source: source.url }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    const msg = (err as Error).message
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
