/**
 * AI JAVOBI SIFAT DARVOZALARI.
 *
 * AI javob bergani YETARLI EMAS: kichik modellar quruq sarlavhalar
 * ro'yxatini, so'rovning o'z matnini yoki bir jumlani o'nlab marta
 * takrorlagan matnni ham "javob" deb qaytaradi. Bularning hammasi
 * "bo'sh emas" bo'lgani uchun oddiy tekshiruvdan o'tib, ekranga
 * chiqib ketardi.
 *
 * Bu yerdagi funksiyalar shundaylarni RAD ETADI. Ular smm-ai ichida
 * edi; ALOHIDA modulga chiqarildi, chunki sinovdan o'tkazib bo'lmasdi
 * — `Deno.serve` bor faylni test uchun import qilib bo'lmaydi.
 * Qarang: aiSifat_test.ts
 */

/**
 * AI so'ralgan JSON shaklini har doim ham aniq bermaydi. Masalan
 * "bozor" matn o'rniga { description, position, goals } obyekti bo'lib
 * kelgan va frontend uni chizmoqchi bo'lganda butun sahifa yiqilgan
 * ("Objects are not valid as a React child").
 *
 * Shuning uchun javob FRONTENDGA BERILISHDAN OLDIN majburan
 * to'g'rilanadi: matn kutilgan joyda matn, ro'yxat kutilgan joyda
 * matnlar ro'yxati bo'ladi.
 */
export function asText(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(" ")
  if (typeof v === "object") {
    // Obyekt bo'lsa qiymatlarini birlashtiramiz — kalitlar odatda
    // ichki sarlavhalar bo'ladi va matnning o'zi qiymatda turadi
    return Object.values(v as Record<string, unknown>).map(asText).filter(Boolean).join(". ")
  }
  return ""
}

export function asTextList(v: unknown): string[] {
  if (!v) return []
  const arr = Array.isArray(v) ? v : [v]
  return arr.map(asText).map((x) => x.trim()).filter(Boolean)
}

/**
 * Matn faqat sarlavhalardan iborat quruq ro'yxatmi?
 *
 * Kichik modellar mavzuni "1. Texnologiya 2. Hamkorlik 3. Savdo" kabi
 * ma'nosiz ro'yxat bilan yopib qo'yadi. Bunday post odamga hech narsa
 * bermaydi, lekin uzunligi yetarli bo'lgani uchun tekshiruvdan o'tardi.
 */
export function isSkeletonList(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  if (lines.length < 3) return false
  // Raqam yoki belgi bilan boshlanadigan, lekin jumla bo'lmagan qatorlar
  const stubs = lines.filter((l) => {
    if (!/^([0-9]+[.)]|[-•*])\s/.test(l)) return false
    const body = l.replace(/^([0-9]+[.)]|[-•*])\s*/, "")
    // Qisqa va tinish belgisi yo'q — ya'ni sarlavha, jumla emas
    return body.length < 45 && !/[.!?]/.test(body)
  })
  return stubs.length >= 3 && stubs.length >= lines.length * 0.4
}

/**
 * Matn odam o'qiydigan jumlaga o'xshaydimi?
 *
 * AI ba'zan matn maydoniga raqam yoki kalit-qiymat qaytaradi. Normalizator
 * ularni birlashtirganda "0. 3. 0. 2. 0" kabi bema'nilik hosil bo'lardi —
 * xatosiz, lekin foydasiz.
 */
export function looksLikeSentence(t: string): boolean {
  const s = (t || "").trim()
  if (s.length < 40) return false
  const words = s.split(/\s+/).filter((w) => /\p{L}{3,}/u.test(w))
  return words.length >= 8
}

/**
 * Matnni O'QISHGA QULAY formatlaydi.
 *
 * AI raqamli ro'yxatni bitta uzun paragrafga tiqib yozadi
 * ("...usullar: 1-jamoa 2-yer 3-qarz..."). Odam o'qishga qiynaladi.
 * Bu funksiya raqamli ro'yxat bandlarini ALOHIDA QATORGA ajratadi va
 * biroz otступ qo'yadi — go'yo qo'lda chiroyli terilgandek.
 *
 * Faqat HAQIQIY ro'yxat (kamida "1" va "2" bandlari) formatlanadi —
 * "5 ta usul" yoki "40%" kabi oddiy raqamlar tegilmaydi.
 */
export function prettyFormat(text: string): string {
  let t = (text || "").replace(/\r/g, "").trim()
  if (!t) return t
  const hasList = /(^|\s)1\s*[-.)]\s*\S/.test(t) && /(^|\s)2\s*[-.)]\s*\S/.test(t)
  if (hasList) {
    // "1-", "2.", "3)" oldiga yangi qator + otступ (tiredan keyin
    // bo'shliq bo'lmasligi ham mumkin: "1-jamoa")
    t = t.replace(/\s*(\d{1,2})([-.)])\s*/g, (_m, n, sep) => `\n   ${n}${sep} `)
    t = t.replace(/\n{2,}/g, "\n").replace(/^\n+/, "").trim()
  }
  return t
}

/**
 * Javobga so'rovning O'ZI sizib chiqqanmi?
 *
 * NEGA: kichik modellar ko'rsatmadagi namunani mavzu haqida o'ylash
 * o'rniga shundoq ko'chirib qo'yadi. Postda "<narsa> <qancha> foyda
 * beradi" degan bo'sh o'rinlar chiqib qolgan edi. Namunalar so'rovdan
 * olib tashlandi, bu esa ikkinchi qavat: bunday matnni qabul qilmaymiz.
 *
 * Burchakli qavs ichidagi so'z HTML tegi bo'lsa ruxsat — matn muharriri
 * <b>, <li> kabi teglarni haqiqatan ishlatadi.
 */
const HTML_TAGS = new Set([
  "b", "i", "u", "s", "em", "strong", "strike", "br", "p", "a",
  "ul", "ol", "li", "div", "span", "h1", "h2", "h3", "blockquote", "code",
])
/**
 * Matn media'ni TASVIRLAYAPTIMI? Bizga tayyor post kerak, "bu videoda
 * ... ko'rsatilgan" degan tavsif emas.
 */
export function describesMedia(text: string): boolean {
  return /videoda|videoni|videoning|videodagi|bu\s+video|ushbu\s+video|mazkur\s+video|klipda|kadrda|bu\s+rasmda|rasmda\s+ko|suratda|tasvirda\s+ko/i.test(text || "")
}

export function leaksInstructions(text: string): boolean {
  const t = text || ""
  for (const m of t.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9']{0,20})\s*\/?>/g)) {
    if (!HTML_TAGS.has(m[1].toLowerCase())) return true
  }
  return /\b(?:QOIDALARI|image prompt|yaxshi uslub|yomon uslub)\b|MAVZU:|PLATFORMA:|FAQAT JSON/i.test(t)
}

/**
 * Yozilgan matn so'ralgan MAVZU haqidami?
 *
 * NEGA KERAK: kichik modellar mavzuni e'tiborsiz qoldirib, so'rovdagi
 * MISOLNI ko'chirib qo'yadi. Marketing rejasida "Qiziqarli hikoyalar"
 * bosilganda post "tomchilatib sug'orish" haqida chiqib qolgan edi —
 * chunki misolda aynan shu yozilgandi. Misol tuzatildi, bu esa
 * ikkinchi qavat himoya: mavzuga aloqasiz matnni qabul qilmaymiz.
 *
 * O'zbek tilida qo'shimchalar ko'p (hikoya -> hikoyalarni), shuning
 * uchun so'zning O'ZAGI (dastlabki 5 harfi) bo'yicha solishtiramiz.
 */
export function matchesTopic(topic: string, text: string): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ")
  const stems = norm(topic).split(/\s+/).filter((w) => w.length >= 5).map((w) => w.slice(0, 5))
  if (!stems.length) return true // mavzu juda qisqa — tekshirib bo'lmaydi
  const body = norm(text)
  return stems.some((st) => body.includes(st))
}

export function normalizePlan(raw: unknown): MarketPlan {
  const o = (raw || {}) as Record<string, unknown>
  const reja = Array.isArray(o.reja) ? o.reja : []
  return {
    sotuv: asTextList(o.sotuv),
    osish: asTextList(o.osish),
    kontent_turlari: asTextList(o.kontent_turlari),
    reja: reja.map((r, i) => {
      const it = (r || {}) as Record<string, unknown>
      const kun = Number(it.kun)
      return {
        kun: Number.isFinite(kun) && kun > 0 ? kun : i + 1,
        mavzu: asText(it.mavzu),
        format: asText(it.format) || "post",
        platforma: asText(it.platforma) || "telegram",
        vaqt: asText(it.vaqt),
        maqsad: asText(it.maqsad),
      }
    }).filter((r) => r.mavzu),
  }
}

/**
 * Matn o'zini takrorlayaptimi?
 *
 * Kichik modellar ba'zan bir xil jumlani o'nlab marta yozib ketadi.
 * Bunday javob foydasiz, lekin "bo'sh emas" bo'lgani uchun tekshiruvdan
 * o'tib ketardi va ekranga chiqardi.
 */
export function isRepetitive(text: string): boolean {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean)
  // Qisqa matnda takror bo'lishi tabiiy — tekshirmaymiz
  if (words.length < 40) return false

  // Besh so'zli ketma-ketlik 4 marta takrorlansa — model qotib qolgan
  const seen = new Map<string, number>()
  let worst = 0
  for (let i = 0; i + 5 <= words.length; i++) {
    const k = words.slice(i, i + 5).join(" ")
    const n = (seen.get(k) || 0) + 1
    seen.set(k, n)
    if (n > worst) worst = n
  }

  // Yoki lug'at juda tor bo'lsa (bir xil so'zlar aylanib yuribdi)
  const uniqueRatio = new Set(words).size / words.length
  return worst >= 4 || uniqueRatio < 0.3
}

export type MarketPlan = {
  sotuv: string[]
  /** Tarmoqni o'stirish yo'llari — aniq amallar */
  osish: string[]
  /** Qanday kontent turlari ishlaydi va nega */
  kontent_turlari: string[]
  reja: { kun: number; mavzu: string; format: string; platforma: string; vaqt?: string; maqsad?: string }[]
}
