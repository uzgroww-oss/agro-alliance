/**
 * RASMLARNI KERAKLI O'LCHAMGA KELTIRISH.
 *
 * MUAMMO (PageSpeed Insights o'lchagan):
 *   /logo.webp        520x520, 19 KB  ->  ekranda 44x44
 *   /logo-white.webp  520x520, 24 KB  ->  ekranda 44x44
 *   /mascot.webp      559x820, 131 KB ->  ekranda 391x574
 *
 * Ya'ni logo o'z o'lchamidan 12 BARAVAR katta yuklanardi. Brauzer uni
 * yuklab olib, keyin kichraytirib chizardi — trafik ham, vaqt ham
 * bekorga ketardi. Jami 137 KB.
 *
 * YECHIM: har rasmning eng katta ko'rsatiladigan o'lchamidan IKKI
 * BARAVAR kattasi saqlanadi (retina ekranlar uchun yetarli), qolgani
 * kesiladi.
 *
 * NEGA 2x: 1x da retina ekranda rasm xira ko'rinadi, 3x esa ko'zga
 * ilinmaydigan farq uchun hajmni ikki barobar oshiradi.
 *
 * Ishga tushirish:  node scripts/optimize-images.mjs
 * Natija PUBLIC ichidagi fayllarni ALMASHTIRADI. Asl nusxalar
 * `public/_original/` ga ko'chiriladi — sifat yetarli bo'lmasa
 * qaytarish uchun.
 */
import sharp from "sharp"
import { readFile, writeFile, mkdir, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const PUBLIC = "public"
/**
 * Asl nusxalar `public/` DAN TASHQARIDA turadi.
 *
 * Ilgari ular `public/_original/` da edi va bu jimgina xato edi:
 * `public/` dagi hamma narsa saytga chiqadi, ya'ni siqilmagan 950 KB
 * rasm internetga qo'yilgan bo'lardi.
 */
const ZAXIRA = "assets-source"

/**
 * Har rasm uchun: ekrandagi eng katta o'lcham va sifat.
 *
 * `en` — CSS piksellardagi eng katta ko'rsatiladigan kenglik.
 * Fayl shundan ikki baravar katta qilib saqlanadi.
 */
const REJA = [
  // Sarlavhadagi logo h-11 w-11 = 44px; footer va login'da ham shuncha
  { fayl: "logo.webp", en: 44, sifat: 88 },
  { fayl: "logo-white.webp", en: 44, sifat: 88 },
  // Bosh sahifadagi maskot: max-w-[400px]
  { fayl: "mascot.webp", en: 400, sifat: 78 },
  { fayl: "mascot2.webp", en: 400, sifat: 78 },
  { fayl: "mascot3.webp", en: 400, sifat: 78 },
  { fayl: "mascot-news.webp", en: 400, sifat: 78 },
  { fayl: "mascot-partners.webp", en: 400, sifat: 78 },
  { fayl: "mascot-contact.webp", en: 400, sifat: 78 },
  // Fon rasmi — butun ekran bo'ylab, lekin ustidan oq parda tushadi,
  // shuning uchun sifat pastroq bo'lsa ham sezilmaydi
  { fayl: "hero-bg.webp", en: 1536, sifat: 68 },
]

const kb = (n) => Math.round(n / 1024)

async function main() {
  if (!existsSync(ZAXIRA)) await mkdir(ZAXIRA, { recursive: true })

  let oldin = 0
  let keyin = 0
  const jadval = []

  for (const { fayl, en, sifat } of REJA) {
    const yol = path.join(PUBLIC, fayl)
    if (!existsSync(yol)) {
      console.log(`  ${fayl}: topilmadi, o'tkazib yuborildi`)
      continue
    }

    const xom = await readFile(yol)
    const meta = await sharp(xom).metadata()

    // Asl nusxa faqat BIR MARTA saqlanadi: skript ikkinchi marta
    // ishga tushsa allaqachon siqilgan faylni asl deb yozib
    // qo'ymasligi kerak
    const zaxiraYol = path.join(ZAXIRA, fayl)
    if (!existsSync(zaxiraYol)) await writeFile(zaxiraYol, xom)

    const kerakli = Math.min(en * 2, meta.width)
    const yangi = await sharp(await readFile(zaxiraYol))
      .resize({ width: kerakli, withoutEnlargement: true })
      .webp({ quality: sifat, effort: 6 })
      .toBuffer()

    // Kattalashib ketgan bo'lsa (kichik rasmda bo'lishi mumkin)
    // eskisini qoldiramiz
    if (yangi.length >= xom.length && meta.width <= kerakli) {
      jadval.push([fayl, `${meta.width}x${meta.height}`, kb(xom.length), "o'zgarmadi"])
      oldin += xom.length
      keyin += xom.length
      continue
    }

    await writeFile(yol, yangi)
    const yangiMeta = await sharp(yangi).metadata()
    jadval.push([
      fayl,
      `${meta.width}x${meta.height} -> ${yangiMeta.width}x${yangiMeta.height}`,
      `${kb(xom.length)} -> ${kb(yangi.length)} KB`,
      `-${Math.round((1 - yangi.length / xom.length) * 100)}%`,
    ])
    oldin += xom.length
    keyin += yangi.length
  }

  for (const q of jadval) console.log("  " + q.map(String).join("  |  "))
  console.log(`\n  JAMI: ${kb(oldin)} KB -> ${kb(keyin)} KB  (${kb(oldin - keyin)} KB tejaldi)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
