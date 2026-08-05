import { jsonResponse, errorResponse } from "../response.ts"
import { supabaseAdmin } from "../supabase.ts"
import { QueueClient } from "../queue.ts"
import { now } from "../time.ts"
import { log } from "../logger.ts"
import { badSourceUrl } from "../sourceUrl.ts"

export async function run(_req: Request): Promise<Response> {
  try {
    const queue = new QueueClient()
    const timestamp = now()

    const { data: sources, error } = await supabaseAdmin
      .from("news_sources")
      .select("id, name, url, type, last_fetched_at, fetch_interval_minutes")
      .eq("is_active", true)
      .is("deleted_at", null)

    if (error) return errorResponse(error.message, 500)

    const dueSources = (sources || []).filter((s: Record<string, unknown>) => {
      /**
       * XAVFLI MANZIL NAVBATGA UMUMAN TUSHMAYDI.
       *
       * Bazada xavfsizlik sinovidan qolgan manbalar bor edi
       * (file:///etc/passwd, 169.254.169.254 — bulut metama'lumoti,
       * ichki tarmoq manzillari). Ular faqat kiritish paytida
       * tekshirilardi; bazaga tushib qolgani esa hech qachon qayta
       * ko'rilmasdi. Endi bu yerda ham tekshiriladi — ish yaratilmasa,
       * ularni hech kim yuklamaydi.
       */
      const xato = badSourceUrl(String(s.url || ""))
      if (xato) {
        log("warn", `Manba o'tkazib yuborildi: ${s.name} — ${xato}`)
        return false
      }
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
}
