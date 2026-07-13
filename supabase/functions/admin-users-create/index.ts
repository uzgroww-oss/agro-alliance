import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { validate, required, isEmail, minLength } from "../_shared/validation.ts"

const VALID_ROLES = ["super_admin", "admin", "editor", "company"]

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const errors = validate(body, {
      name: [required],
      email: [required, (v: unknown) => isEmail(v as string) ? null : "Email format notog'ri"],
      password: [required, (v: unknown) => minLength(v as string, 6) ? null : "Parol kamida 6 belgi"],
      role: [required, (v: unknown) => VALID_ROLES.includes(v as string) ? null : "Role notog'ri"],
    })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const { name, email, password, role } = body as Record<string, string>

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email)
    if (existingUser?.user) return errorResponse("Bu email bilan foydalanuvchi allaqachon mavjud", 409)

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    })
    if (createError) return errorResponse(createError.message, 500)
    if (!newUser?.user) return errorResponse("Foydalanuvchi yaratilmadi", 500)

    const userId = newUser.user.id

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        email,
        name,
        status: "active",
        created_by: auth.user.id,
      })
    if (profileError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return errorResponse(profileError.message, 500)
    }

    // Get role id
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", role)
      .is("deleted_at", null)
      .single()
    if (roleError || !roleRow) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from("profiles").delete().eq("id", userId)
      return errorResponse("Role topilmadi", 500)
    }

    // Assign role
    const { error: userRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ profile_id: userId, role_id: roleRow.id })
    if (userRoleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from("profiles").delete().eq("id", userId)
      return errorResponse(userRoleError.message, 500)
    }

    return jsonResponse({
      success: true,
      user: { id: userId, name, email, role },
    })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
