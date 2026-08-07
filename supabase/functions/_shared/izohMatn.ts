/**
 * YOUTUBE IZOHIGA JAVOB — SOF MANTIQ.
 *
 * Bu faylda tarmoqqa ham, bazaga ham chiqmaydigan qism turadi:
 * qaysi izohga javob yozilmaydi, AI javobi qanday tozalanadi va
 * qanday qisqartiriladi, so'rov matni qanday quriladi.
 *
 * NEGA ALOHIDA FAYL: `izohJavob.ts` `supabase.ts` ni import qiladi,
 * u esa modul yuklanishidayoq muhit o'zgaruvchilarini talab qiladi —
 * ya'ni testda umuman yuklanmaydi. `aiSifat.ts` xuddi shu sababga
 * ko'ra ajratilgan edi.
 *
 * Bu yerdagi xato JIM va OMMAVIY: noto'g'ri javob kanal nomidan
 * YouTube'ga chiqadi. Shuning uchun hammasi testdan o'tadi.
 */

/** Izoh tushadigan tarmoqlar */
export const PLATFORMALAR = ["youtube", "instagram", "facebook", "telegram"] as const
export type Platforma = (typeof PLATFORMALAR)[number]

export const PLATFORMA_NOM: Record<Platforma, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  telegram: "Telegram",
}

export type IzohTil = "auto" | "uz" | "ru" | "en"

export type IzohSozlama = {
  /**
   * Avtomatik rejim — HAR TARMOQ UCHUN ALOHIDA.
   *
   * Bitta umumiy kalit bo'lsa tahririyat "hammasini yoqaman yoki
   * hech qaysisini" degan tanlovga qolardi. Amalda esa YouTube'da
   * javoblar ishonchli chiqib, Instagram'da hali qo'lda ko'rish
   * kerak bo'lishi mumkin.
   */
  avto: Record<Platforma, boolean>
  /** Paneldan yozilgan qo'shimcha ko'rsatma (ohang, taqiqlar) */
  ohang: string
  til: IzohTil
  /** Bitta yurishda har tarmoqda ko'pi bilan nechta javob */
  limit: number
  /** Javobning eng ko'p belgilar soni */
  uzunlik: number
}

export const ZAXIRA_SOZLAMA: IzohSozlama = {
  avto: { youtube: false, instagram: false, facebook: false, telegram: false },
  ohang: "",
  til: "auto",
  limit: 20,
  uzunlik: 200,
}

/* ==========================================================================
   ARZON TEKSHIRUVLAR — AI CHAQIRILMASDAN OLDIN
   ==========================================================================
   Bu yerda faqat ANIQ hollar. "Qo'pol izoh" yoki "javob berib
   bo'lmaydigan savol" ni so'z ro'yxati bilan aniqlab bo'lmaydi —
   o'zbekcha, ruscha va lotin/kirill aralash yozuvda bunday ro'yxat
   doim yo yetmaydi, yo begunoh izohni to'sib qo'yadi. Ularni AI ning
   o'zi hal qiladi: mos kelmasa `SKIP` qaytaradi.
   ========================================================================== */

/** Havola — spam va reklama izohlarining eng ishonchli belgisi */
const HAVOLA = /(https?:\/\/|www\.|t\.me\/|@[a-z0-9_]{4,})/i

/**
 * Izohga javob yozish kerakmi. Kerak bo'lmasa SABABINI qaytaradi,
 * kerak bo'lsa bo'sh satr.
 *
 * Sabab saqlanadi va panelda ko'rinadi: "nega bu izohga javob
 * berilmadi" degan savol javobsiz qolmasligi kerak.
 */
export function otkazSababi(izoh: string): string {
  const t = (izoh || "").trim()
  if (!t) return "izoh bo'sh"
  // Faqat emoji / tinish belgisi — javob yozadigan mazmun yo'q
  if (!/[\p{L}\p{N}]/u.test(t)) return "matn yo'q (faqat belgilar)"
  if (t.replace(/\s+/g, "").length < 3) return "juda qisqa"
  if (HAVOLA.test(t)) return "havola bor — spam ehtimoli"
  // Juda uzun izoh odatda ko'chirilgan matn yoki bahs — avtomatik
  // javob bunday joyda deyarli har doim o'rinsiz chiqadi
  if (t.length > 1200) return "juda uzun — qo'lda javob kerak"
  return ""
}

/* ==========================================================================
   AI JAVOBINI TOZALASH
   ========================================================================== */

/**
 * Model javobni ko'pincha bezab qaytaradi: qo'shtirnoq ichida,
 * "Javob:" prefiksi bilan, markdown yulduzchalari bilan. Bularning
 * hammasi YouTube'da xuddi shunday ko'rinadi, shuning uchun
 * tozalanadi.
 */
export function tozala(xom: string): string {
  let t = String(xom || "").trim()
  // ```...``` blok
  t = t.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim()
  // "Javob:" / "Reply:" / "Ответ:" prefiksi
  t = t.replace(/^(javob|reply|ответ|answer)\s*[:\-—]\s*/i, "").trim()
  // Butun matnni o'ragan qo'shtirnoq
  if (/^["'«“].*["'»”]$/s.test(t)) t = t.slice(1, -1).trim()
  // Markdown ta'kidlari. Yulduzcha SO'Z chegarasida bo'lsagina —
  // "5*3" kabi ifodalarga tegmasligi kerak.
  t = t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|\s)\*(\S.*?\S)\*(?=[\s.,!?]|$)/g, "$1$2")
  // Ko'p bo'sh qatorlar — izoh bir-ikki qatordan oshmasligi kerak
  t = t.replace(/\n{3,}/g, "\n\n")
  return t.trim()
}

/**
 * Chegaradan uzun javobni SO'Z chegarasida kesadi.
 *
 * O'rtasidan kesish yomon ko'rinadi ("Rahmat! Bizning mahsulo").
 * Avval gap oxiri qidiriladi, topilmasa oxirgi bo'sh joy.
 */
export function qisqartir(matn: string, chegara: number): string {
  const t = matn.trim()
  if (t.length <= chegara) return t
  const kesik = t.slice(0, chegara)
  const gap = Math.max(kesik.lastIndexOf("."), kesik.lastIndexOf("!"), kesik.lastIndexOf("?"))
  if (gap > chegara * 0.5) return kesik.slice(0, gap + 1).trim()
  const bosh = kesik.lastIndexOf(" ")
  return (bosh > chegara * 0.5 ? kesik.slice(0, bosh) : kesik).trim() + "…"
}

/* ==========================================================================
   SO'ROV MATNI
   ========================================================================== */

const TIL_NOM: Record<Exclude<IzohTil, "auto">, string> = {
  uz: "o'zbek tilida (lotin yozuvida)",
  ru: "rus tilida",
  en: "ingliz tilida",
}

/**
 * `SKIP` — modelning "bu izohga javob yozmaslik kerak" degan yagona
 * yo'li. Alohida maydonli JSON so'ramaymiz: javob bir qatorlik matn
 * va JSON qobig'i bu yerda faqat xato manbai bo'lardi.
 */
export const SKIP = "SKIP"

export function promptYasa(q: {
  izoh: string
  muallif: string
  videoSarlavha: string
  sozlama: IzohSozlama
  /** Qaysi tarmoqda — javob uslubi tarmoqqa qarab biroz farq qiladi */
  platforma?: Platforma
}): string {
  const { sozlama } = q
  const til = sozlama.til === "auto"
    ? "IZOH QAYSI TILDA YOZILGAN BO'LSA, O'SHA TILDA (o'zbekcha izohga o'zbekcha, ruschaga ruscha)"
    : TIL_NOM[sozlama.til]
  const p = q.platforma || "youtube"

  return `Sen "Agro Alliance" ${PLATFORMA_NOM[p]} sahifasining rasmiy javob yozuvchisisan.
Kanal agro sohasi haqida: fermerlar, agro texnologiyalar, blogerlar.

POST: ${q.videoSarlavha || "(sarlavha yo'q)"}
IZOH MUALLIFI: ${q.muallif || "(noma'lum)"}
IZOH: ${q.izoh}

Shu izohga kanal nomidan javob yoz.

QOIDALAR:
- Javob ${til} bo'lsin.
- Eng ko'pi ${sozlama.uzunlik} belgi. Bir-ikki gap yetarli.
- Samimiy, hurmatli, insoniy ohang. Rasmiy byurokratik til emas.
- Havola, telefon raqam, narx, yetkazib berish muddati YOZMA — bularni
  bilmaysan va noto'g'ri aytsang kanal javob beradi.
- Hashtag, emoji to'plami, reklama shiori yozma. Bitta emoji mumkin.
- "Men sun'iy intellektman" degan gapni aytma.
- Faqat javob matnini qaytar. Izoh, sarlavha, qo'shtirnoq qo'shma.

AGAR quyidagilardan biri bo'lsa — javob o'rniga FAQAT "${SKIP}" so'zini qaytar:
- izoh haqorat, tahdid yoki janjal;
- siyosat, din yoki shaxsiy nizo haqida;
- aniq faktni so'ragan va uni bilmaysan (narx, manzil, telefon,
  yetkazib berish, hamkorlik shartlari);
- izoh reklama yoki spam;
- izoh mazmunsiz (tasodifiy harflar).
${sozlama.ohang ? `\nTAHRIRIYAT KO'RSATMASI (majburiy):\n${sozlama.ohang}` : ""}`
}

/**
 * Model "SKIP" ni gap ichida ham qaytarishi mumkin. Boshida turgan
 * bo'lsa niyati aniq — javob emas.
 */
export function skipmi(matn: string): boolean {
  const t = matn.trim()
  return t.toUpperCase() === SKIP || new RegExp(`^${SKIP}\\b`, "i").test(t)
}
