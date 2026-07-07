// Rolega qarab dashboard manzili
export const roleHome = (role?: string) =>
  role === "superadmin" ? "/admin" : role === "client" ? "/mijoz" : "/dashboard"
