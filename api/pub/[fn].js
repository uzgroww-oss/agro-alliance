/**
 * OMMAVIY MA'LUMOT UCHUN KESHLOVCHI PROKSI (Vercel Edge).
 *
 * MUAMMO: brauzer ommaviy ma'lumotni to'g'ridan-to'g'ri Supabase edge
 * funksiyasidan olardi. Kod javobga `Cache-Control: s-maxage=300`
 * qo'yadi, lekin o'lchandi — javobda `CF-Cache-Status: DYNAMIC`, ya'ni
 * KESHLANMAYDI. Har bir mehmon uchun statistika, blogerlar ro'yxati va
 * bosh sahifa matnlari QAYTADAN bazadan hisoblanardi.
 *
 * Ustiga Supabase loyihasi Singapurda, foydalanuvchilar esa
 * O'zbekistonda: bo'sh turgan tizimda ham bitta so'rov ~1 soniya.
 *
 * YECHIM: so'rov Vercel'ning o'z chekka tugunidan o'tadi va javob
 * o'sha yerda keshlanadi. Natijada:
 *   - mehmon javobni O'ZIGA YAQIN tugundan oladi (Singapurga borish
 *     yo'q);
 *   - bir xil so'rov 5 daqiqada BIR MARTA bazaga tushadi, qolgan
 *     hammasi keshdan;
 *   - `stale-while-revalidate` — kesh eskirganda ham eski javob
 *     darhol beriladi, yangisi fonda olinadi. Foydalanuvchi hech
 *     qachon "yangilanishni" kutmaydi.
 *
 * ⚠️ FAQAT OMMAVIY MA'LUMOT. Ro'yxatdagi funksiyalar hammaga ochiq
 * va shaxsiy narsa qaytarmaydi. Shaxsiy ma'lumot bu yerdan O'TMAYDI
 * — u to'g'ridan-to'g'ri Supabase'ga boradi va keshlanmaydi.
 */

export const config = { runtime: "edge" }

/**
 * OQ RO'YXAT — SHART.
 *
 * Usiz bu ochiq proksi bo'lardi: istalgan odam `/api/pub/<xohlagan
 * funksiya>` deb bizning service-role muhitimizdagi har qanday
 * funksiyani chaqira olardi. Faqat mana shu nomlar o'tadi.
 */
const RUXSAT = new Set([
  "public-stats",
  "public-bloggers-list",
  "public-bloggers-profile",
  "public-news-list",
  "public-news-detail",
  "public-news-popular",
  "public-news-related",
  "public-partners",
  "public-categories",
  "public-homepage-sections",
  "public-settings",
  "public-team",
])

/** Kesh muddati: ma'lumot kuniga bir marta o'zgaradi, 5 daqiqa xavfsiz */
const KESH = "public, s-maxage=300, stale-while-revalidate=1800"

export default async function handler(req) {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    })
  }

  const url = new URL(req.url)
  const fn = url.pathname.split("/").pop() || ""
  if (!RUXSAT.has(fn)) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    })
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ""
  const ANON = process.env.VITE_SUPABASE_ANON_KEY || ""
  if (!SUPABASE_URL || !ANON) {
    // Sozlama yetishmasa jimgina 500 emas — sabab ko'rinsin
    return new Response(JSON.stringify({ error: "Proksi sozlanmagan" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    })
  }

  const manba = `${SUPABASE_URL}/functions/v1/${fn}${url.search}`

  try {
    /**
     * Mijozning `Authorization` sarlavhasi ATAYLAB uzatilmaydi —
     * doim anon kalit ishlatiladi. Aks holda bir foydalanuvchining
     * tokeni bilan olingan javob keshga tushib, boshqasiga
     * berilishi mumkin edi.
     */
    const r = await fetch(manba, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    })
    const tana = await r.text()

    return new Response(tana, {
      status: r.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Xato javob keshlanmasin — aks holda vaqtinchalik nosozlik
        // 5 daqiqaga muzlab qolardi
        "Cache-Control": r.ok ? KESH : "no-store",
        // Til bo'yicha javob farq qiladi (?lang=), u manzilda —
        // ya'ni kesh kaliti allaqachon to'g'ri
        "X-Kesh-Manba": "vercel-edge",
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: "Manba javob bermadi" }), {
      status: 502, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  }
}
