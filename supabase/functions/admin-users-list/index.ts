import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const auth = await requireRole(req, "super_admin")
  if (auth.response) return auth.response

  try {
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select(`
        id, email, name, avatar, status, created_at,
        user_roles(role:roles(name, priority))
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (error) throw error

    const users = (profiles || []).map((p: Record<string, unknown>) => {
      const userRoles = (p.user_roles as Array<Record<string, unknown>>) || []
      const sorted = userRoles
        .map((ur) => (ur.role as Record<string, unknown>))
        .sort((a, b) => ((b.priority ?? 0) as number) - ((a.priority ?? 0) as number))
      const role = (sorted[0]?.name as string) || "user"

      return {
        id: p.id as string,
        email: p.email as string,
        name: p.name as string,
        avatar: (p.avatar as string) || null,
        status: p.status as string,
        role,
        created_at: p.created_at as string,
      }
    })

    return jsonResponse({ users })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
})
