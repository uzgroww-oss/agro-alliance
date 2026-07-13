import type { User } from "./api"
import { feRole } from "./role-map"

export interface DbProfile {
  id: string
  email: string
  name: string
  avatar: string | null
  phone: string | null
  language: string | null
  timezone: string | null
  bio: string | null
  status: "active" | "inactive" | "pending" | "banned"
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface DbUserRole {
  id: string
  profile_id: string
  role_id: string
  created_at: string
}

export interface DbRole {
  id: string
  name: string
  description: string | null
  is_system: boolean
  priority: number
  created_at: string
  updated_at: string
}

export interface DbSocialAccount {
  id: string
  profile_id: string
  platform: string
  link: string
  name: string | null
  avatar: string | null
  subscribers: string | null
  connected: boolean
  created_at: string
}

export interface DbVideo {
  id: string
  profile_id: string
  name: string
  link: string
  views: string
  thumbnail: string | null
  platforms: string[]
  date: string
  duration: string | null
  created_at: string
}

export function dbProfileToUser(profile: DbProfile, roleName: string): User {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: feRole(roleName) as User["role"],
    adminRole: roleName,
    partnerId: null,
    status: profile.status,
    profile: profile.metadata as Record<string, string> | undefined,
    socials: [],
    videos: [],
  }
}
