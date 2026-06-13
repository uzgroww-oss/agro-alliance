import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { api, getToken, setToken, clearToken, type User } from "./api"

type AuthCtx = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null as any)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = getToken()
    if (!t) {
      setLoading(false)
      return
    }
    api<{ user: User }>("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const d = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    setToken(d.token)
    setUser(d.user)
    return d.user
  }

  const logout = () => {
    clearToken()
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
