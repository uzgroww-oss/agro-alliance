const FE_TO_DB: Record<string, string> = {
  superadmin: "super_admin",
  blogger: "blogger",
  client: "company",
}

const DB_TO_FE: Record<string, string> = {
  super_admin: "superadmin",
  admin: "superadmin",
  editor: "superadmin",
  blogger: "blogger",
  company: "client",
}

export function feRole(dbRole: string): string {
  return DB_TO_FE[dbRole] ?? "client"
}

export function dbRole(feRole: string): string {
  return FE_TO_DB[feRole] ?? "company"
}

export function isDbRole(role: string): role is "super_admin" | "admin" | "editor" | "blogger" | "company" {
  return ["super_admin", "admin", "editor", "blogger", "company"].includes(role)
}

export function isFeRole(role: string): role is "superadmin" | "blogger" | "client" {
  return ["superadmin", "blogger", "client"].includes(role)
}
