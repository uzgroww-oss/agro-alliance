import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { isEmail } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * Mavjud blogerni tahrirlash.
 *
 * Bloger ma'lumoti bir nechta jadvalga tarqalgan:
 *   profiles                  -> name, email
 *   blogger_specializations   -> yo'nalish (cat)
 *   blogger_regions           -> hudud
 *
 * MUHIM: yo'nalish/hudud jadvallarida bloger o'z kabinetidan bir nechta
 * yozuv qo'shgan bo'lishi mumkin. Shuning uchun hammasini o'chirmaymiz —
 * faqat ASOSIY yozuvni (eng kichik sort_order) yangilaymiz.
 *
 * Holat (status) bu yerda o'zgarmaydi — buning uchun admin-bloggers-status bor.
 * Parol ham o'zgarmaydi.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "PATCH" && req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin", "admin")
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return errorResponse("id majburiy", 400)

    const body = await req.json().catch(() => ({}))
    const { name, email, cat, region } = body as {
      name?: string
      email?: string
      cat?: string
      region?: string
    }

    // Bloger mavjudligini tekshiramiz
    const { data: current, error: findErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .eq("id", id)
      .maybeSingle()
    if (findErr) throw new Error(findErr.message)
    if (!current) return errorResponse("Bloger topilmadi", 404)

    // --- profiles: name / email ---
    const profilePatch: Record<string, unknown> = {}

    if (typeof name === "string") {
      const trimmed = name.trim()
      if (!trimmed) return errorResponse("Ism bo'sh bo'lmasligi kerak", 400)
      if (trimmed.length > 120) return errorResponse("Ism juda uzun", 400)
      profilePatch.name = trimmed
    }

    const newEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined
    if (newEmail !== undefined && newEmail !== (current.email || "").toLowerCase()) {
      if (!isEmail(newEmail)) return errorResponse("Email format noto'g'ri", 400)
      // Boshqa foydalanuvchida shu email yo'qligini tekshiramiz
      const { data: dup } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", newEmail)
        .neq("id", id)
        .maybeSingle()
      if (dup) return errorResponse(`"${newEmail}" allaqachon boshqa hisobga biriktirilgan.`, 409)

      // Email = LOGIN, shuning uchun auth foydalanuvchisida ham yangilanadi.
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
        email: newEmail,
        email_confirm: true,
      })
      if (authErr) return errorResponse(`Loginni o'zgartirib bo'lmadi: ${authErr.message}`, 400)
      profilePatch.email = newEmail
    }

    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(profilePatch).eq("id", id)
      if (error) throw new Error(error.message)
    }

    // --- yo'nalish (specialization) ---
    if (typeof cat === "string" && cat.trim()) {
      const value = cat.trim()
      const { data: rows } = await supabaseAdmin
        .from("blogger_specializations")
        .select("id, specialization_key")
        .eq("blogger_id", id)
        .order("sort_order", { ascending: true })

      const already = (rows || []).some((r) => r.specialization_key === value)
      if (!already) {
        if (rows && rows.length > 0) {
          const { error } = await supabaseAdmin
            .from("blogger_specializations")
            .update({ specialization_key: value })
            .eq("id", rows[0].id)
          if (error) throw new Error(error.message)
        } else {
          const { error } = await supabaseAdmin
            .from("blogger_specializations")
            .insert({ blogger_id: id, specialization_key: value, sort_order: 1 })
          if (error) throw new Error(error.message)
        }
      }
    }

    // --- hudud (region) ---
    if (typeof region === "string") {
      const value = region.trim()
      const { data: rows } = await supabaseAdmin
        .from("blogger_regions")
        .select("id, region")
        .eq("blogger_id", id)
        .order("sort_order", { ascending: true })

      if (!value) {
        // Bo'sh qiymat = asosiy hududni tozalash
        if (rows && rows.length > 0) {
          await supabaseAdmin.from("blogger_regions").delete().eq("id", rows[0].id)
        }
      } else {
        const already = (rows || []).some((r) => r.region === value)
        if (!already) {
          if (rows && rows.length > 0) {
            const { error } = await supabaseAdmin
              .from("blogger_regions")
              .update({ region: value })
              .eq("id", rows[0].id)
            if (error) throw new Error(error.message)
          } else {
            const { error } = await supabaseAdmin
              .from("blogger_regions")
              .insert({ blogger_id: id, region: value, sort_order: 1 })
            if (error) throw new Error(error.message)
          }
        }
      }
    }

    return jsonResponse({ success: true })
  } catch (err) {
    const msg = (err && typeof err === "object" && "message" in err) ? String((err as { message: unknown }).message) : String(err)
    return errorResponse(msg || "Xatolik yuz berdi", 500)
  }
})
