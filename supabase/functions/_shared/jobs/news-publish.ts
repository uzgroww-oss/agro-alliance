import { jsonResponse, errorResponse } from "../response.ts"
import { supabaseAdmin } from "../supabase.ts"
import { QueueClient } from "../queue.ts"

export async function run(_req: Request): Promise<Response> {
  try {
    const queue = new QueueClient()

    const { data: articles, error } = await supabaseAdmin
      .from("news_articles")
      .select("id, title")
      .eq("status", "scheduled")
      .lte("published_at", new Date().toISOString())
      .is("deleted_at", null)

    if (error) return errorResponse(error.message, 500)

    const enqueued: string[] = []

    for (const article of articles || []) {
      const result = await queue.enqueue(
        "scheduled_publish",
        { article_id: article.id },
        "normal",
        undefined,
        article.id as string,
      )

      if (result.success) {
        enqueued.push(article.id as string)
      }
    }

    console.log(JSON.stringify({
      level: "info",
      message: `Enqueued ${enqueued.length} scheduled publish jobs`,
      metadata: { article_ids: enqueued },
    }))

    return jsonResponse({
      enqueued: enqueued.length,
      articles: enqueued,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
}
