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

function extractByTag(html: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")
  const matches: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1].trim())
  }
  return matches.join("\n")
}

function extractMetaContent(html: string, name: string): string {
  const regex = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i")
  const match = regex.exec(html)
  if (match) return match[1]
  const regex2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, "i")
  const match2 = regex2.exec(html)
  return match2 ? match2[1] : ""
}

function extractImages(html: string): string[] {
  const regex = /<img[^>]+src=["']([^"']+)["']/gi
  const urls: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    urls.push(match[1])
  }
  return urls
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

Deno.serve(async (_req) => {
  try {
    const { data: jobData, error: claimError } = await supabaseAdmin.rpc(
      "claim_next_news_job",
      { p_job_type: "web_crawl" }
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
      p_message: `Crawling: ${source.url}`,
    })

    const resp = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AIBot/1.0; +https://allianse.uz)",
        Accept: "text/html",
      },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
    const html = await resp.text()

    const articleContent = extractByTag(html, "article")
    const mainContent = extractByTag(html, "main")
    const bodyContent = extractByTag(html, "body")

    let title = ""
    const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
    if (h1Match) title = stripHtml(h1Match[1])
    if (!title) {
      const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
      if (titleMatch) title = stripHtml(titleMatch[1])
    }

    const metaDesc = extractMetaContent(html, "description")
    const ogImage = extractMetaContent(html, "og:image")
    const images = extractImages(html)

    const content = articleContent || mainContent || bodyContent || ""
    const cleanContent = stripHtml(content)
    const excerpt = metaDesc || cleanContent.substring(0, 500)

    const fingerprint = simpleHash(source.url + title)

    const { data: existing } = await supabaseAdmin
      .from("news_articles")
      .select("id")
      .eq("ai_source_fingerprint", fingerprint)
      .is("deleted_at", null)
      .maybeSingle()

    if (existing) {
      await supabaseAdmin.rpc("log_ingestion", {
        p_job_id: jobId,
        p_source_id: sourceId,
        p_event_type: "duplicate_skipped",
        p_message: `Duplicate: ${title}`,
        p_metadata: { fingerprint },
      })
      await supabaseAdmin.from("news_jobs").update({
        status: "completed",
        result: { processed: 1, new: 0, duplicates: 1 },
        completed_at: new Date().toISOString(),
      }).eq("id", jobId)
      return new Response(JSON.stringify({ processed: 1, new: 0, duplicates: 1, url: source.url }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    const slug = slugify(title || source.name) || "news-" + Date.now()

    const { data: article, error: insertError } = await supabaseAdmin
      .from("news_articles")
      .insert({
        title: title || source.name,
        slug,
        excerpt: excerpt?.substring(0, 500) || null,
        content: cleanContent || null,
        status: "ai_draft",
        source_name: source.name,
        source_url: source.url,
        cover_image: images[0] || ogImage || null,
        language: source.language || "uz",
        category_id: source.category_id || null,
        ingestion_source_id: sourceId,
        ingestion_job_id: jobId,
        ai_source_fingerprint: fingerprint,
      })
      .select("id")
      .single()

    if (insertError) throw insertError

    await supabaseAdmin.rpc("enqueue_news_job", {
      p_job_type: "ai_validate",
      p_payload: { article_id: article.id, source: "web" },
      p_priority: 1,
      p_source_id: sourceId,
      p_article_id: article.id,
    })

    await supabaseAdmin.from("news_jobs").update({
      status: "completed",
      result: { processed: 1, new: 1, duplicates: 0 },
      completed_at: new Date().toISOString(),
    }).eq("id", jobId)

    await supabaseAdmin.rpc("log_ingestion", {
      p_job_id: jobId,
      p_source_id: sourceId,
      p_event_type: "completed",
      p_message: `Processed: ${title}`,
      p_metadata: { url: source.url, title, images: images.length },
    })

    return new Response(JSON.stringify({ processed: 1, new: 1, duplicates: 0, url: source.url }), {
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
