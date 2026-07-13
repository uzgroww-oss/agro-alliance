import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

function feRole(role: string): string {
  switch (role) {
    case "super_admin":
    case "admin":
    case "editor":
      return "superadmin"
    case "blogger":
      return "blogger"
    case "company":
    case "user":
      return "partner"
    default:
      return "partner"
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Token kerak", 401)

    const token = authHeader.slice(7)
    const { data: { user: authData }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authData) return errorResponse("Token notog'ri", 401)

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, avatar, phone, language, timezone, bio, status, metadata")
      .eq("id", authData.id)
      .maybeSingle()

    if (profileError) return errorResponse("DB error: " + profileError.message, 500)
    if (!profile) return errorResponse("Profil topilmadi", 404)
    if (profile.status !== "active") return errorResponse("Hisobingiz faollashtirilmagan", 403)

    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role:roles(name, priority)")
      .eq("profile_id", authData.id)

    const sorted = (userRoles ?? [])
      .map((ur: any) => ur.role)
      .sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0))

    const roleName = sorted[0]?.name ?? "user"

    const profileFields: Record<string, string> = {}
    if (profile.avatar) profileFields.photo = profile.avatar
    const meta = (profile.metadata as Record<string, unknown>) || {}
    if (typeof meta.age === "string") profileFields.age = meta.age
    if (typeof meta.gender === "string") profileFields.gender = meta.gender
    if (typeof meta.region === "string") profileFields.region = meta.region
    if (typeof meta.language === "string") profileFields.language = meta.language
    if (typeof meta.niche === "string") profileFields.niche = meta.niche
    if (typeof meta.about === "string") profileFields.about = meta.about
    if (profile.bio) profileFields.bio = profile.bio
    if (profile.phone) profileFields.phone = profile.phone

    // YouTube va Instagram ma'lumotlarini qo'shish
    if (meta.youtube_channel) profileFields.youtube_channel = meta.youtube_channel as string
    if (meta.youtube_channel_name) profileFields.youtube_channel_name = meta.youtube_channel_name as string
    if (meta.instagram_url) profileFields.instagram_url = meta.instagram_url as string
    if (meta.instagram_username) profileFields.instagram_username = meta.instagram_username as string

    // Auditoriya analitikasini qo'shish (obyekt sifatida)
    const genderDistribution = meta.genderDistribution as { male: number; female: number } || { male: 68, female: 32 }
    const ageDistribution = meta.ageDistribution as Record<string, number> || { "18-24": 18, "25-34": 42, "35-44": 25, "45+": 15 }
    const regionDistribution = meta.regionDistribution as Record<string, number> || { "Toshkent": 38, "Toshkent viloyati": 22, "Farg'ona viloyati": 12, "Namangan viloyati": 8, "Boshqalar": 20 }

    let banner = ""
    const { data: bloggerData } = await supabaseAdmin
      .from("bloggers")
      .select("cover")
      .eq("id", profile.id)
      .is("deleted_at", null)
      .maybeSingle()
    if (bloggerData?.cover) banner = bloggerData.cover
    profileFields.banner = banner

    const { data: socialAccounts } = await supabaseAdmin
      .from("social_accounts")
      .select("id, account_name, profile_url, avatar_url, platform:social_platforms!inner(key, name)")
      .is("deleted_at", null)
      .eq("blogger_id", profile.id)
      .eq("is_active", true)

    const accountIds = (socialAccounts || []).map((s: any) => s.id)
    const subsMap: Record<string, number> = {}
    const viewsMap: Record<string, number> = {}
    if (accountIds.length > 0) {
      const { data: allStats } = await supabaseAdmin
        .from("social_statistics")
        .select("account_id, subscribers_count, views_count, snapshot_date")
        .in("account_id", accountIds)
        .is("deleted_at", null)
        .order("snapshot_date", { ascending: false })

      for (const stat of allStats || []) {
        if (!(stat.account_id in subsMap)) {
          subsMap[stat.account_id] = stat.subscribers_count
          viewsMap[stat.account_id] = stat.views_count || 0
        }
      }
    }

    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id")
      .eq("client_profile_id", profile.id)
      .is("deleted_at", null)
      .maybeSingle()

    const rawVideos = (meta.videos as unknown[]) || []

    const me = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: feRole(roleName),
      adminRole: roleName,
      partnerId: partner?.id || undefined,
      status: profile.status,
      profile: { ...profileFields, genderDistribution, ageDistribution, regionDistribution },
      socials: (socialAccounts || []).map((acc: any) => ({
        id: acc.id,
        platform: acc.platform?.name || acc.platform?.key || "",
        link: acc.profile_url,
        connected: true,
        name: acc.account_name,
        avatar: acc.avatar_url,
        subscribers: subsMap[acc.id]?.toString() || "0",
        views: viewsMap[acc.id]?.toString() || "0",
      })),
      videos: rawVideos.map((v: any) => ({
        id: v.id,
        name: v.name || "Video",
        link: v.link,
        views: v.views || "0",
        plats: v.plats || [],
        date: v.date || "",
        status: v.status || "published",
        thumbnail: v.thumbnail || undefined,
        author: v.author || undefined,
      })),
    }

    return jsonResponse({ me })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500)
  }
})
