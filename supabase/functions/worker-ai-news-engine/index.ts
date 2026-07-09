/**
 * worker-ai-news-engine
 *
 * Fetches agricultural news from worldwide RSS feeds,
 * uses Gemini AI to pick the best stories, translate to Uzbek,
 * generate summaries, SEO, and find images.
 *
 * Runs via cron: triggers RSS ingestion for all active global sources.
 * Target: ~5 articles per day from the internet.
 */

import { supabaseAdmin } from "../_shared/supabase.ts"
import { geminiJson, geminiChat } from "../_shared/gemini.ts"
import { slugify } from "../_shared/helpers.ts"
import { now } from "../_shared/time.ts"
import { GLOBAL_AGRO_FEEDS, AGRO_SEARCH_TOPICS } from "../_shared/globalAgroFeeds.ts"

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
  if (cdStart !== 1) {
    const cdEnd = content.indexOf("]]>", cdStart)
    if (cdEnd !== -1) content = content.substring(cdStart + 9, cdEnd)
  }
  return content.replace(/<[^>]*>/g, "").trim()
}

function parseRssItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string; category: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string; category: string }> = []
  let pos = 0
  while (true) {
    const itemStart = xml.indexOf("<item>", pos)
    if (itemStart === -1) break
    const itemEnd = xml.indexOf("</item>", itemStart)
    if (itemEnd === -1) break
    const block = xml.substring(itemStart + 6, itemEnd)
    pos = itemEnd + 7
    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      description: extractTag(block, "description"),
      pubDate: extractTag(block, "pubDate"),
      category: extractTag(block, "category"),
    })
  }
  return items
}

interface RssResult {
  source: string
  country: string
  items: Array<{ title: string; link: string; description: string }>
}

async function fetchFeed(feed: { name: string; url: string; country: string; lang: string }): Promise<RssResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const resp = await fetch(feed.url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!resp.ok) return { source: feed.name, country: feed.country, items: [] }
    const xml = await resp.text()
    const items = parseRssItems(xml)
      .filter((i) => i.title && (i.description || i.link))
      .slice(0, 10)
    return { source: feed.name, country: feed.country, items }
  } catch {
    return { source: feed.name, country: feed.country, items: [] }
  }
}

Deno.serve(async (_req) => {
  try {
    // Check if we already have enough articles today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { count } = await supabaseAdmin
      .from("news_articles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString())
      .is("deleted_at", null)

    const DAILY_TARGET = 5
    const remaining = DAILY_TARGET - (count || 0)
    if (remaining <= 0) {
      return new Response(JSON.stringify({ message: "Daily limit reached", today_count: count }), { status: 200 })
    }

    // Fetch from all RSS feeds in parallel (max 8 at a time to avoid timeouts)
    const allItems: RssResult[] = []
    const batchSize = 8
    for (let i = 0; i < GLOBAL_AGRO_FEEDS.length; i += batchSize) {
      const batch = GLOBAL_AGRO_FEEDS.slice(i, i + batchSize)
      const results = await Promise.all(batch.map(fetchFeed))
      allItems.push(...results)
    }

    const totalFetched = allItems.reduce((s, r) => s + r.items.length, 0)
    if (totalFetched === 0) {
      return new Response(JSON.stringify({ message: "No items fetched from RSS feeds" }), { status: 200 })
    }

    // Flatten all titles + descriptions for Gemini selection
    const allTitles = allItems.flatMap((r) =>
      r.items.map((i) => `[${r.source}|${r.country}] ${i.title}: ${i.description.substring(0, 200)}`)
    )

    // Use Gemini to select the BEST agricultural news from all fetched items
    let selected: Array<{ title: string; description: string; source: string; link: string }>
    try {
      selected = await geminiJson<Array<{ title: string; description: string; source: string; link: string }>>(
        `You are an agricultural news editor for Uzbekistan audience. From the list below, select the ${remaining} MOST important and interesting agricultural news stories.

Focus on:
1. Technology & innovation in agriculture
2. Crop production, harvests, yields
3. Government agricultural policies
4. Climate & sustainability
5. Farming equipment & drones
6. Food security & trade
7. Central Asia agriculture

Here are the available articles:
${allTitles.slice(0, 100).join("\n")}

Return JSON array of ${remaining} objects with:
{"title": "short English title", "description": "2-3 sentence summary in English", "source": "source name", "link": "url"}`,
        { temperature: 0.5, maxTokens: 2048 },
      )
    } catch {
      // Fallback: take first N items
      selected = allItems.flatMap((r) =>
        r.items.slice(0, 2).map((i) => ({
          title: i.title,
          description: i.description.substring(0, 200),
          source: r.source,
          link: i.link,
        }))
      ).slice(0, remaining)
    }

    let published = 0
    const results: string[] = []

    for (const item of selected.slice(0, remaining)) {
      try {
        const fingerprint = simpleHash(item.title + item.link)

        // Check duplicate
        const { data: existing } = await supabaseAdmin
          .from("news_articles")
          .select("id")
          .eq("ai_source_fingerprint", fingerprint)
          .is("deleted_at", null)
          .maybeSingle()
        if (existing) continue

        // Translate to Uzbek and generate full content using Gemini
        const translated = await geminiJson<{
          title_uz: string
          content_uz: string
          summary_uz: string
          seo_title: string
          seo_description: string
          tags: string[]
          category: string
        }>(
          `You are a professional agricultural news translator and writer for Uzbekistan. 
Translate and rewrite this article for Uzbek audience.

Original title: ${item.title}
Original description: ${item.description}
Source: ${item.source}

Write a professional agricultural news article in Uzbek (Latin script). The article should be:
- Informative and well-structured
- 300-500 words
- Include relevant agricultural terminology
- Mention real statistics and data when available
- Professional journalistic tone

Return JSON only:
{
  "title_uz": "Uzbek title (catchy, SEO-friendly)",
  "content_uz": "Full article in Uzbek (300-500 words, HTML paragraphs)",
  "summary_uz": "2-3 sentence summary in Uzbek",
  "seo_title": "SEO title (max 60 chars)",
  "seo_description": "Meta description (max 160 chars)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category": "texnologiya|qishloq|bozor|davlat|innovatsiya|ekologiya|tadqiqotlar|xalqaro"
}`,
          { temperature: 0.7, maxTokens: 2048 },
        )

        const slug = slugify(translated.title_uz) || "agro-" + Date.now()

        // Find category
        const { data: categories } = await supabaseAdmin
          .from("news_categories")
          .select("id, key")
          .eq("is_active", true)
          .is("deleted_at", null)

        const matchedCat = categories?.find((c: any) => c.key === translated.category)

        // Image: use Unsplash source API with relevant keywords
        const imageKeywords = [translated.category, "agriculture", "farming"].join(",")
        const imageUrl = `https://source.unsplash.com/800x500/?${encodeURIComponent(imageKeywords)}`

        // Insert article
        const { data: article, error: insertError } = await supabaseAdmin
          .from("news_articles")
          .insert({
            title: translated.title_uz,
            slug,
            excerpt: translated.summary_uz,
            content: `<p>${translated.content_uz.split("\n\n").join("</p><p>")}</p>`,
            status: "draft",
            source_name: item.source,
            source_url: item.link,
            language: "uz",
            category_id: matchedCat?.id || null,
            ai_source_fingerprint: fingerprint,
            ai_validated: true,
            ai_validated_at: now(),
            ai_confidence: 85,
            ai_seo_title: translated.seo_title,
            ai_seo_description: translated.seo_description,
            ai_tags: translated.tags,
            seo_title: translated.seo_title,
            seo_description: translated.seo_description,
            ai_summary_uz: translated.summary_uz,
            featured_image_url: imageUrl,
          })
          .select("id")
          .single()

        if (insertError) {
          results.push(`FAIL: ${item.title} — ${insertError.message}`)
          continue
        }

        published++
        results.push(`OK: ${translated.title_uz} (${item.source})`)

      } catch (e) {
        results.push(`ERROR: ${item.title} — ${(e as Error).message}`)
      }
    }

    console.log(JSON.stringify({
      level: "info",
      message: `AI News Engine: ${published}/${selected.length} articles published, ${totalFetched} fetched from RSS`,
      metadata: { published, fetched: totalFetched, results },
    }))

    return new Response(JSON.stringify({
      published,
      target: DAILY_TARGET,
      fetched: totalFetched,
      results,
    }), { status: 200 })

  } catch (err) {
    const msg = (err as Error).message
    console.error(JSON.stringify({ level: "error", message: msg }))
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
