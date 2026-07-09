import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

const CACHE_TTL = 120

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const slug = new URL(req.url).searchParams.get("slug")
    if (!slug) return errorResponse("Slug query parameter is required", 400)

    const { data: blogger, error } = await supabaseAdmin
      .from("bloggers")
      .select(`
        id, slug, rating, is_featured, is_verified, cover, experience_years,
        profiles!bloggers_id_fkey!inner(id, name, avatar, bio, status, metadata),
        blogger_specializations(specialization_key),
        blogger_regions(region),
        blogger_services(title, description, sort_order),
        blogger_achievements(title, subtitle, icon, sort_order)
      `)
      .is("deleted_at", null)
      .eq("slug", slug)
      .eq("is_verified", true)
      .eq("profiles.status", "active")
      .is("profiles.deleted_at", null)
      .maybeSingle()

    if (error) return errorResponse(error.message, 500)
    if (!blogger) return cachedJsonResponse({ blogger: null }, CACHE_TTL)

    const profile = blogger.profiles as Record<string, unknown> || {}
    const metadata = (profile.metadata as Record<string, string>) || {}

    const { data: socials } = await supabaseAdmin
      .from("social_accounts")
      .select(`
        id, account_name, profile_url, avatar_url, is_verified,
        platform:social_platforms!inner(key, name, icon, color)
      `)
      .is("deleted_at", null)
      .eq("blogger_id", blogger.id)
      .eq("is_active", true)

    const liveSocials = (socials || []).map((s: Record<string, unknown>) => {
      const platform = s.platform as Record<string, unknown> || {}
      return {
        id: s.id,
        platform: platform.name || platform.key || "",
        link: s.profile_url || "",
        name: s.account_name as string || "",
        avatar: s.avatar_url as string || undefined,
        subscribers: undefined as string | undefined,
      }
    })

    const live = {
      slug: blogger.slug,
      name: profile.name as string || "",
      status: profile.status as string || "active",
      profile: {
        photo: profile.avatar as string || "",
        region: (blogger.blogger_regions as Array<Record<string, unknown>> || [])[0]?.region as string || "",
        tag: (blogger.blogger_specializations as Array<Record<string, unknown>> || []).map((s: Record<string, unknown>) => s.specialization_key).join(", ") || "",
        bio: profile.bio as string || "",
        ...metadata,
      },
      socials: liveSocials,
      videos: [],
    }

    return cachedJsonResponse({ blogger: live }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
