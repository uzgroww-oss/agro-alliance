import { useState, useEffect } from "react"
import { api } from "./api"

export type PublicSettings = Record<string, string>

let cachedSettings: PublicSettings | null = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000

export async function getPublicSettings(): Promise<PublicSettings> {
  if (cachedSettings && Date.now() - cacheTime < CACHE_TTL) {
    return cachedSettings
  }
  try {
    const { settings } = await api<{ settings: PublicSettings }>("/public/settings")
    cachedSettings = settings
    cacheTime = Date.now()
    return settings
  } catch {
    return cachedSettings || {}
  }
}

export function usePublicSettings() {
  const [settings, setSettings] = useState<PublicSettings>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPublicSettings().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  return { settings, loading }
}
