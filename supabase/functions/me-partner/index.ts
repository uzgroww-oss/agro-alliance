import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await verifyAuth(req)
  if (auth.response) return auth.response

  // company yoki user role bo'lsa — ruxsat beriladi
  if (auth.user.role !== "company" && auth.user.role !== "user") {
    return errorResponse("Ruxsat yo'q", 403, "FORBIDDEN")
  }

  try {
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id, name, sphere, contract_no, contract_amount, signed_date, status")
      .eq("client_profile_id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!partner) {
      return jsonResponse({ partner: null })
    }

    const { data: tasks } = await supabaseAdmin
      .from("partner_tasks")
      .select("id, title, status")
      .eq("partner_id", partner.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    return jsonResponse({
      partner: {
        id: partner.id,
        name: partner.name,
        sphere: partner.sphere || "",
        contractNo: partner.contract_no || "",
        amount: partner.contract_amount || 0,
        signedDate: partner.signed_date || "",
        status: partner.status,
        tasks: (tasks || []).map((t: { id: string; title: string; status: string }) => ({
          id: t.id,
          title: t.title,
          status: t.status,
        })),
      },
    })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
