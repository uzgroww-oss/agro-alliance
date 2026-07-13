/**
 * worker-ai-news-engine — RSS dan yangilik + asl rasm + to'liq o'zbekcha tarjima.
 * Ism-familiya va joy nomlari tarjima qilinmaydi.
 */
import { supabaseAdmin } from "../_shared/supabase.ts"
import { slugify } from "../_shared/helpers.ts"
import { now } from "../_shared/time.ts"
import { GLOBAL_AGRO_FEEDS } from "../_shared/globalAgroFeeds.ts"

function simpleHash(s: string): string { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h = h & h } return Math.abs(h).toString(36) }
function extractTag(xml: string, tag: string): string { const s = xml.indexOf(`<${tag}>`); if (s === -1) return ""; const cs = xml.indexOf(">", s) + 1; const ce = xml.indexOf(`</${tag}>`, cs); return ce === -1 ? "" : xml.substring(cs, ce).replace(/<[^>]*>/g, "").trim() }
function parseRss(xml: string) { const items: Array<{ title: string; link: string; description: string; image: string }> = []; let pos = 0; while (true) { const s = xml.indexOf("<item>", pos); if (s === -1) break; const e = xml.indexOf("</item>", s); if (e === -1) break; const b = xml.substring(s + 6, e); pos = e + 7; items.push({ title: extractTag(b, "title"), link: extractTag(b, "link"), description: extractTag(b, "description"), image: extractTag(b, "media:content") || extractTag(b, "enclosure") || "" }) } return items.filter((i) => i.title && i.description) }

async function fetchFeed(f: { name: string; url: string; country: string }) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000)
    const r = await fetch(f.url, { signal: c.signal }); clearTimeout(t)
    if (!r.ok) return []
    return (await parseRss(await r.text())).slice(0, 8)
  } catch { return [] }
}

/** Asl maqola sahifasidan rasm URL ni olish (og:image) */
async function fetchArticleImage(url: string): Promise<string> {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000)
    const r = await fetch(url, { signal: c.signal }); clearTimeout(t)
    if (!r.ok) return ""
    const html = await r.text()
    // og:image ni topish
    const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
      || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i)
    if (ogMatch && ogMatch[1].startsWith("http")) return ogMatch[1]
    // twitter:image ni topish
    const twMatch = html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i)
    if (twMatch && twMatch[1].startsWith("http")) return twMatch[1]
    // Birinchi katta rasmni topish
    const imgMatch = html.match(/<img[^>]*src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i)
    if (imgMatch) return imgMatch[1]
  } catch { /* ignore */ }
  return ""
}

async function groqCall(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("GROQ_API_KEY")
  if (!apiKey) throw new Error("GROQ_API_KEY not set")
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], max_tokens: 2048, temperature: 0.7 }),
  })
  if (!resp.ok) throw new Error(`Groq ${resp.status}`)
  const data = await resp.json()
  return data.choices?.[0]?.message?.content ?? ""
}

function extractJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error("No JSON found")
  return JSON.parse(match[0])
}

Deno.serve(async (_req) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { count } = await supabaseAdmin.from("news_articles").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()).is("deleted_at", null).not("source_name", "is", null)
    const TARGET = 5, remaining = TARGET - (count || 0)
    if (remaining <= 0) return new Response(JSON.stringify({ message: "Limit reached", count }), { status: 200 })

    // RSS
    const allItems: Array<{ title: string; link: string; description: string; source: string; image: string }> = []
    for (let i = 0; i < GLOBAL_AGRO_FEEDS.length; i += 8) { const batch = GLOBAL_AGRO_FEEDS.slice(i, i + 8); const results = await Promise.all(batch.map(async (f) => (await fetchFeed(f)).map((it) => ({ ...it, source: f.name })))); allItems.push(...results.flat()) }
    if (allItems.length === 0) return new Response(JSON.stringify({ message: "No RSS" }), { status: 200 })

    // Tanlash
    const titles = allItems.slice(0, 8).map((a, i) => `${i + 1}. ${a.title.substring(0, 60)}`).join("; ")
    let best: Array<{ title: string; description: string; source: string; link: string; image: string }>
    try {
      const raw = await groqCall(`Eng muhim ${remaining} ta agro yangilikni tanla. JSON: [{"title":"..","description":"..","source":"..","link":".."}]\n${titles}`)
      best = extractJson(raw)
      // RSS dan rasm URL ni qo'shish
      best = best.map((item) => {
        const rssItem = allItems.find((r) => r.title === item.title)
        return { ...item, image: rssItem?.image || "" }
      })
    } catch { best = allItems.slice(0, remaining).map((a) => ({ title: a.title, description: a.description, source: a.source, link: a.link, image: a.image })) }

    const categories = (await supabaseAdmin.from("news_categories").select("id, key").eq("is_active", true).is("deleted_at", null)).data || []
    let published = 0; const results: string[] = []

    for (let i = 0; i < best.length && i < remaining; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 2000))

      const s = best[i]; const fp = simpleHash(s.title + s.link)
      const { data: ex } = await supabaseAdmin.from("news_articles").select("id").eq("ai_source_fingerprint", fp).is("deleted_at", null).maybeSingle()
      if (ex) continue

      // Asl sahifadan rasm olish (agar RSS da yo'q bo'lsa)
      let originalImage = s.image
      if (!originalImage && s.link) {
        originalImage = await fetchArticleImage(s.link)
      }

      let t = s.title, c = `<p>${s.description}</p>`, sm = s.description.substring(0, 200), tags = ["agro"], cat = "xalqaro"
      try {
        const raw = await groqCall(
          `Translate to Uzbek. Return ONLY JSON. Do NOT translate: company names, person names, place names (keep them as-is). Only translate descriptive text.

Title: ${s.title}
Content: ${s.description.substring(0, 400)}

{"title":"translated title","body":"<p>translated paragraph 1</p><p>translated paragraph 2</p>","summary":"translated summary","tags":["tag1","tag2"],"category":"texnologiya|qishloq|bozor|xalqaro"}`
        )
        const tr = extractJson(raw)
        t = tr.title || t; c = tr.body || `<p>${s.description}</p>`; sm = tr.summary || s.description.substring(0, 200)
        tags = Array.isArray(tr.tags) ? tr.tags.slice(0, 5) : ["agro"]
        cat = ["texnologiya", "qishloq", "bozor", "davlat", "innovatsiya", "ekologiya", "tadqiqotlar", "xalqaro"].includes(tr.category) ? tr.category : "xalqaro"
      } catch (e) { console.log(`Error [${i}]:`, (e as Error).message) }

      const slug = slugify(t) || "agro-" + Date.now() + "-" + i
      const catObj = categories.find((c: any) => c.key === cat)

      // Rasm: asl manba rasmi → Pollinations fallback
      const imageUrl = originalImage || `https://image.pollinations.ai/prompt/${encodeURIComponent(s.title.substring(0, 80))}?width=800&height=500&nologo=true&seed=${i}`

      const { error: insErr } = await supabaseAdmin.from("news_articles").insert({
        title: t, slug, excerpt: sm, content: c, status: "published", published_at: now(),
        source_name: s.source, source_url: s.link, language: "uz", category_id: catObj?.id || null,
        ai_source_fingerprint: fp, ai_validated: true, ai_validated_at: now(), ai_confidence: 90,
        ai_seo_title: t.substring(0, 60), ai_seo_description: sm.substring(0, 160),
        ai_tags: tags, seo_title: t.substring(0, 60), seo_description: sm.substring(0, 160),
        ai_summary_uz: sm, cover_image: imageUrl,
      })
      if (insErr) { results.push(`FAIL: ${t} — ${insErr.message}`); continue }
      published++; results.push(`OK: ${t} (${s.source})`)
    }

    return new Response(JSON.stringify({ published, target: TARGET, fetched: allItems.length, results }), { status: 200 })
  } catch (err) { return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 }) }
})
