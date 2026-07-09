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

function extractTag(text: string, tag: string): string {
  const openTag = `<${tag}>`
  const openTag2 = `<${tag} `
  let start = text.indexOf(openTag)
  if (start === -1) start = text.indexOf(openTag2)
  if (start === -1) return ""

  const contentStart = text.indexOf(">", start) + 1
  const closeTag = `</${tag}>`
  const contentEnd = text.indexOf(closeTag, contentStart)
  if (contentEnd === -1) return ""

  let content = text.substring(contentStart, contentEnd)
  const cdStart = content.indexOf("<![CDATA[")
  if (cdStart !== -1) {
    const cdEnd = content.indexOf("]]>")
    if (cdEnd !== -1) {
      content = content.substring(cdStart + 9, cdEnd)
    }
  }
  return content.trim()
}

function parseRssItems(xml: string): Array<Record<string, string>> {
  const items: Array<Record<string, string>> = []
  let pos = 0
  while (true) {
    const itemStart = xml.indexOf("<item>", pos)
    if (itemStart === -1) break
    const itemEnd = xml.indexOf("</item>", itemStart)
    if (itemEnd === -1) break
    const block = xml.substring(itemStart + 6, itemEnd)
    pos = itemEnd + 7

    const title = extractTag(block, "title")
    const link = extractTag(block, "link")
    const description = extractTag(block, "description")
    const pubDate = extractTag(block, "pubDate")
    const category = extractTag(block, "category")

    if (title || link) {
      items.push({ title, link, description, pubDate, category })
    }
  }
  return items
}

Deno.serve(async (_req) => {
  try {
    const { data: jobData, error: claimError } = await supabaseAdmin.rpc(
      "claim_next_news_job",
      { p_job_type: "rss_ingest" }
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
      p_message: `Fetching RSS: ${source.url}`,
    })

    const resp = await fetch(source.url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
    const xml = await resp.text()

    const items = parseRssItems(xml)
    let newCount = 0
    let dupCount = 0

    for (const item of items) {
      const fingerprint = simpleHash(item.title + item.link)

      const { data: existing } = await supabaseAdmin
        .from("news_articles")
        .select("id")
        .eq("ai_source_fingerprint", fingerprint)
        .is("deleted_at", null)
        .maybeSingle()

      if (existing) {
        dupCount++
        await supabaseAdmin.rpc("log_ingestion", {
          p_job_id: jobId,
          p_source_id: sourceId,
          p_event_type: "duplicate_skipped",
          p_message: `Duplicate: ${item.title}`,
          p_metadata: { fingerprint },
        })
        continue
      }

      const slug = slugify(item.title || "untitled") || "news-" + Date.now()
      const excerpt = item.description
        ? item.description.replace(/<[^>]*>/g, "").substring(0, 500)
        : null

      const { data: article, error: insertError } = await supabaseAdmin
        .from("news_articles")
        .insert({
          title: item.title || "Untitled",
          slug,
          excerpt,
          content: item.description || null,
          status: "ai_draft",
          source_name: source.name,
          source_url: item.link || source.url,
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
          p_metadata: { title: item.title, fingerprint },
        })
        continue
      }

      newCount++

      await supabaseAdmin.rpc("enqueue_news_job", {
        p_job_type: "ai_validate",
        p_payload: { article_id: article.id, source: "rss" },
        p_priority: 1,
        p_source_id: sourceId,
        p_article_id: article.id,
      })
    }

    await supabaseAdmin.from("news_jobs").update({
      status: "completed",
      result: { processed: items.length, new: newCount, duplicates: dupCount },
      completed_at: new Date().toISOString(),
    }).eq("id", jobId)

    await supabaseAdmin.rpc("log_ingestion", {
      p_job_id: jobId,
      p_source_id: sourceId,
      p_event_type: "completed",
      p_message: `Processed ${items.length} items, ${newCount} new, ${dupCount} duplicates`,
      p_metadata: { processed: items.length, new: newCount, duplicates: dupCount },
    })

    return new Response(JSON.stringify({ processed: items.length, new: newCount, duplicates: dupCount }), {
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
