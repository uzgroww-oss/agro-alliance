import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { QueueClient } from "../_shared/queue.ts"
import { now } from "../_shared/time.ts"

Deno.serve(async (_req) => {
  try {
    const queue = new QueueClient()
    const timestamp = now()

    const { data: sources, error } = await supabaseAdmin
      .from("news_sources")
      .select("id, name, type, last_fetched_at, fetch_interval_minutes")
      .eq("is_active", true)
      .is("deleted_at", null)

    if (error) return errorResponse(error.message, 500)

    const dueSources = (sources || []).filter((s: Record<string, unknown>) => {
      if (!s.last_fetched_at) return true
      if (!s.fetch_interval_minutes) return false
      const lastFetched = new Date(s.last_fetched_at as string).getTime()
      const intervalMs = (s.fetch_interval_minutes as number) * 60 * 1000
      return Date.now() >= lastFetched + intervalMs
    })

    const typeJobMap: Record<string, string> = {
      rss: "rss_ingest",
      website: "web_crawl",
      telegram: "telegram_monitor",
    }

    const enqueued: string[] = []

    for (const source of dueSources) {
      const jobType = typeJobMap[source.type as string] || "rss_ingest"

      const result = await queue.enqueue(
        jobType,
        { source_id: source.id },
        "normal",
        source.id as string,
      )

      if (result.success) {
        enqueued.push(source.id as string)
      }

      await supabaseAdmin
        .from("news_sources")
        .update({ last_fetched_at: timestamp })
        .eq("id", source.id)
    }

    console.log(JSON.stringify({
      level: "info",
      message: `Enqueued ${enqueued.length} ingestion jobs`,
      metadata: { source_ids: enqueued },
    }))

    return jsonResponse({
      enqueued: enqueued.length,
      sources: enqueued,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
