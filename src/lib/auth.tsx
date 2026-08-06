import { createContext, useContext, useEffect, useState, type ReactNode, useRef, useCallback } from "react"
import { tr } from "./i18n"
import { getSupabase, supabaseSessiyasiBormi, urldaTokenBormi } from "./supabase"
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
    // TEZLIK: bu ikki so'rov ilgari ketma-ket edi — bir-birini kutishi
    // shart emas. Ustiga select("*") butun qatorni tortardi; endi faqat
    // dbProfileToUser ishlatadigan ustunlar.
    const sb = await getSupabase()
    const [{ data: profile }, { data: roleName }] = await Promise.all([
      sb
        .from("profiles")
        .select("id, email, name, avatar, phone, bio, status, metadata")
        .eq("id", userId)
        .single(),
      sb.rpc("auth_role"),
    ])

    if (!profile) return null

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
  // TEZLIK: onAuthStateChange (INITIAL_SESSION) va getSession() ikkalasi
  // ham mount paytida ishga tushib, AYNAN BIR XIL sessiya uchun profil +
  // auth_role so'rovlarini IKKI MARTA yuborardi. Bu ref allaqachon hal
  // qilingan tokenni eslab qoladi va takrorini o'tkazib yuboradi.
  const resolvedToken = useRef<string | null>(null)

  useEffect(() => {
    cancelled.current = false
    let obunaniYop = () => {}

    /**
     * SUPABASE KUTUBXONASINI YUKLASH KERAKMI?
     *
     * Saytga birinchi marta kirgan, hisobi yo'q odam uchun u umuman
     * kerak emas — lekin ilgari HAR DOIM yuklanardi va bu bosh
     * sahifaga bekorga 51 KB qo'shardi.
     *
     * Tekshiruv kutubxonasiz bajariladi: sessiya `localStorage` da
     * turadi, OAuth va parol tiklash tokenlari esa manzil ichida.
     */
    const kerak = supabaseSessiyasiBormi() || urldaTokenBormi()

    if (!kerak) {
      /**
       * Supabase sessiyasi yo'q. Lekin bizning O'Z tokenimiz
       * (edge-funksiya orqali kirish) bo'lishi mumkin — u Supabase
       * kutubxonasisiz ham ishlaydi.
       */
      const token = getToken()
      if (token) {
        fetchUserByToken().then((u) => {
          if (cancelled.current) return
          setUser(u)
          setLoading(false)
        })
      } else {
        setUser(null)
        setLoading(false)
      }
      return () => { cancelled.current = true }
    }

    getSupabase().then((sb) => {
      if (cancelled.current) return

      const { data: { subscription } } = sb.auth.onAuthStateChange(
        async (_event, session) => {
          if (cancelled.current) return
          const tok = session?.access_token ?? null
          if (tok && tok === resolvedToken.current) return // shu token allaqachon hal qilingan
          resolvedToken.current = tok
          const resolved = await resolveSession(session)
          if (cancelled.current) return
          setUser(resolved)
          setLoading(false)
        },
      )
      obunaniYop = () => subscription.unsubscribe()

      // On mount, try to recover existing session
      sb.auth.getSession().then(async ({ data: { session } }) => {
        if (cancelled.current) return

        if (session) {
          if (session.access_token === resolvedToken.current) return // listener ulgurgan
          resolvedToken.current = session.access_token
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
    }).catch(() => {
      /**
       * Kutubxona yuklanmasa (tarmoq uzilgan) sayt QOTIB QOLMASLIGI
       * kerak: foydalanuvchi tizimga kirmagandek ko'rinadi, ommaviy
       * sahifalar esa ishlayveradi.
       */
      if (cancelled.current) return
      setUser(null)
      setLoading(false)
    })

    return () => {
      cancelled.current = true
      obunaniYop()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    // Kirish paytida kutubxona baribir kerak — shu yerda yuklanadi
    const sb = await getSupabase()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error

    /**
     * TEZLIK: profil ILGARI IKKI MARTA yuklanardi.
     * signInWithPassword `onAuthStateChange` ni uyg'otadi va u
     * resolveSession -> fetchProfile ni chaqiradi; shu bilan birga
     * login o'zi ham fetchProfile qilardi. Har biri 2 ta so'rov
     * (profiles + auth_role), ya'ni jami 4 ta borish-kelish.
     *
     * Endi login tokenni O'ZI belgilaydi va `resolvedToken` ga yozib
     * qo'yadi — listener uni ko'rib takrorlamaydi. Profil bir marta
     * yuklanadi va holat shu yerda o'rnatiladi.
     */
    const tok = data.session?.access_token
    if (tok) {
      setToken(tok)
      resolvedToken.current = tok
    }

    const profile = await fetchProfile(data.user.id)
    if (!profile) throw new Error(tr("Profil topilmadi"))

    setUser(profile)
    setLoading(false)
    return profile
  }, [])

  const logout = useCallback(() => {
    /**
     * Supabase sessiyasi BO'LSAGINA kutubxonani yuklaymiz. Faqat
     * edge-funksiya tokeni bilan kirgan foydalanuvchi uchun uni
     * yuklash bekorga 51 KB bo'lardi.
     *
     * Javob KUTILMAYDI: chiqish darhol ko'rinishi kerak, serverdagi
     * sessiyani yopish esa fonda ketaveradi.
     */
    if (supabaseSessiyasiBormi()) {
      getSupabase().then((sb) => sb.auth.signOut()).catch(() => {})
    }
    clearToken()
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, loading, login, logout, setLoading }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
/**
 * MUHIM: kontekst standart qiymati `null` edi. Provayder yetib bormagan
 * har qanday holatda (masalan dev'da HMR paytida modul qayta yuklanib
 * yangi kontekst yaratilsa) `const { user } = useAuth()` darhol
 * "Cannot destructure property 'user' of null" bilan qulab, BUTUN
 * sahifani ErrorBoundary'ga tashlardi. Endi xavfsiz standart qaytadi —
 * eng yomon holatda foydalanuvchi tizimga kirmagandek ko'rinadi,
 * lekin sayt ishlashda davom etadi.
 */
const FALLBACK: AuthCtx = {
  user: null,
  loading: false,
  login: () => Promise.reject(new Error(tr("AuthProvider topilmadi"))),
  logout: () => {},
  setLoading: () => {},
}

export const useAuth = (): AuthCtx => useContext(Ctx) ?? FALLBACK
