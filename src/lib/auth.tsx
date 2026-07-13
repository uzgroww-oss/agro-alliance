import { createContext, useContext, useEffect, useState, type ReactNode, useRef, useCallback } from "react"
import { supabase } from "./supabase"
import { getToken, setToken, clearToken, api, type User } from "./api"
import { dbProfileToUser, type DbProfile } from "./db-types"

type AuthCtx = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  setLoading: (v: boolean) => void
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)

async function fetchProfile(userId: string): Promise<User | null> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (!profile) return null

    const { data: roleName } = await supabase.rpc("auth_role")

    return dbProfileToUser(profile as DbProfile, roleName ?? "user")
  } catch {
    return null
  }
}

/** Resolve user from localStorage token (edge function login path) */
async function fetchUserByToken(): Promise<User | null> {
  try {
    const { me } = await api<{ me: User }>("/me")
    return me || null
  } catch {
    return null
  }
}

/** Shared handler for session change from either Supabase or edge function */
async function resolveSession(
  session: import("@supabase/supabase-js").Session | null,
): Promise<User | null> {
  if (session?.access_token && session.user) {
    setToken(session.access_token)
    const profile = await fetchProfile(session.user.id)
    if (profile) return profile
    // fallback to edge function /me if Supabase profile is not ready
    return fetchUserByToken()
  }
  clearToken()
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled.current) return
        const resolved = await resolveSession(session)
        if (cancelled.current) return
        setUser(resolved)
        setLoading(false)
      },
    )

    // On mount, try to recover existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled.current) return

      if (session) {
        const resolved = await resolveSession(session)
        if (!cancelled.current) {
          setUser(resolved)
          setLoading(false)
          return
        }
      }

      // No active Supabase session — check for edge function token
      const token = getToken()
      if (token) {
        const u = await fetchUserByToken()
        if (!cancelled.current) {
          setUser(u)
          setLoading(false)
          return
        }
      }

      if (!cancelled.current) {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      cancelled.current = true
      subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const profile = await fetchProfile(data.user.id)
    if (!profile) throw new Error("Profil topilmadi")

    return profile
  }, [])

  const logout = useCallback(() => {
    supabase.auth.signOut()
    clearToken()
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, loading, login, logout, setLoading }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(Ctx)
