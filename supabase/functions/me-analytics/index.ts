import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  try {
    const [summaryRes, accountsRes] = await Promise.all([
      supabaseAdmin
        .from("blogger_social_summary")
        .select("*")
        .eq("blogger_id", auth.user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("social_accounts")
        .select("id", { count: "exact", head: true })
        .eq("blogger_id", auth.user.id)
        .is("deleted_at", null),
    ])

    const summary = summaryRes.data

    const analytics = {
      totalSubscribers: summary?.total_subscribers ?? 0,
      totalViews: summary?.total_views ?? 0,
      avgEngagement: summary?.avg_engagement_rate ?? 0,
      totalVideos: summary?.total_videos ?? 0,
      activePlatforms: accountsRes.count ?? 0,
    }

    return jsonResponse({ analytics })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
