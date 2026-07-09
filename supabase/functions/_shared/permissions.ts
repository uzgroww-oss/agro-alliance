import type { AuthUser } from "./auth.ts"

export type Permission =
  | "auth.login"
  | "auth.read"
  | "profiles.read"
  | "profiles.update"
  | "profiles.manage"
  | "profiles.roles"
  | "bloggers.read"
  | "bloggers.create"
  | "bloggers.update"
  | "bloggers.delete"
  | "bloggers.status"
  | "partners.read"
  | "partners.create"
  | "partners.update"
  | "partners.delete"
  | "partners.tasks"
  | "partners.clients"
  | "news.read"
  | "news.create"
  | "news.update"
  | "news.delete"
  | "news.publish"
  | "news.archive"
  | "stats.read"
  | "stats.update"
  | "socials.create"
  | "socials.delete"
  | "videos.create"
  | "videos.delete"
  | "contact.create"
  | "newsletter.subscribe"
  | "newsletter.unsubscribe"
  | "media.upload"
  | "media.delete"
  | "media.process"
  | "storage.buckets"
  | "storage.files"
  | "settings.read"
  | "settings.update"
  | "settings.manage"
  | "feature-flags.read"
  | "feature-flags.manage"
  | "users.manage"
  | "roles.manage"
  | "permissions.manage"
  | "audit.read"
  | "system.config"
  | "system.backup"
  | "system.health"
  | "ai.trigger"
  | "ai.manage"
  | "ai.config"
  | "workers.restart"
  | "workers.logs"
  | "queue.view"
  | "queue.retry"
  | "queue.purge"
  | "queue.manage"
  | "monitoring.view"
  | "monitoring.alerts"
  | "analytics.read"
  | "analytics.export"
  | "social.publish"
  | "social.manage"
  | "cron.manage"
  | "cron.logs"
  | "functions.deploy"
  | "functions.logs"
  | "deployment.manage"
  | "deployment.rollback"
  | "notifications.manage"
  | "notifications.send"

type RoleName = "super_admin" | "admin" | "editor" | "blogger" | "company" | "user"

const rolePermissions: Record<RoleName, Permission[]> = {
  super_admin: [
    "auth.login", "auth.read",
    "profiles.read", "profiles.update", "profiles.manage", "profiles.roles",
    "bloggers.read", "bloggers.create", "bloggers.update", "bloggers.delete", "bloggers.status",
    "partners.read", "partners.create", "partners.update", "partners.delete", "partners.tasks", "partners.clients",
    "news.read", "news.create", "news.update", "news.delete", "news.publish", "news.archive",
    "stats.read", "stats.update",
    "socials.create", "socials.delete",
    "videos.create", "videos.delete",
    "contact.create", "newsletter.subscribe", "newsletter.unsubscribe",
    "media.upload", "media.delete", "media.process",
    "storage.buckets", "storage.files",
    "settings.read", "settings.update", "settings.manage",
    "feature-flags.read", "feature-flags.manage",
    "users.manage", "roles.manage", "permissions.manage",
    "audit.read", "system.config", "system.backup", "system.health",
    "ai.trigger", "ai.manage", "ai.config",
    "workers.restart", "workers.logs",
    "queue.view", "queue.retry", "queue.purge", "queue.manage",
    "monitoring.view", "monitoring.alerts",
    "analytics.read", "analytics.export",
    "social.publish", "social.manage",
    "cron.manage", "cron.logs",
    "functions.deploy", "functions.logs",
    "deployment.manage", "deployment.rollback",
    "notifications.manage", "notifications.send",
  ],
  admin: [
    "auth.login", "auth.read",
    "profiles.read", "profiles.update", "profiles.manage",
    "bloggers.read", "bloggers.create", "bloggers.update", "bloggers.delete", "bloggers.status",
    "partners.read", "partners.create", "partners.update", "partners.delete", "partners.tasks", "partners.clients",
    "news.read", "news.create", "news.update", "news.delete", "news.publish", "news.archive",
    "stats.read", "stats.update",
    "socials.create", "socials.delete",
    "videos.create", "videos.delete",
    "contact.create", "newsletter.subscribe", "newsletter.unsubscribe",
    "media.upload", "media.delete", "media.process",
    "storage.buckets", "storage.files",
    "settings.read", "settings.update", "settings.manage",
    "feature-flags.read", "feature-flags.manage",
    "audit.read", "system.health",
    "workers.logs",
    "queue.view", "queue.retry",
    "monitoring.view", "monitoring.alerts",
    "analytics.read", "analytics.export",
    "social.publish", "social.manage",
    "cron.manage", "cron.logs",
    "functions.logs",
    "notifications.manage", "notifications.send",
  ],
  editor: [
    "auth.login", "auth.read",
    "profiles.read", "profiles.update",
    "bloggers.read", "bloggers.create", "bloggers.update",
    "news.read", "news.create", "news.update", "news.delete", "news.publish", "news.archive",
    "stats.read",
    "contact.create",
    "media.upload", "media.process",
    "analytics.read",
    "newsletter.subscribe",
    "settings.read",
    "feature-flags.read",
  ],
  blogger: [
    "auth.login", "auth.read",
    "profiles.read", "profiles.update",
    "bloggers.read",
    "news.read",
    "stats.read",
    "analytics.read",
    "socials.create", "socials.delete",
    "videos.create", "videos.delete",
    "contact.create",
    "media.upload",
    "newsletter.subscribe",
    "settings.read",
    "feature-flags.read",
  ],
  company: [
    "auth.login", "auth.read",
    "profiles.read",
    "partners.read", "partners.tasks",
    "news.read", "bloggers.read",
    "stats.read",
    "contact.create",
    "newsletter.subscribe",
  ],
  user: [
    "auth.login", "auth.read",
    "profiles.read",
    "news.read", "bloggers.read",
    "stats.read",
    "contact.create",
    "newsletter.subscribe",
  ],
}

export function hasPermission(user: AuthUser, permission: Permission): boolean {
  const permissions = rolePermissions[user.role as RoleName]
  return permissions?.includes(permission) ?? false
}

export function requirePermission(user: AuthUser, permission: Permission): void {
  if (!hasPermission(user, permission)) {
    throw new Error("Insufficient permissions")
  }
}

export function getPermissionsForRole(role: string): Permission[] {
  return rolePermissions[role as RoleName] ?? []
}
