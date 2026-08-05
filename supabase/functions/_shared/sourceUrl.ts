/**
 * YANGILIK MANBASI MANZILINI TEKSHIRISH (SSRF himoyasi).
 *
 * NEGA ALOHIDA FAYL: bu tekshiruv ilgari faqat `admin-news-sources`
 * ichida, ya'ni manba QO'SHILAYOTGANDA ishlardi. Bazaga bir marta
 * tushib qolgan xavfli manzilni esa hech kim qayta tekshirmasdi.
 *
 * Bazada aynan shunday yozuvlar topildi — xavfsizlik sinovidan qolgan
 * to'qqizta "sinov" manbasi:
 *     file:///etc/passwd
 *     http://169.254.169.254/latest/meta-data/   (bulut metama'lumoti)
 *     http://127.0.0.1:8000/x, http://10.0.0.5/, http://192.168.1.1/
 *
 * Agar fon ishlari shu manbalarni yuklashga urinsa, server O'Z ichki
 * tarmog'iga va bulut metama'lumot xizmatiga so'rov yuborardi — bu
 * bulut kalitlarini o'g'irlashning klassik yo'li.
 *
 * Shuning uchun tekshiruv endi YUKLASH PAYTIDA ham bajariladi:
 * kiritishda o'tkazib yuborilgan yoki qo'lda bazaga yozilgan manzil
 * ham bloklanadi.
 */
export function badSourceUrl(raw: string): string | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return "URL noto'g'ri"
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return "Faqat http/https manzil qabul qilinadi"
  }
  const h = u.hostname.toLowerCase()
  if (
    h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) || /^0\./.test(h) ||
    h === "[::1]" || h === "::1"
  ) {
    return "Ichki tarmoq manzillari qabul qilinmaydi"
  }
  return null
}
