import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { validate, required, isEmail, minLength } from "../_shared/validation.ts"

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
    const auth = await requireRole(req, "super_admin")
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

    const { data, error } = await supabaseAdmin.rpc("seed_new_blogger", {
      p_email: body.email,
      p_name: body.name,
      p_password: body.password,
      p_slug: slug,
      p_region: body.region || "",
      p_spec_key: body.niche || "fermerlik",
      p_rating: 0,
      p_featured: false,
      p_exp_years: 0,
      p_bio: body.name,
      p_services: [],
      p_achievements: null,
    })

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({
      success: true,
      blogger: {
        id: (data as Record<string, unknown> | null)?.id || "",
        slug: (data as Record<string, unknown> | null)?.slug || slug,
        name: body.name,
        email: body.email,
      },
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
