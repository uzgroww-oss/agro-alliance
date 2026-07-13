import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { validate, required, isEmail, minLength } from "../_shared/validation.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const AUTH_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await requireRole(req, "super_admin", "admin")
    if (auth.response) return auth.response

    const body = await req.json().catch(() => ({}))
    const errors = validate(body, {
      name: [required],
      email: [required, (v: unknown) => isEmail(v as string) ? null : "Email format notog'ri"],
      password: [required, (v: unknown) => minLength(v as string, 6) ? null : "Parol kamida 6 belgi"],
    })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    let slug = slugify(body.name as string)
    if (!slug) slug = "blogger-" + Date.now()

    // 1. Clean up any existing auth user with this email
    await supabaseAdmin.rpc("delete_auth_user_by_email", { p_email: body.email })

    // 2. Create auth user via REST Admin API (guaranteed proper password hashing)
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { name: body.name },
      }),
    })

    const createBody = await createRes.json()
    if (!createRes.ok) return errorResponse(createBody?.msg || createBody?.error || `Auth xatolik: ${JSON.stringify(createBody)}`, 400)
    if (!createBody?.id) return errorResponse("User yaratilmadi", 500)

    const userId = createBody.id

    // 3. Update profile name
    await supabaseAdmin.from("profiles").update({ name: body.name }).eq("id", userId)

    // 4. Assign blogger role (trigger added 'company' role, add 'blogger' on top)
    const { data: roleData } = await supabaseAdmin.from("roles").select("id").eq("name", "blogger").single()
    if (roleData) {
      await supabaseAdmin.from("user_roles").insert({ profile_id: userId, role_id: roleData.id })
    }

    // 5. Insert blogger data
    await supabaseAdmin.from("bloggers").insert({
      id: userId,
      slug,
      experience_years: 0,
      rating: 0,
      is_featured: false,
      is_verified: true,
      created_by: auth.user.id,
    })

    if (body.region) {
      await supabaseAdmin.from("blogger_regions").insert({ blogger_id: userId, region: body.region, sort_order: 1 })
    }

    const niche = body.niche || "fermerlik"
    await supabaseAdmin.from("blogger_specializations").insert({ blogger_id: userId, specialization_key: niche, sort_order: 1 })

    return jsonResponse({
      success: true,
      blogger: {
        id: userId,
        slug,
        name: body.name,
        email: body.email,
      },
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
