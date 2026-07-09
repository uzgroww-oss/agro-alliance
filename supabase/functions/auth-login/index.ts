import { handleCors } from "../_shared/cors.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required, isEmail } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import type { DbRoleName, AuthUser } from "../_shared/auth.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  const body = await req.json().catch(() => ({}))
  const errors = validate(body, {
    email: [required, (v) => isEmail(v as string) ? null : "Email format notog'ri"],
    password: [required],
  })

  if (errors.length > 0) {
    return errorResponse(errors[0], 400)
  }

  const { email, password } = body as { email: string; password: string }

  // 1. Foydalanuvchini topish va email'ni avtomatik tasdiqlash
  try {
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    const targetUser = usersData?.users?.find((u) => u.email === email)
    if (targetUser && !targetUser.email_confirmed_at) {
      await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        email_confirm: true,
      })
    }
  } catch {
    // Tasdiqlash xatolik bo'lsa — davom etamiz
  }

  // 2. Sign in qilish
  const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({ email, password })

  if (authError) {
    return errorResponse("Email yoki parol notog'ri", 401)
  }

  const userId = authData.user.id

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, name, avatar, phone, language, timezone, bio, status, metadata")
    .eq("id", userId)
    .single()

  if (!profile) {
    return errorResponse("Profil topilmadi", 404)
  }

  if (profile.status !== "active") {
    return errorResponse("Hisobingiz faollashtirilmagan", 403)
  }

  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role:roles(name, priority)")
    .eq("profile_id", userId)

  const sorted = (userRoles ?? [])
    .map((ur: Record<string, unknown>) => (ur as { role: { name: string; priority: number } }).role)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  const roleName = sorted[0]?.name ?? "user"

  const user: AuthUser = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    status: profile.status,
    role: roleName as DbRoleName,
  }

  return jsonResponse({ token: authData.session.access_token, user })
})
