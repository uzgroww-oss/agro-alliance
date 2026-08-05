import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  asText, asTextList, isSkeletonList, looksLikeSentence, prettyFormat,
  describesMedia, leaksInstructions, matchesTopic, normalizePlan, isRepetitive,
} from "./aiSifat.ts"

/**
 * SIFAT SINOV TO'PLAMI.
 *
 * Bu darvozalar AI javobini foydalanuvchiga chiqarishdan OLDIN rad
 * etadi. Ular buzilsa hech qanday xato chiqmaydi — shunchaki ekranga
 * yaroqsiz matn chiqib ketadi va buni faqat odam payqaydi.
 *
 * Namunalar O'YLAB TOPILMAGAN: har biri haqiqatda chiqqan yomon
 * javobdan olingan (izohlarga qarang).
 */

/* ========================================================================
 * asText / asTextList — shakl to'g'rilash
 * ==================================================================== */

Deno.test("asText: obyekt kelsa ham matn qaytadi (React yiqilmasin)", () => {
  // Haqiqiy holat: "bozor" maydoniga matn o'rniga obyekt kelgan va
  // frontend "Objects are not valid as a React child" bilan yiqilgan
  const v = { description: "Bozor o'smoqda", position: "kuchli" }
  assertEquals(asText(v), "Bozor o'smoqda. kuchli")
})

Deno.test("asText: massiv, raqam, null", () => {
  assertEquals(asText(["bir", "ikki"]), "bir ikki")
  assertEquals(asText(42), "42")
  assertEquals(asText(null), "")
  assertEquals(asText(undefined), "")
})

Deno.test("asTextList: yakka qiymat ham ro'yxatga aylanadi", () => {
  assertEquals(asTextList("bitta"), ["bitta"])
  assertEquals(asTextList(["a", "", "  ", "b"]), ["a", "b"])
  assertEquals(asTextList(null), [])
})

/* ========================================================================
 * looksLikeSentence — "0. 3. 0. 2. 0" muammosi
 * ==================================================================== */

Deno.test("looksLikeSentence: raqamlar to'plamini rad etadi", () => {
  // Haqiqiy holat: AI matn maydoniga raqam qaytargan, normalizator
  // ularni birlashtirgan va ekranda "0. 3. 0. 2. 0" chiqqan
  assertFalse(looksLikeSentence("0. 3. 0. 2. 0"))
  assertFalse(looksLikeSentence("Savdo"))
  assertFalse(looksLikeSentence(""))
})

Deno.test("looksLikeSentence: haqiqiy jumlani qabul qiladi", () => {
  assert(looksLikeSentence(
    "Telegram kanalida har hafta bitta narx sharhini joylang, fermerlar aynan shuni qidiradi.",
  ))
})

/* ========================================================================
 * isSkeletonList — quruq sarlavhalar ro'yxati
 * ==================================================================== */

Deno.test("isSkeletonList: sarlavhalardan iborat ro'yxatni rad etadi", () => {
  // Haqiqiy holat: model mavzuni ma'nosiz ro'yxat bilan yopib qo'ygan
  assert(isSkeletonList("1. Texnologiya\n2. Hamkorlik\n3. Savdo\n4. Eksport"))
})

Deno.test("isSkeletonList: to'liq jumlali ro'yxat YAROQLI", () => {
  assertFalse(isSkeletonList([
    "1. Tomchilatib sug'orish suvni 40 foizga tejaydi va hosilni oshiradi.",
    "2. Tuproq tahlili yiliga bir marta o'tkazilsa o'g'it sarfi kamayadi.",
    "3. Zararkunandani erta payqash uchun haftada bir bor ko'zdan kechiring.",
  ].join("\n")))
})

Deno.test("isSkeletonList: uchtadan kam qator tekshirilmaydi", () => {
  assertFalse(isSkeletonList("1. Bir\n2. Ikki"))
})

/* ========================================================================
 * leaksInstructions — so'rovning o'zi javobga sizib chiqishi
 * ==================================================================== */

Deno.test("leaksInstructions: so'rov sarlavhalarini payqaydi", () => {
  // Haqiqiy holat: model namunani o'ylash o'rniga ko'chirib qo'ygan
  assert(leaksInstructions("MAVZU: bug'doy\nPLATFORMA: telegram"))
  assert(leaksInstructions("FAQAT JSON qaytar"))
  assert(leaksInstructions("<narsa> <qancha> foyda beradi"))
})

Deno.test("leaksInstructions: HTML teglari YAROQLI — muharrir ishlatadi", () => {
  assertFalse(leaksInstructions("<b>Muhim</b> xabar: <i>narx</i> o'zgardi"))
  assertFalse(leaksInstructions("<ul><li>Birinchi</li><li>Ikkinchi</li></ul>"))
})

/* ========================================================================
 * describesMedia — tavsif o'rniga tayyor post kerak
 * ==================================================================== */

Deno.test("describesMedia: videoni tasvirlagan matnni payqaydi", () => {
  assert(describesMedia("Bu videoda fermer traktorni ta'mirlamoqda"))
  assert(describesMedia("Rasmda ko'rinib turibdiki, hosil yig'ilgan"))
  assertFalse(describesMedia("Bug'doy narxi bu hafta 5 foizga oshdi"))
})

/* ========================================================================
 * matchesTopic — mavzuga aloqasiz matn
 * ==================================================================== */

Deno.test("matchesTopic: o'zbekcha qo'shimchalar o'zakka xalaqit bermaydi", () => {
  // "hikoya" -> "hikoyalarni": o'zak bo'yicha solishtiriladi
  assert(matchesTopic("Qiziqarli hikoyalar", "Fermerlarning hikoyalarni eshiting"))
})

Deno.test("matchesTopic: aloqasiz matnni rad etadi", () => {
  // Haqiqiy holat: "Qiziqarli hikoyalar" bosilgan, post esa
  // "tomchilatib sug'orish" haqida chiqqan — misol ko'chirilgan edi
  assertFalse(matchesTopic("Qiziqarli hikoyalar", "Tomchilatib sug'orish suvni tejaydi"))
})

Deno.test("matchesTopic: juda qisqa mavzu tekshirilmaydi", () => {
  // Tekshirib bo'lmaydi — rad etish noto'g'ri bo'lardi
  assert(matchesTopic("Suv", "Butunlay boshqa matn"))
})

/* ========================================================================
 * isRepetitive — model qotib qolgan
 * ==================================================================== */

Deno.test("isRepetitive: takrorlangan jumlani payqaydi", () => {
  const jumla = "Sifatli kontent joylang va auditoriya bilan ishlang "
  assert(isRepetitive(jumla.repeat(8)))
})

Deno.test("isRepetitive: normal matn o'tadi", () => {
  assertFalse(isRepetitive([
    "Bug'doy narxi bu hafta besh foizga oshdi va sabab eksport talabining ortishi.",
    "Fermerlar uchun bu qulay payt, lekin omborga qo'yish xarajatini hisoblash kerak.",
    "Keyingi oyda narx barqarorlashishi kutilmoqda, chunki yangi hosil bozorga chiqadi.",
    "Sotishni bo'lib-bo'lib amalga oshirish tavakkalni kamaytiradi.",
  ].join(" ")))
})

Deno.test("isRepetitive: qisqa matn tekshirilmaydi", () => {
  assertFalse(isRepetitive("Salom salom salom salom"))
})

/* ========================================================================
 * prettyFormat — bitta paragrafga tiqilgan ro'yxat
 * ==================================================================== */

Deno.test("prettyFormat: raqamli ro'yxatni qatorlarga ajratadi", () => {
  const out = prettyFormat("Uchta usul bor: 1-jamoa tuzish 2-yer tayyorlash 3-qarz olish")
  const qatorlar = out.split("\n").filter((l) => l.trim())
  assertEquals(qatorlar.length, 4)   // kirish + uchta band
  assert(out.includes("1- jamoa") || out.includes("1- "))
})

Deno.test("prettyFormat: oddiy raqamlarga TEGMAYDI", () => {
  // "5 ta usul" yoki "40%" ro'yxat emas — buzib yuborilmasin
  const matn = "Bu usul suvni 40% tejaydi va 5 ta bosqichdan iborat."
  assertEquals(prettyFormat(matn), matn)
})

/* ========================================================================
 * normalizePlan — reja shakli
 * ==================================================================== */

Deno.test("normalizePlan: yetishmagan maydonlarga standart qiymat", () => {
  const p = normalizePlan({ reja: [{ mavzu: "Bug'doy narxi" }] })
  assertEquals(p.reja.length, 1)
  assertEquals(p.reja[0].kun, 1)            // kun yo'q edi — o'rni bo'yicha
  assertEquals(p.reja[0].format, "post")
  assertEquals(p.reja[0].platforma, "telegram")
})

Deno.test("normalizePlan: mavzusiz band TASHLANADI", () => {
  // Mavzusiz qator jadvalda bo'sh satr bo'lib chiqardi
  const p = normalizePlan({ reja: [{ kun: 1, mavzu: "Bor" }, { kun: 2 }, { kun: 3, mavzu: "" }] })
  assertEquals(p.reja.length, 1)
  assertEquals(p.reja[0].mavzu, "Bor")
})

Deno.test("normalizePlan: butunlay noto'g'ri kirish yiqitmaydi", () => {
  const p = normalizePlan("shunchaki matn")
  assertEquals(p.reja, [])
  assertEquals(p.sotuv, [])
})

Deno.test("normalizePlan: obyekt bo'lib kelgan mavzu matnga aylanadi", () => {
  const p = normalizePlan({ reja: [{ kun: 1, mavzu: { title: "Narx sharhi" } }] })
  assertEquals(p.reja[0].mavzu, "Narx sharhi")
})
