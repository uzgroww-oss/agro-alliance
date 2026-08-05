import { handleCors } from "../cors.ts"
import { requireRole } from "../auth.ts"
import { jsonResponse, errorResponse } from "../response.ts"
import { supabaseAdmin } from "../supabase.ts"

export async function run(req: Request): Promise<Response> {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405)
  }

  try {
    const auth = await requireRole(req, "super_admin", "admin")
    if (auth.response) return auth.response

    // Find all auth users with soft-deleted profiles
    const { data: users, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .not("deleted_at", "is", null)

    if (fetchError) return errorResponse(fetchError.message, 500)

    let deletedCount = 0
    let failedEmails: string[] = []

    for (const profile of users || []) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.id)
      if (deleteError) {
        failedEmails.push(`${profile.email} (${deleteError.message})`)
      } else {
        deletedCount++
      }
    }

    return jsonResponse({
      success: true,
      deleted_count: deletedCount,
      failed: failedEmails,
    })
  } catch (err) {
    return errorResponse((err as Error).message, 500)
  }
}
