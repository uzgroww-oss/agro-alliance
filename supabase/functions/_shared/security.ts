export function sanitize(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.\./g, "")
    .substring(0, 255)
}

/**
 * `checkRateLimit` SHU YERDAN OLIB TASHLANDI.
 *
 * U hisobni oddiy `Map` da, ya'ni bitta isolate XOTIRASIDA yuritardi.
 * Edge funksiyalar esa ko'p isolate'da parallel ishlaydi va ular
 * bo'sh turganda o'chib ketadi — hisob har safar noldan boshlanardi.
 * Ya'ni chegara aslida ishlamasdi, faqat ishlayotgandek ko'rinardi.
 *
 * Ustiga u hech qayerda chaqirilmasdi ham.
 *
 * ISHLATING: `publicRateLimit.ts` dagi `rateLimited()` — u hisobni
 * bazada, atomik RPC orqali yuritadi va xato bo'lsa BLOKLAYDI
 * (fail-closed), ya'ni baza tiqilib qolganda himoya ochilib ketmaydi.
 */
