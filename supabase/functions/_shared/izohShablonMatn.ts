/**
 * TAYYOR JAVOB (SHABLON) — SOF MANTIQ.
 *
 * Bu yerda faqat "izoh shablonga mos keladimi" degan savol hal
 * qilinadi. Bazaga ham, tarmoqqa ham chiqmaydi — shuning uchun
 * testdan o'tadi (`izohShablonMatn_test.ts`).
 *
 * NEGA ALOHIDA FAYL: `izohShablon.ts` `supabase.ts` ni import qiladi,
 * u esa modul yuklanishidayoq muhit o'zgaruvchilarini talab qiladi,
 * ya'ni testda umuman yuklanmaydi. `izohMatn.ts` va `aiSifat.ts`
 * xuddi shu sababga ko'ra ajratilgan.
 *
 * Bu yerdagi xato JIM va OMMAVIY: noto'g'ri moslashgan shablon kanal
 * nomidan butunlay boshqa savolga javob bo'lib chiqadi.
 */

export type Shablon = {
  id: string
  savol: string
  javob: string
  /** null — hamma tarmoqda ishlaydi */
  platform: string | null
  faol: boolean
}

/**
 * Matnni solishtirishga tayyorlaydi.
 *
 * O'ZBEK APOSTROFI — asosiy tuzoq. "o'g'it" so'zi amalda kamida besh
 * xil belgi bilan yoziladi: to'g'ri tipografik ' (U+2019), ʻ (U+02BB),
 * ʼ (U+02BC), oddiy ' va ` . Foydalanuvchi klaviaturasiga qarab
 * istalgani tushadi. Hammasi bitta belgiga keltirilmasa, tahririyat
 * "o'g'it" deb yozgan shablon "oʻgʻit" deb yozilgan izohga mos
 * kelmaydi va buni tushuntirib bo'lmaydi.
 *
 * Tinish belgisi va emoji — bo'sh joy. "narxi qancha?" va
 * "narxi qancha 😊" bir xil ko'rinishi kerak.
 */
export function normalize(matn: string): string {
  return String(matn || "")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
}

/**
 * Bitta "savol" maydonida BIR NECHTA variant bo'lishi mumkin —
 * vergul, nuqtali vergul yoki yangi qatordan ajratiladi.
 *
 * NEGA KERAK: bitta savol o'zbekcha o'nlab xil aytiladi — "narx
 * qancha", "narxi qanday", "qancha turadi", "pochom". Bularning
 * hammasi bitta javobga olib boradi. Variantsiz tahririyat har biri
 * uchun alohida shablon yozishga majbur bo'lardi va ro'yxat
 * boshqarib bo'lmas holga kelardi.
 *
 * O'lchandi: "narx qancha" shabloni "Narxlaringiz qanday?" izohiga
 * mos kelmagan — "qancha" va "qanday" boshqa so'zlar. Endi ikkalasi
 * bitta shablonda yoziladi.
 */
export function variantlar(savol: string): string[] {
  return String(savol || "")
    .split(/[,;\n]+/)
    .map((s) => normalize(s))
    .filter(Boolean)
}

/**
 * Bitta variant izohga mos keladimi. IKKI BOSQICH:
 *
 * 1. To'liq ibora. Izoh ichida variant AYNAN uchrasa — mos.
 *    "narx qancha" -> "salom narx qancha aytasizmi" ✓
 *
 * 2. So'z bo'yicha. Variantdagi HAMMA so'z izohda bo'lsa — mos.
 *    Bu O'ZBEK QO'SHIMCHALARI uchun shart: "narx" so'zi izohda
 *    "narxi", "narxlari", "narxingiz" ko'rinishida keladi. Shuning
 *    uchun tenglik emas, ICHIDA BORMI deb qaraladi.
 *
 * UCH BELGIDAN QISQA so'zlar hisobga olinmaydi ("va", "bu", "ham"):
 * ular deyarli har izohda bor va mos kelishni bemaza qilardi.
 *
 * ⚠️ SO'Z KAMAYGANDA MOSLIK KENGAYADI. "narx" — narx so'zi bor har
 * qanday izohga tushadi; "narx qancha" — ikkalasi ham bo'lishi shart.
 * Tahririyat kengligini shu orqali boshqaradi. Panelda shu yozilgan.
 */
/** Ikki so'zning boshidan nechta belgi bir xil */
function umumiyBosh(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a[i] === b[i]) i++
  return i
}

/**
 * Ikki so'z BIR O'ZAKDANMI.
 *
 * NEGA SHUNCHAKI "ichida bormi" YETMAYDI: qo'shimcha ikkala tomonda
 * ham bo'lishi mumkin. Tahririyat "narxi" deb yozadi, izohda esa
 * "narxlaringiz" turadi — birortasi ikkinchisining ichida emas,
 * lekin savol bitta. O'lchandi: aynan shu holat sinovda mos
 * kelmagan.
 *
 * QOIDA: umumiy bosh kamida 4 belgi VA qisqa so'zning kamida 60%
 * qismini qoplasin.
 *
 * Chegara ataylab qattiq. Bo'shroq qilinsa yolg'on mosliklar
 * boshlanadi va ular JIM: "narx" va "narsa" ning umumiy boshi 3
 * belgi — 4 talik shart aynan shuni to'sadi. "qanday" va "qancha"
 * ham shu sababdan turli so'z bo'lib qoladi.
 */
function sozMos(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 3 && b.includes(a)) return true
  if (b.length >= 3 && a.includes(b)) return true
  const bosh = umumiyBosh(a, b)
  return bosh >= 4 && bosh / Math.min(a.length, b.length) >= 0.6
}

function variantMos(variant: string, normalIzoh: string): boolean {
  if (!variant) return false
  if (normalIzoh.includes(variant)) return true

  const sozlar = variant.split(" ").filter((w) => w.length >= 3)
  if (sozlar.length === 0) return false
  const izohSozlar = normalIzoh.split(" ").filter(Boolean)
  return sozlar.every((w) => izohSozlar.some((iz) => sozMos(w, iz)))
}

/**
 * Izoh shu shablonga mos keladimi — variantlarning BIRORTASI yetarli.
 */
export function mosKeladi(savol: string, izoh: string): boolean {
  return mosVariantUzunligi(savol, izoh) > 0
}

/**
 * Mos kelgan ENG UZUN variantning uzunligi. 0 — mos kelmadi.
 *
 * Uzunlik aniqlikni bildiradi va shablonlar orasidan tanlashda
 * ishlatiladi: "hamkorlik narxi" "narx" dan aniqroq savol.
 */
export function mosVariantUzunligi(savol: string, izoh: string): number {
  const i = normalize(izoh)
  if (!i) return 0
  let eng = 0
  for (const v of variantlar(savol)) {
    if (variantMos(v, i) && v.length > eng) eng = v.length
  }
  return eng
}

/**
 * Bir nechta shablon mos kelsa — qaysi biri ishlatiladi.
 *
 * TARTIB (yuqoridan pastga):
 *   1. Tarmoqqa BIRIKTIRILGANI umumiydan ustun. Tahririyat aynan
 *      Telegram uchun alohida matn yozgan bo'lsa, uni umumiy shablon
 *      bosib ketmasligi kerak — aks holda alohida yozishning ma'nosi
 *      yo'qoladi.
 *   2. Savoli UZUNROG'I ustun. Uzun savol aniqroq: "hamkorlik narxi"
 *      "narx" dan ko'ra aniq savolni bildiradi.
 *   3. Qolganida — barqarorlik uchun id bo'yicha. Bir xil vaznli
 *      ikki shablon har safar navbat bilan chiqmasligi kerak:
 *      "bir xil savolga bir xil javob" shartining bir qismi.
 */
export function shablonTanla(
  shablonlar: Shablon[],
  izoh: string,
  platforma: string,
): Shablon | null {
  const mos = shablonlar
    .filter((sh) => sh.faol && (!sh.platform || sh.platform === platforma))
    .map((sh) => ({ sh, vazn: mosVariantUzunligi(sh.savol, izoh) }))
    .filter((x) => x.vazn > 0)

  if (mos.length === 0) return null

  mos.sort((a, b) => {
    const aAniq = a.sh.platform ? 1 : 0
    const bAniq = b.sh.platform ? 1 : 0
    if (aAniq !== bAniq) return bAniq - aAniq
    if (a.vazn !== b.vazn) return b.vazn - a.vazn
    return a.sh.id < b.sh.id ? -1 : a.sh.id > b.sh.id ? 1 : 0
  })

  return mos[0].sh
}
