/**
 * worker-ai-news-engine — Groq AI (Llama 3) powered.
 * 1 Groq call for selection, 1 call per article for translation.
 */
import { supabaseAdmin } from "../_shared/supabase.ts"
import { groqJson } from "../_shared/groq.ts"
import { slugify } from "../_shared/helpers.ts"
import { now } from "../_shared/time.ts"
import { GLOBAL_AGRO_FEEDS } from "../_shared/globalAgroFeeds.ts"

function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h = h & h }
  return Math.abs(h).toString(36)
}

function extractTag(xml: string, tag: string): string {
  const s = xml.indexOf(`<${tag}>`)
  if (s === -1) return ""
  const cs = xml.indexOf(">", s) + 1
  const ce = xml.indexOf(`</${tag}>`, cs)
  return ce === -1 ? "" : xml.substring(cs, ce).replace(/<[^>]*>/g, "").trim()
}

function parseRss(xml: string) {
  const items: Array<{ title: string; link: string; description: string }> = []
  let pos = 0
  while (true) {
    const s = xml.indexOf("<item>", pos)
    if (s === -1) break
    const e = xml.indexOf("</item>", s)
    if (e === -1) break
    const b = xml.substring(s + 6, e)
    pos = e + 7
    items.push({ title: extractTag(b, "title"), link: extractTag(b, "link"), description: extractTag(b, "description") })
  }
  return items.filter((i) => i.title && i.description)
}

async function fetchFeed(f: { name: string; url: string; country: string }) {
  try {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 8000)
    const r = await fetch(f.url, { signal: c.signal })
    clearTimeout(t)
    if (!r.ok) return []
    return (await parseRss(await r.text())).slice(0, 8)
  } catch { return [] }
}

Deno.serve(async (_req) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { count } = await supabaseAdmin
      .from("news_articles").select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()).is("deleted_at", null).not("source_name", "is", null)
    const TARGET = 3, remaining = TARGET - (count || 0)
    if (remaining <= 0) return new Response(JSON.stringify({ message: "Limit reached", count }), { status: 200 })

    // Fetch RSS
    const allItems: Array<{ title: string; link: string; description: string; source: string }> = []
    for (let i = 0; i < GLOBAL_AGRO_FEEDS.length; i += 8) {
      const batch = GLOBAL_AGRO_FEEDS.slice(i, i + 8)
      const results = await Promise.all(batch.map(async (f) => (await fetchFeed(f)).map((it) => ({ ...it, source: f.name }))))
      allItems.push(...results.flat())
    }
    if (allItems.length === 0) return new Response(JSON.stringify({ message: "No RSS" }), { status: 200 })

    // Groq: select best articles
    const titlesList = allItems.slice(0, 15).map((a, i) => `${i + 1}. [${a.source}] ${a.title}`).join("\n")
    let selected: Array<{ idx: number; title: string; description: string; source: string; link: string }>
    try {
      selected = await groqJson(`Select the ${remaining} most important agricultural news. Return ONLY valid JSON array, no other text.

Articles:
${titlesList}

JSON: [{"idx":1,"title":"title","description":"summary","source":"source","link":"url"}]`, { temperature: 0.5, maxTokens: 500, retries: 1 })
    } catch (e) {
      console.log("Selection error:", (e as Error).message)
      selected = allItems.slice(0, remaining).map((a, i) => ({ idx: i, title: a.title, description: a.description, source: a.source, link: a.link }))
    }

    // Groq: translate each article individually
    const categories = (await supabaseAdmin.from("news_categories").select("id, key").eq("is_active", true).is("deleted_at", null)).data || []
    let published = 0
    const results: string[] = []

    for (let i = 0; i < selected.length && i < remaining; i++) {
      const s = selected[i]
      const fp = simpleHash(s.title + s.link)

      const { data: ex } = await supabaseAdmin.from("news_articles").select("id").eq("ai_source_fingerprint", fp).is("deleted_at", null).maybeSingle()
      if (ex) continue

      let titleUz: string, contentUz: string, summaryUz: string, tags: string[], category: string, imgPrompt: string
      try {
        const tr = await groqJson<{ t: string; c: string; s: string; tags: string[]; cat: string; img_prompt: string }>(
          `Translate this agricultural news to Uzbek language. Return ONLY valid JSON, no other text.

Title: ${s.title}
Desc: ${s.description.substring(0, 300)}

Choose ONE category: "texnologiya", "qishloq", "bozor", "davlat", "innovatsiya", "ekologiya", "tadqiqotlar", or "xalqaro"

For img_prompt: Write a detailed 1-2 sentence English description of what a realistic photo for this article should show. Be specific about the scene, objects, colors, lighting. Example: "A modern precision agriculture drone flying over green wheat fields at golden hour, photorealistic"

JSON: {"t":"Uzbek title","c":"<p>Uzbek article 150 words</p>","s":"2 sentence summary","tags":["tag1","tag2"],"cat":"choose one","img_prompt":"detailed English image description"}`,
          { temperature: 0.7, maxTokens: 1024, retries: 1 },
        )
        titleUz = tr.t; contentUz = tr.c; summaryUz = tr.s
        tags = (tr.tags || ["agro"]).slice(0, 5)
        const validCats = ["texnologiya", "qishloq", "bozor", "davlat", "innovatsiya", "ekologiya", "tadqiqotlar", "xalqaro"]
        const rawCat = (tr.cat || "xalqaro").split("|")[0].trim().toLowerCase()
        category = validCats.includes(rawCat) ? rawCat : "xalqaro"
        imgPrompt = tr.img_prompt || "agricultural farm landscape with green fields and blue sky, photorealistic"
      } catch (e) {
        console.log(`Translation error [${i}]:`, (e as Error).message)
        titleUz = s.title; contentUz = `<p>${s.description}</p>`; summaryUz = s.description.substring(0, 200)
        tags = ["agro"]; category = "xalqaro"; imgPrompt = "agricultural farm with green crops and modern equipment, photorealistic"
      }

      const slug = slugify(titleUz) || "agro-" + Date.now()
      const cat = categories.find((c: any) => c.key === category)
      // Pollinations — article-specific AI rasm (sekin lekin mos)
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgPrompt)}?width=800&height=500&nologo=true&seed=${i}`

      const { error: insErr } = await supabaseAdmin.from("news_articles").insert({
        title: titleUz, slug, excerpt: summaryUz, content: contentUz,
        status: "published", published_at: now(),
        source_name: s.source, source_url: s.link, language: "uz",
        category_id: cat?.id || null,
        ai_source_fingerprint: fp, ai_validated: true, ai_validated_at: now(), ai_confidence: 90,
        ai_seo_title: titleUz.substring(0, 60), ai_seo_description: summaryUz.substring(0, 160),
        ai_tags: tags, seo_title: titleUz.substring(0, 60), seo_description: summaryUz.substring(0, 160),
        ai_summary_uz: summaryUz, cover_image: imageUrl,
      })
      if (insErr) { results.push(`FAIL: ${titleUz} — ${insErr.message}`); continue }
      published++
      results.push(`OK: ${titleUz} (${s.source})`)
    }

    return new Response(JSON.stringify({ published, target: TARGET, fetched: allItems.length, results }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }
})
