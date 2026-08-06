import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * SUPABASE MIJOZI — TALAB BO'YICHA YUKLANADI.
 *
 * MUAMMO EDI: `@supabase/supabase-js` (siqilgan holda ~51 KB) HAR
 * sahifada, jumladan bosh sahifada ham yuklanardi. PageSpeed uni
 * "ishlatilmayotgan JavaScript" deb ko'rsatgan: 43 KB bekorga.
 *
 * Sabab oddiy — `auth.tsx` uni statik import qilardi, `auth.tsx` esa
 * butun ilova ustida turadi. Holbuki saytga birinchi marta kirgan,
 * hisobi yo'q odamga bu kutubxona UMUMAN kerak emas.
 *
 * Endi u faqat haqiqatan kerak bo'lganda yuklanadi:
 *   - foydalanuvchining Supabase sessiyasi bo'lsa
 *   - URL da OAuth yoki parol tiklash tokeni bo'lsa
 *   - kirish / chiqish / parol amallarida
 *
 * `import type` bandlga hech narsa qo'shmaydi — u faqat tur uchun va
 * qurish paytida butunlay yo'qoladi.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY muhit o'zgaruvchilari .env faylida belgilanishi kerak.",
  )
}

let mijoz: SupabaseClient | null = null
let yuklash: Promise<SupabaseClient> | null = null

/**
 * Mijozni oladi, kerak bo'lsa avval yuklaydi.
 *
 * Bir vaqtda bir necha chaqiruv kelsa ham kutubxona BIR MARTA
 * yuklanadi: birinchi chaqiruv va'dani saqlab qo'yadi, qolganlari
 * o'shani kutadi. Aks holda ikkita mijoz yaratilib, sessiya ikki
 * joyda alohida saqlanardi.
 */
export function getSupabase(): Promise<SupabaseClient> {
  if (mijoz) return Promise.resolve(mijoz)
  if (!yuklash) {
    yuklash = import("@supabase/supabase-js").then(({ createClient }) => {
      mijoz = createClient(supabaseUrl, supabaseAnonKey)
      return mijoz
    })
  }
  return yuklash
}

/**
 * SUPABASE SESSIYASI BORMI — KUTUBXONANI YUKLAMASDAN.
 *
 * Supabase sessiyani `localStorage` da `sb-<loyiha>-auth-token`
 * kalitida saqlaydi. Uning BORLIGINI tekshirish uchun kutubxona
 * kerak emas — shu tufayli hisobi yo'q mehmonga 51 KB yuklanmaydi.
 *
 * Kalit nomi loyiha identifikatoriga bog'liq, shuning uchun aniq nom
 * emas, SHAKLI bo'yicha qidiriladi. Bu loyihada u aynan
 * `sb-ckdgprxppmtsgrofvkxd-auth-token` (tekshirilgan).
 *
 * ⚠️ Agar kelajakda Supabase saqlash kalitining shaklini o'zgartirsa,
 * bu funksiya "sessiya yo'q" deb qaytaradi va tizimga kirgan
 * foydalanuvchi mehmon bo'lib ko'rinadi. Kutubxona yangilanganda shu
 * joyni tekshirish kerak.
 */
export function supabaseSessiyasiBormi(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) return true
    }
  } catch {
    /**
     * Maxfiylik rejimida localStorage o'qishga ruxsat bermasligi
     * mumkin. Bunday holatda "sessiya bor" deb hisoblaymiz: ortiqcha
     * 51 KB yuklash — foydalanuvchini tizimdan chiqarib yuborishdan
     * ancha yaxshi.
     */
    return true
  }
  return false
}

/**
 * URL DA TOKEN BORMI.
 *
 * OAuth qaytishi va parol tiklash havolasi tokenni manzil ichida
 * olib keladi. Bunday holatda kutubxona DARHOL yuklanishi shart:
 * u tokenni manzildan o'qib sessiyaga aylantiradi. Yuklanmasa
 * foydalanuvchi havolani bosgan bo'lsa ham tizimga kira olmaydi.
 */
export function urldaTokenBormi(): boolean {
  if (typeof window === "undefined") return false
  const matn = (window.location.hash || "") + (window.location.search || "")
  return /access_token=|refresh_token=|type=recovery|[?&]code=/.test(matn)
}
