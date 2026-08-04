import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

/**
 * Ko'rishlar soni matn sifatida saqlanadi va manbaga qarab har xil
 * ko'rinishda bo'ladi: "12500", "12.5K", "1,2M". Statistika uchun
 * ularni sonlarga keltiramiz — aks holda qo'shib bo'lmaydi.
 */
function sonGa(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  if (typeof v !== "string") return 0
  const s = v.trim().replace(/\s/g, "").replace(",", ".")
  const m = s.match(/^([\d.]+)\s*([KkMmBb])?$/)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return 0
  const kat = (m[2] || "").toLowerCase()
  return Math.round(n * (kat === "k" ? 1_000 : kat === "m" ? 1_000_000 : kat === "b" ? 1_000_000_000 : 1))
}

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

    /**
     * SHU KOMPANIYAGA BELGILANGAN BLOGER VIDEOLARI + STATISTIKA.
     *
     * Videolar `profiles.metadata.videos` massivida saqlanadi (alohida
     * jadval emas), shuning uchun ularni SQL bilan filtrlab bo'lmaydi —
     * blogerlar o'qib olinadi va bu yerda saralanadi. Blogerlar soni
     * yuzlab, shuning uchun bu arzon.
     *
     * ALOHIDA `action` sifatida: hamkor kabineti ochilganda har safar
     * hamma blogerni o'qish shart emas, faqat "Videolar" bo'limida.
     */
    if (new URL(req.url).searchParams.get("action") === "videos") {
      // `slug` profiles'da emas, bloggers'da — havola uchun kerak
      const [{ data: profiles }, { data: bloggers }] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, name, avatar, metadata").is("deleted_at", null).limit(1000),
        supabaseAdmin.from("bloggers").select("id, slug").is("deleted_at", null).limit(1000),
      ])
      const slugMap = new Map<string, string>()
      for (const b of (bloggers || []) as { id: string; slug: string | null }[]) {
        if (b.slug) slugMap.set(b.id, b.slug)
      }

      const videolar: Record<string, unknown>[] = []
      for (const p of (profiles || []) as Record<string, unknown>[]) {
        const meta = (p.metadata as Record<string, unknown>) || {}
        for (const v of ((meta.videos as Record<string, unknown>[]) || [])) {
          if (v.partner_id !== partner.id) continue
          videolar.push({
            id: v.id,
            name: v.name,
            link: v.link,
            views: v.views ?? "0",
            likes: v.likes ?? "0",
            comments: v.comments ?? "0",
            plats: v.plats || [],
            date: v.date || "",
            thumbnail: v.thumbnail || null,
            blogger: { id: p.id, name: p.name, slug: slugMap.get(p.id as string) || null, avatar: p.avatar || null },
          })
        }
      }

      // Yangi videolar tepada
      videolar.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))

      const jamiKorish = videolar.reduce((s, v) => s + sonGa(v.views), 0)
      const jamiYoqtirish = videolar.reduce((s, v) => s + sonGa(v.likes), 0)
      const jamiIzoh = videolar.reduce((s, v) => s + sonGa(v.comments), 0)
      const platformalar: Record<string, number> = {}
      for (const v of videolar) {
        for (const pl of (v.plats as string[])) platformalar[pl] = (platformalar[pl] || 0) + 1
      }

      return jsonResponse({
        videos: videolar,
        stats: {
          total: videolar.length,
          views: jamiKorish,
          likes: jamiYoqtirish,
          comments: jamiIzoh,
          bloggers: new Set(videolar.map((v) => (v.blogger as { id: string }).id)).size,
          platforms: platformalar,
          lastDate: videolar[0]?.date || "",
        },
      })
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
