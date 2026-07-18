import { useState, useEffect } from "react"
import { api } from "./api"
import { useHomeSections } from "./sections"

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

type FooterItem = { item_key?: string; description?: string }

/**
 * Aloqa ma'lumotlari uchun YAGONA manba — footer ham, /aloqa sahifasi ham
 * shu hookdan oladi.
 *
 * Ilgari ikkalasi boshqacha o'qirdi: footer avval "footer" bo'limi
 * elementlarini, keyin Sozlamalarni tekshirardi; /aloqa esa faqat
 * Sozlamalarni. Shu sababli footerni tahrirlaganda /aloqa o'zgarmay qolardi.
 *
 * Ustuvorlik: "footer" bo'limi elementi -> Sozlamalar -> yo'q (chizilmaydi).
 */
export function useContactInfo() {
  const { settings, loading: sLoading } = usePublicSettings()
  const { sections, loading: secLoading } = useHomeSections()

  const footer = sections.find((s) => s.section_key === "footer")
  const fItem = (k: string) =>
    (footer?.items as FooterItem[] | undefined)?.find((i) => i.item_key === k)?.description

  return {
    phone: fItem("phone") || settings.contact_phone,
    email: fItem("email") || settings.contact_email,
    address: fItem("address") || settings.contact_address,
    // Ish vaqti footerda ko'rsatilmaydi, faqat Sozlamalarda bor.
    hours: settings.working_hours,
    loading: sLoading || secLoading,
  }
}
