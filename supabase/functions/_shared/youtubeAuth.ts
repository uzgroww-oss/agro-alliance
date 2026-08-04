import { supabaseAdmin } from "./supabase.ts"

/**
 * YOUTUBE OAUTH TOKENLARI.
 *
 * Kanal STATISTIKASINI o'qish uchun API kaliti yetarli edi. Lekin
 * video yuklash, o'zgartirish, o'chirish va muqova qo'yish — bularning
 * hammasi kanal EGASI nomidan bajariladi, ya'ni OAuth shart.
 *
 * Token `smm_connections` jadvalida, platform = "youtube" qatorida
 * saqlanadi — kanal ID bilan bir joyda.
 *
 * MUHIM: `access_token` bir soatda eskiradi. `refresh_token` esa
 * doimiy va faqat BIRINCHI rozilikda beriladi (shuning uchun rozilik
 * so'ralganda `access_type=offline&prompt=consent` majburiy). Eskirgan
 * tokenni bu yerdagi funksiya o'zi yangilaydi — chaqiruvchi kod bu
 * haqda o'ylamaydi.
 */

export const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || ""
export const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || ""

export type YoutubeConfig = {
  channel_id?: string
  access_token?: string
  refresh_token?: string
  /** millisekundlarda, absolyut vaqt */
  expires_at?: number
}

export async function ulanishOl(): Promise<YoutubeConfig | null> {
  const { data } = await supabaseAdmin
    .from("smm_connections")
    .select("config")
    .eq("platform", "youtube")
    .maybeSingle()
  return (data?.config as YoutubeConfig) || null
}

export async function ulanishSaqla(yangi: YoutubeConfig, userId?: string): Promise<void> {
  const eski = (await ulanishOl()) || {}
  await supabaseAdmin.from("smm_connections").upsert({
    platform: "youtube",
    config: { ...eski, ...yangi },
    ...(userId ? { connected_by: userId } : {}),
    updated_at: new Date().toISOString(),
  }, { onConflict: "platform" })
}

/**
 * Ishlamaydigan tokenlarni o'chiradi, kanal ID sini qoldiradi.
 * `ulanishSaqla` birlashtirib yozadi, shuning uchun bu yerda
 * konfiguratsiya QAYTA yoziladi — aks holda eski kalitlar qolib
 * ketardi.
 */
async function tokenlarniTozala(): Promise<void> {
  const eski = (await ulanishOl()) || {}
  await supabaseAdmin.from("smm_connections").upsert({
    platform: "youtube",
    config: eski.channel_id ? { channel_id: eski.channel_id } : {},
    updated_at: new Date().toISOString(),
  }, { onConflict: "platform" })
}

/**
 * Ishlaydigan access token qaytaradi. Eskirgan bo'lsa yangilaydi.
 * OAuth qilinmagan bo'lsa `null` — chaqiruvchi buni "avval ulang"
 * degan aniq xabarga aylantiradi.
 */
export async function tokenOl(): Promise<string | null> {
  const cfg = await ulanishOl()
  if (!cfg?.refresh_token && !cfg?.access_token) return null

  // 2 daqiqa zaxira: so'rov ketayotganda eskirib qolmasin
  const hali = cfg.expires_at && cfg.expires_at - Date.now() > 120_000
  if (hali && cfg.access_token) return cfg.access_token
  if (!cfg.refresh_token) return cfg.access_token || null

  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: cfg.refresh_token,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const d = await r.json()
    if (!r.ok || !d.access_token) {
      console.error("youtube token yangilash:", d.error_description || d.error || r.status)
      /**
       * `invalid_grant` — refresh token endi ishlamaydi: bekor
       * qilingan, parol o'zgargan yoki (eng ko'p uchraydigani) ilova
       * Google'da HALI TEST rejimida va tokenning 7 kunlik muddati
       * tugagan.
       *
       * Bunday tokenni saqlab qo'yish zararli: panel "Ulangan" deb
       * ko'rsatib turadi, lekin har bir amal 401 bilan yiqiladi va
       * sababi ko'rinmaydi. Tozalab qo'yamiz — kartochka halol
       * "Ulanmagan" bo'ladi va qayta ulash kerakligi darrov bilinadi.
       */
      if (String(d.error || "") === "invalid_grant") await tokenlarniTozala()
      return null
    }
    await ulanishSaqla({
      access_token: d.access_token,
      expires_at: Date.now() + Number(d.expires_in || 3600) * 1000,
    })
    return d.access_token as string
  } catch (e) {
    console.error("youtube token yangilash:", e instanceof Error ? e.message : e)
    return null
  }
}

/** YouTube Data API ga token bilan so'rov */
export async function ytFetch(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; xato: string }> {
  const token = await tokenOl()
  if (!token) {
    return { ok: false, status: 401, data: {}, xato: "YouTube ulanmagan — avval kanalni ulang" }
  }
  const r = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(20_000),
  })
  // DELETE muvaffaqiyatda bo'sh javob qaytaradi
  const matn = await r.text()
  let data: Record<string, unknown> = {}
  try { data = matn ? JSON.parse(matn) : {} } catch { /* JSON emas */ }
  const xato = r.ok
    ? ""
    : String(
      (data as { error?: { message?: string; errors?: { reason?: string }[] } }).error?.message ||
      `YouTube xatosi (${r.status})`,
    )
  return { ok: r.ok, status: r.status, data, xato }
}
