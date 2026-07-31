import { supabaseAdmin } from "./supabase.ts"
import { errorResponse } from "./response.ts"

export type DbRoleName = "super_admin" | "admin" | "editor" | "blogger" | "company" | "user"

export interface AuthUser {
  id: string
  email: string
  role: DbRoleName
  status: string
  name: string
  [key: string]: unknown
}

export async function verifyAuth(req: Request): Promise<
  { user: AuthUser; response: null } | { user: null; response: Response }
> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, response: errorResponse("Token kerak", 401, "UNAUTHORIZED") }
  }

  const token = authHeader.slice(7)
  const { data: { user: authData }, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !authData) {
    return { user: null, response: errorResponse("Token notog'ri", 401, "INVALID_TOKEN") }
  }

  /**
   * TEZLIK: bu ikki so'rov KETMA-KET edi va ikkalasi ham faqat
   * authData.id ga bog'liq — bir-birini kutishi shart emas.
   *
   * Bu funksiya HAR BIR himoyalangan so'rovda ishlaydi, ya'ni tejalgan
   * bitta borish-kelish butun saytga ta'sir qiladi.
   *
   * Ustiga select("*") butun qatorni tortardi — `metadata` JSONB
   * ustunida rasmlar va videolar massivi saqlanadi. Endi faqat
   * kerakli ustunlar.
   */
  const [{ data: profile, error: profileErr }, { data: userRoles }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, email, name, status")
      .eq("id", authData.id)
      .maybeSingle(),
    supabaseAdmin
      .from("user_roles")
      .select("role:roles(name, priority)")
      .eq("profile_id", authData.id),
  ])

  if (profileErr || !profile) {
    return { user: null, response: errorResponse(profileErr?.message || "Profil topilmadi", 404, "NOT_FOUND") }
  }

  if (profile.status !== "active") {
    return {
      user: null,
      response: errorResponse("Hisobingiz faollashtirilmagan", 403, "ACCOUNT_INACTIVE"),
    }
  }

  const sorted = (userRoles ?? [])
    .map((ur: Record<string, unknown>) => (ur as { role: { name: string; priority: number } }).role)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  const roleName = sorted[0]?.name ?? "user"

  return {
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      status: profile.status,
      role: roleName as DbRoleName,
    },
    response: null,
  }
}

export async function requireRole(
  req: Request,
  ...roles: DbRoleName[]
): Promise<
  { user: AuthUser; response: null } | { user: null; response: Response }
> {
  const result = await verifyAuth(req)
  if (result.response) return result

  if (!roles.includes(result.user.role as DbRoleName)) {
    return {
      user: null,
      response: errorResponse("Ruxsat yo'q", 403, "FORBIDDEN"),
    }
  }

  return result
}
