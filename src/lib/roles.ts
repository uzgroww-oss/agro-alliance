import { feRole, isDbRole } from "./role-map"

export function roleHome(role?: string): string {
  if (!role) return "/dashboard"
  const fe = isDbRole(role) ? feRole(role) : role
  if (fe === "superadmin") return "/admin"
  if (fe === "partner") return "/hamkor"
  return "/dashboard"
}
