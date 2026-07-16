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
        blogger_regions(region)
      `)
      .is("deleted_at", null)
      .eq("slug", slug)
      .eq("profiles.status", "active")
      .is("profiles.deleted_at", null)
      .maybeSingle()

    if (error) return errorResponse(error.message, 500)
    if (!blogger) return cachedJsonResponse({ blogger: null }, CACHE_TTL)

    const bloggerId = blogger.id as string
    const profile = blogger.profiles as Record<string, unknown> || {}
    const metadata = (profile.metadata as Record<string, unknown>) || {}

    const [servicesRes, achievementsRes, specializationsRes, socialsRes, statsRes, brandsRes] = await Promise.all([
      supabaseAdmin.from("blogger_services").select("id, title, description").eq("blogger_id", bloggerId).is("deleted_at", null).order("sort_order", { ascending: true }),
      supabaseAdmin.from("blogger_achievements").select("id, title, subtitle, icon").eq("blogger_id", bloggerId).is("deleted_at", null).order("sort_order", { ascending: true }),
      supabaseAdmin.from("blogger_specializations").select("specialization_key").eq("blogger_id", bloggerId),
      supabaseAdmin.from("social_accounts").select("id, account_name, profile_url, avatar_url, is_verified, platform:social_platforms!inner(key, name, icon, color)").is("deleted_at", null).eq("blogger_id", bloggerId).eq("is_active", true),
      supabaseAdmin.from("blogger_social_summary").select("total_subscribers, total_views, avg_engagement_rate, total_videos, active_platforms").eq("blogger_id", bloggerId).maybeSingle(),
      supabaseAdmin.from("blogger_brands").select("id, name, logo_url").eq("blogger_id", bloggerId).is("deleted_at", null).order("sort_order", { ascending: true }),
    ])

    const services = servicesRes.data || []
    const achievements = achievementsRes.data || []
    const specializations = specializationsRes.data || []
    const socials = socialsRes.data || []
    const statsRow = statsRes.data
    const brands = brandsRes.data || []
    console.log("Blogger profile stats row:", JSON.stringify(statsRow))
    console.log("Social accounts count:", socials.length)

    // Har bir platforma uchun social_statistics dan so'nggi statistikani olish
    const socialAccountIds = (socials || []).map((s: any) => s.id)
    const platformStatsMap: Record<string, { subscribers: number; views: number; engagement: number }> = {}
    if (socialAccountIds.length > 0) {
      const { data: allStats } = await supabaseAdmin
        .from("social_statistics")
        .select("account_id, subscribers_count, views_count, engagement_rate")
        .in("account_id", socialAccountIds)
        .is("deleted_at", null)
        .order("snapshot_date", { ascending: false })

      for (const stat of allStats || []) {
        if (!(stat.account_id in platformStatsMap)) {
          platformStatsMap[stat.account_id] = {
            subscribers: stat.subscribers_count || 0,
            views: stat.views_count || 0,
            engagement: stat.engagement_rate || 0,
          }
        }
      }
    }

    const liveSocials = (socials || []).map((s: Record<string, unknown>) => {
      const platform = s.platform as Record<string, unknown> || {}
      const sid = s.id as string
      const ps = platformStatsMap[sid]
      return {
        id: sid,
        platform: platform.name || platform.key || "",
        link: s.profile_url || "",
        name: s.account_name as string || "",
        avatar: s.avatar_url as string || undefined,
        subscribers: ps?.subscribers?.toString() || undefined,
        views: ps?.views?.toString() || undefined,
        engagement: ps?.engagement || undefined,
      }
    })

    const images = (metadata.images as Array<{ id: string; url: string; caption?: string }>) || []
    const rawVideos = (metadata.videos as Array<Record<string, unknown>>) || []

    const live = {
      slug: blogger.slug,
      name: profile.name as string || "",
      status: profile.status as string || "active",
      cover: blogger.cover as string || "",
      experienceYears: blogger.experience_years as number || 0,
      bio: profile.bio as string || "",
      profile: {
        // XAVFSIZLIK: butun metadata JSON ochib berilmaydi — faqat kerakli public maydonlar
        photo: profile.avatar as string || "",
        region: (blogger.blogger_regions as Array<Record<string, unknown>> || [])[0]?.region as string || "",
        tag: specializations.map((s) => s.specialization_key).join(", ") || "",
        about: metadata.about as string || "",
        niche: metadata.niche as string || "",
        instagram_url: metadata.instagram_url as string || "",
        youtube_channel: metadata.youtube_channel as string || "",
      },
      stats: {
        subscribers: statsRow?.total_subscribers || 0,
        views: statsRow?.total_views || 0,
        engagement: statsRow?.avg_engagement_rate || 0,
        videos: statsRow?.total_videos || rawVideos.length,
        activePlatforms: statsRow?.active_platforms || 0,
      },
      // Auditoriya analitikasi — metadata'dan olish yoki default qiymatlar
      genderDistribution: (metadata.genderDistribution as { male: number; female: number }) || { male: 68, female: 32 },
      ageDistribution: (metadata.ageDistribution as Record<string, number>) || { "18-24": 18, "25-34": 42, "35-44": 25, "45+": 15 },
      regionDistribution: (metadata.regionDistribution as Record<string, number>) || { "Toshkent": 38, "Toshkent viloyati": 22, "Farg'ona viloyati": 12, "Namangan viloyati": 8, "Boshqalar": 20 },
      socials: liveSocials,
      services: services.map((s) => ({ id: s.id as string, title: s.title as string, description: s.description as string || "" })),
      achievements: achievements.map((a) => ({ id: a.id as string, title: a.title as string, subtitle: a.subtitle as string || "", icon: a.icon as string || "" })),
      specializations: specializations.map((s) => s.specialization_key as string),
      regions: (blogger.blogger_regions as Array<Record<string, unknown>> || []).map((r: Record<string, unknown>) => r.region as string),
      brands: (brands || []).map((b: { id: string; name: string; logo_url: string | null }) => ({
        id: b.id,
        name: b.name,
        logoUrl: b.logo_url || "",
      })),
      images,
      videos: rawVideos.map((v) => ({
        id: v.id as string || "",
        name: (v.name as string) || "Video",
        link: (v.link as string) || "",
        views: (v.views as string) || "0",
        thumbnail: (v.thumbnail as string) || undefined,
        plats: (v.plats as string[]) || [],
        date: (v.date as string) || "",
      })),
    }

    return cachedJsonResponse({ blogger: live }, CACHE_TTL)
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
