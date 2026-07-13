import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required, isEmail, minLength } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin", "admin")
  if (auth.response) return auth.response

  try {
    const pid = new URL(req.url).searchParams.get("pid")
    if (!pid) return errorResponse("pid kerak", 400)

    const body = await req.json().catch(() => ({}))
    const errors = validate(body, {
      name: [required],
      email: [required, (v) => (isEmail(v as string) ? null : "Email format notog'ri")],
      password: [required, (v) => (minLength(v as string, 6) ? null : "Parol kamida 6 belgi")],
    })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const { name, email, password } = body as { name: string; email: string; password: string }

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from("partners")
      .select("id, client_profile_id")
      .eq("id", pid)
      .is("deleted_at", null)
      .single()

    if (partnerError || !partner) return errorResponse("Partner topilmadi", 404)
    if (partner.client_profile_id) return errorResponse("Partnerda allaqachon client mavjud", 400)

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })

    if (authError) throw new Error(authError.message)

    const userId = authData.user.id

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", "company")
      .single()

    if (roleError) throw roleError

    const { error: userRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ profile_id: userId, role_id: roleData.id })

    if (userRoleError) throw userRoleError

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ name, email, status: "active" })
      .eq("id", userId)

    if (profileError) throw profileError

    const { error: updateError } = await supabaseAdmin
      .from("partners")
      .update({ client_profile_id: userId })
      .eq("id", pid)

    if (updateError) throw updateError

    return jsonResponse({
      success: true,
      client: { id: userId, name, email },
    })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
