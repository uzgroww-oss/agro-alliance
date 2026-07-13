import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { validate, required, isEmail, minLength } from "../_shared/validation.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { slugify } from "../_shared/helpers.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  const auth = await requireRole(req, "super_admin", "admin")
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const errors = validate(body, { name: [required] })
    if (errors.length > 0) return errorResponse(errors[0], 400)

    const { name, sphere, contractNo, amount, status, logo, clientName, clientEmail, clientPassword } = body as {
      name: string
      sphere?: string
      contractNo?: string
      amount?: number
      status?: string
      logo?: string
      clientName?: string
      clientEmail?: string
      clientPassword?: string
    }

    // Parol tekshiruvi (mijoz yaratilsa)
    if (clientEmail && clientPassword && clientPassword.length < 6) {
      return errorResponse("Parol kamida 6 belgidan iborat bo'lishi kerak", 400)
    }

    // Takroriy nom tekshiruvi (o'chirilmagan hamkorlar orasida)
    const { data: existingPartner } = await supabaseAdmin
      .from("partners")
      .select("id")
      .eq("name", name)
      .is("deleted_at", null)
      .maybeSingle()
    if (existingPartner) {
      return errorResponse(`"${name}" nomli hamkor allaqachon mavjud. Boshqa nom tanlang.`, 409)
    }

    // Takroriy email tekshiruvi (mijoz yaratilsa)
    if (clientEmail && clientPassword) {
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", clientEmail)
        .maybeSingle()
      if (existingProfile) {
        return errorResponse(`"${clientEmail}" allaqachon ro'yxatdan o'tgan. Boshqa email tanlang.`, 409)
      }
    }

    // Slug — takrorlanmasligi uchun mavjud bo'lsa suffiks qo'shamiz
    let slug = slugify(name)
    const { data: slugMatch } = await supabaseAdmin
      .from("partners").select("id").eq("slug", slug).is("deleted_at", null).maybeSingle()
    if (slugMatch) slug = `${slug}-${Date.now().toString(36).slice(-4)}`

    const { data: partner, error } = await supabaseAdmin
      .from("partners")
      .insert({
        name,
        slug,
        sphere: sphere || null,
        logo: logo || null,
        contract_no: contractNo || null,
        contract_amount: amount || null,
        signed_date: new Date().toISOString(),
        status: status || "active",
        created_by: auth.user.id,
      })
      .select("id, name, sphere, contract_no, contract_amount, signed_date, status")
      .single()

    if (error) throw new Error(error.message)

    let client = null

    if (clientEmail && clientPassword) {
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: clientEmail,
          password: clientPassword,
          email_confirm: true,
          user_metadata: { name: clientName || name },
        })
        if (authError) throw new Error(authError.message)

        const userId = authData.user.id

        const { data: roleData, error: roleError } = await supabaseAdmin
          .from("roles").select("id").eq("name", "company").single()
        if (roleError) throw new Error(roleError.message)

        // Rolni bog'lash (trigger allaqachon bergan bo'lishi mumkin → xatoni yutamiz)
        await supabaseAdmin.from("user_roles").upsert(
          { profile_id: userId, role_id: roleData.id },
          { onConflict: "profile_id,role_id", ignoreDuplicates: true },
        )

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({ name: clientName || name, email: clientEmail, status: "active" })
          .eq("id", userId)
        if (profileError) throw new Error(profileError.message)

        const { error: updateError } = await supabaseAdmin
          .from("partners").update({ client_profile_id: userId }).eq("id", partner.id)
        if (updateError) throw new Error(updateError.message)

        client = { id: userId, name: clientName || name, email: clientEmail }
      } catch (clientErr) {
        // Mijoz yaratish muvaffaqiyatsiz — hamkorni orqaga qaytaramiz (orphan qolmasin)
        await supabaseAdmin.from("partners").delete().eq("id", partner.id)
        const msg = clientErr instanceof Error ? clientErr.message : String(clientErr)
        return errorResponse(`Mijoz kabineti yaratilmadi: ${msg}`, 500)
      }
    }

    return jsonResponse({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        sphere: partner.sphere,
        contractNo: partner.contract_no,
        amount: partner.contract_amount,
        signedDate: partner.signed_date,
        status: partner.status,
      },
      client,
    })
  } catch (err) {
    const msg = (err && typeof err === "object" && "message" in err) ? String((err as { message: unknown }).message) : String(err)
    return errorResponse(msg || "Xatolik yuz berdi", 500)
  }
})
