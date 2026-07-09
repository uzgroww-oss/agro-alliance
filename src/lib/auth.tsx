import { createContext, useContext, useEffect, useState, type ReactNode, useRef } from "react"
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

const Ctx = createContext<AuthCtx>(null as any)

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

/** Edge function orqali token bo'lsa foydalanuvchi ma'lumotlarini olish */
async function fetchUserByToken(): Promise<User | null> {
  try {
    const { me } = await api<{ me: User }>("/me")
    return me || null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false

    // 1. Avval localStorage'dagi token'ni tekshirish (edge function login uchun)
    const existingToken = getToken()
    if (existingToken) {
      fetchUserByToken().then((u) => {
        if (!cancelled.current) {
          setUser(u)
          setLoading(false)
        }
      }).catch(() => {
        if (!cancelled.current) {
          clearToken()
          setUser(null)
          setLoading(false)
        }
      })
      // Supabase auth state'ni ham tinglash
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event: string, session: import("@supabase/supabase-js").Session | null) => {
          if (cancelled.current) return
          if (session?.access_token) {
            setToken(session.access_token)
            if (session.user) {
              const p = await fetchProfile(session.user.id)
              if (!cancelled.current) setUser(p)
            }
          }
        }
      )
      return () => { cancelled.current = true; subscription.unsubscribe() }
    }

    // 2. Token yo'q — Supabase auth state'ni tinglash
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: string, session: import("@supabase/supabase-js").Session | null) => {
        if (cancelled.current) return

        if (session?.access_token) {
          setToken(session.access_token)
          if (session.user) {
            const p = await fetchProfile(session.user.id)
            if (!cancelled.current) setUser(p)
          }
        } else {
          clearToken()
          if (!cancelled.current) setUser(null)
        }

        if (!cancelled.current) setLoading(false)
      }
    )

    return () => {
      cancelled.current = true
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const profile = await fetchProfile(data.user.id)
    if (!profile) throw new Error("Profil topilmadi")

    return profile
  }

  const logout = () => {
    supabase.auth.signOut()
    clearToken()
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, logout, setLoading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
