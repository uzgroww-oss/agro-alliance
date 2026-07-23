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

    // Email band emasligini tekshirish.
    // DIQQAT: supabaseAdmin.auth.admin.getUserByEmail() MAVJUD EMAS (JS v2 da
    // bunday metod yo'q) — uni chaqirish TypeError beradi. Shuning uchun
    // profiles jadvalidan tekshiramiz (loyihaning boshqa joylarida ham shunday).
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle()
    if (existingProfile) return errorResponse("Bu email band", 409)

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    })
    // Zaxira tekshiruv: profiles'da bo'lmasa ham auth'da bo'lishi mumkin
    if (createError) {
      const m = (createError.message || "").toLowerCase()
      if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
        return errorResponse("Bu email band", 409)
      }
      return errorResponse(createError.message, 500)
    }
    if (!newUser?.user) return errorResponse("Foydalanuvchi yaratilmadi", 500)

    const userId = newUser.user.id

    // DIQQAT: handle_new_user triggeri auth foydalanuvchi yaratilishi bilan
    // profiles qatorini (status='pending') va 'user' rolini AVTOMATIK qo'shadi.
    // Shuning uchun bu yerda INSERT emas, UPDATE qilamiz — aks holda
    // "duplicate key value violates unique constraint profiles_pkey" chiqadi.
    // (admin-bloggers-create va admin-partners-create ham shunday qiladi.)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        email,
        name,
        status: "active",
        created_by: auth.user.id,
      })
      .eq("id", userId)
    if (profileError) {
      // Rollback auth user (profiles/user_roles kaskad bilan o'chadi)
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

    // Rolni biriktirish. Trigger allaqachon 'user' rolini bergan — tanlangan
    // rol uning ustiga qo'shiladi. upsert: takror chaqirilsa xato bermasin.
    const { error: userRoleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { profile_id: userId, role_id: roleRow.id },
        { onConflict: "profile_id,role_id", ignoreDuplicates: true },
      )
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
