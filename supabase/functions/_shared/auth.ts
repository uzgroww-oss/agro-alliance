import { supabaseAdmin } from "./supabase.ts"
import { errorResponse } from "./response.ts"
import { tokenTekshir } from "./jwtTekshir.ts"

export type DbRoleName = "super_admin" | "admin" | "editor" | "blogger" | "company" | "user"

export interface AuthUser {
  id: string
  email: string
  role: DbRoleName
  status: string
  name: string
  [key: string]: unknown
}

/* ==========================================================================
   PROFIL VA ROL KESHI
   ==========================================================================
   Token tekshirilgandan keyin ham HAR so'rovda ikkita baza so'rovi
   ketardi: profil va rollar. Ular kamdan-kam o'zgaradi, so'rov esa
   ko'p — shuning uchun natija qisqa vaqtga xotirada saqlanadi.

   ⚠️ NARXI: admin foydalanuvchini bloklasa yoki rolini o'zgartirsa,
   yangi holat 30 SONIYAGACHA kechikishi mumkin. Muddat ataylab qisqa:
   xavfsizlik uchun uzun kesh yaramaydi, tezlik uchun esa 30 soniya
   ham yetarli — bir foydalanuvchi shu vaqt ichida o'nlab so'rov
   yuboradi.

   Kesh isolate xotirasida: u so'nib qolsa qayta to'ladi, ya'ni
   noto'g'ri holat uzoq yashamaydi.
   ========================================================================== */

const KESH_MS = 30_000
const kesh = new Map<string, { user: AuthUser; muddat: number }>()

function keshOl(id: string): AuthUser | null {
  const bor = kesh.get(id)
  if (!bor) return null
  if (Date.now() > bor.muddat) { kesh.delete(id); return null }
  return bor.user
}

function keshgaYoz(id: string, user: AuthUser): void {
  // Cheksiz o'smasin — isolate xotirasi cheklangan
  if (kesh.size > 500) kesh.clear()
  kesh.set(id, { user, muddat: Date.now() + KESH_MS })
}

export async function verifyAuth(req: Request): Promise<
  { user: AuthUser; response: null } | { user: null; response: Response }
> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, response: errorResponse("Token kerak", 401, "UNAUTHORIZED") }
  }

  const token = authHeader.slice(7)

  /**
   * TOKEN AVVAL MAHALLIY TEKSHIRILADI.
   *
   * ILGARI bu yerda faqat `supabaseAdmin.auth.getUser(token)` turardi
   * — Auth xizmatiga alohida tarmoq so'rovi. O'lchandi: 0.5–0.95
   * soniya, VA U HAR HIMOYALANGAN SO'ROVDA takrorlanardi. Kabinetdagi
   * har bosishning yarmi shunga ketardi.
   *
   * Endi imzo o'zimizda tekshiriladi (ES256, ochiq kalit JWKS dan,
   * xotirada) — mikrosekundlar.
   *
   * ZAXIRA SAQLANDI: imzo tekshiruvi ishlamasa (kalit almashgan, eski
   * formatdagi token) eski yo'lga qaytamiz. Ya'ni bu o'zgarish hech
   * kimni tizimdan chiqarib yubormaydi.
   */
  let userId = ""
  const dava = await tokenTekshir(token)
  if (dava) {
    userId = dava.sub
  } else {
    const { data: { user: authData }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !authData) {
      return { user: null, response: errorResponse("Token notog'ri", 401, "INVALID_TOKEN") }
    }
    userId = authData.id
  }

  const keshdan = keshOl(userId)
  if (keshdan) {
    if (keshdan.status !== "active") {
      return { user: null, response: errorResponse("Hisobingiz faollashtirilmagan", 403, "ACCOUNT_INACTIVE") }
    }
    return { user: keshdan, response: null }
  }

  /**
   * TEZLIK: bu ikki so'rov KETMA-KET edi va ikkalasi ham faqat
   * authData.id ga bog'liq — bir-birini kutishi shart emas.
   *
   * Bu funksiya HAR BIR himoyalangan so'rovda ishlaydi, ya'ni tejalgan
   * bitta borish-kelish butun saytga ta'sir qiladi.
   *
   * Ustiga select("*") butun qatorni tortardi — `metadata` JSONB
   * ustunida rasmlar va videolar massivi saqlanadi. Endi faqat
   * kerakli ustunlar.
   */
  const [{ data: profile, error: profileErr }, { data: userRoles }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, email, name, status")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_roles")
      .select("role:roles(name, priority)")
      .eq("profile_id", userId),
  ])

  if (profileErr || !profile) {
    return { user: null, response: errorResponse(profileErr?.message || "Profil topilmadi", 404, "NOT_FOUND") }
  }


  const sorted = (userRoles ?? [])
    .map((ur: Record<string, unknown>) => (ur as { role: { name: string; priority: number } }).role)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  const roleName = sorted[0]?.name ?? "user"

  const user: AuthUser = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    status: profile.status,
    role: roleName as DbRoleName,
  }

  /**
   * Keshga FAOL BO'LMAGAN foydalanuvchi ham yoziladi.
   *
   * Aks holda bloklangan hisob har so'rovda ikkita baza so'roviga
   * sabab bo'lardi — ya'ni to'silgan foydalanuvchi tizimga faol
   * foydalanuvchidan KO'PROQ yuk berardi.
   *
   * To'sish keshdan keyin, quyida bajariladi.
   */
  keshgaYoz(userId, user)

  if (user.status !== "active") {
    return { user: null, response: errorResponse("Hisobingiz faollashtirilmagan", 403, "ACCOUNT_INACTIVE") }
  }

  return { user, response: null }
}

export async function requireRole(
  req: Request,
  ...roles: DbRoleName[]
): Promise<
  { user: AuthUser; response: null } | { user: null; response: Response }
> {
  const result = await verifyAuth(req)
  if (result.response) return result

  if (!roles.includes(result.user.role as DbRoleName)) {
    return {
      user: null,
      response: errorResponse("Ruxsat yo'q", 403, "FORBIDDEN"),
    }
  }

  return result
}
