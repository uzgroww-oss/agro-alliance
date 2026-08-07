import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { otkazSababi, tozala, qisqartir, promptYasa, ZAXIRA_SOZLAMA, SKIP, PLATFORMALAR } from "./izohMatn.ts"

/**
 * IZOHGA AVTOMATIK JAVOB — TEKSHIRUVLAR.
 *
 * Bu yerdagi xato JIM va OMMAVIY: noto'g'ri javob kanal nomidan
 * YouTube'ga chiqadi va uni hamma ko'radi. Shuning uchun AI ga
 * bormaydigan qismlar — qaysi izoh o'tkazib yuboriladi, javob qanday
 * tozalanadi va qanday qisqaradi — testdan o'tadi.
 */

/* ---------------- Qaysi izohga javob yozilmaydi ---------------- */

Deno.test("bo'sh izoh o'tkazib yuboriladi", () => {
  assertEquals(otkazSababi(""), "izoh bo'sh")
  assertEquals(otkazSababi("   "), "izoh bo'sh")
})

Deno.test("faqat emoji — javob yozadigan mazmun yo'q", () => {
  assertEquals(otkazSababi("🔥🔥🔥"), "matn yo'q (faqat belgilar)")
  assertEquals(otkazSababi("!!!"), "matn yo'q (faqat belgilar)")
})

Deno.test("juda qisqa izoh", () => {
  assertEquals(otkazSababi("ok"), "juda qisqa")
})

Deno.test("havolali izoh spam deb hisoblanadi", () => {
  assertStringIncludes(otkazSababi("Zo'r! https://spam.example.com ga kiring"), "havola")
  assertStringIncludes(otkazSababi("t.me/kanalim ga obuna bo'ling"), "havola")
  assertStringIncludes(otkazSababi("www.saytim.uz da bor"), "havola")
  assertStringIncludes(otkazSababi("@reklama_kanal obuna"), "havola")
})

Deno.test("juda uzun izoh qo'lda javob talab qiladi", () => {
  assertStringIncludes(otkazSababi("a".repeat(1300)), "juda uzun")
})

Deno.test("oddiy izohga javob yoziladi", () => {
  assertEquals(otkazSababi("Juda foydali video, rahmat!"), "")
  assertEquals(otkazSababi("Bu texnika qaysi hududda ishlaydi?"), "")
  // Kirill yozuvi ham matn deb hisoblanadi
  assertEquals(otkazSababi("Отличное видео, спасибо!"), "")
})

Deno.test("emoji QO'SHILGAN matnli izoh o'tkazilmaydi", () => {
  // Faqat emoji bo'lsa o'tkaziladi, matn bilan birga bo'lsa — yo'q
  assertEquals(otkazSababi("Rahmat! 🔥"), "")
})

/* ---------------- AI javobini tozalash ---------------- */

Deno.test("qo'shtirnoq ichidagi javob ochiladi", () => {
  assertEquals(tozala('"Rahmat, xursandmiz!"'), "Rahmat, xursandmiz!")
  assertEquals(tozala("«Rahmat!»"), "Rahmat!")
})

Deno.test('"Javob:" prefiksi olib tashlanadi', () => {
  assertEquals(tozala("Javob: Rahmat!"), "Rahmat!")
  assertEquals(tozala("Ответ: Спасибо!"), "Спасибо!")
  assertEquals(tozala("Reply - Thanks!"), "Thanks!")
})

Deno.test("markdown ta'kidlari olib tashlanadi", () => {
  assertEquals(tozala("**Rahmat!** Yana kuting"), "Rahmat! Yana kuting")
  assertEquals(tozala("Bu *juda* foydali"), "Bu juda foydali")
})

Deno.test("kod bloki ochiladi", () => {
  assertEquals(tozala("```\nRahmat!\n```"), "Rahmat!")
})

Deno.test("oddiy matn o'zgarmaydi", () => {
  // Gap ichidagi yulduzcha ta'kid emas — tegilmasligi kerak
  assertEquals(tozala("Narxi 5*3 formulasi bo'yicha"), "Narxi 5*3 formulasi bo'yicha")
})

Deno.test("ko'p bo'sh qatorlar bittaga tushadi", () => {
  assertEquals(tozala("Birinchi\n\n\n\nIkkinchi"), "Birinchi\n\nIkkinchi")
})

/* ---------------- Qisqartirish ---------------- */

Deno.test("chegaradan qisqa matn tegilmaydi", () => {
  assertEquals(qisqartir("Rahmat!", 200), "Rahmat!")
})

Deno.test("gap oxirida kesiladi", () => {
  const m = "Rahmat, juda xursandmiz. Yana ko'plab videolar tayyorlanmoqda, kuzatib boring."
  const r = qisqartir(m, 40)
  assertEquals(r, "Rahmat, juda xursandmiz.")
})

Deno.test("gap oxiri yo'q bo'lsa so'z chegarasida kesiladi", () => {
  const m = "Rahmat sizga juda katta minnatdorchilik bildiramiz doim kuzatib boring"
  const r = qisqartir(m, 30)
  // So'z o'rtasidan kesilmasligi kerak
  assertEquals(r.endsWith("…"), true)
  assertEquals(m.startsWith(r.slice(0, -1)), true)
})

Deno.test("qisqartirilgan matn chegaradan oshmaydi", () => {
  const m = "a".repeat(500)
  // Bo'sh joy yo'q — qattiq kesiladi, uzunlik chegara + "…" dan oshmaydi
  assertEquals(qisqartir(m, 100).length <= 101, true)
})

/* ---------------- So'rov matni ---------------- */

const asos = { izoh: "Zo'r video!", muallif: "Ali", videoSarlavha: "Bug'doy ekish" }

Deno.test("so'rovda izoh, muallif va video sarlavhasi bor", () => {
  const p = promptYasa({ ...asos, sozlama: ZAXIRA_SOZLAMA })
  assertStringIncludes(p, "Zo'r video!")
  assertStringIncludes(p, "Ali")
  assertStringIncludes(p, "Bug'doy ekish")
})

Deno.test("so'rovda SKIP shartlari aytilgan", () => {
  const p = promptYasa({ ...asos, sozlama: ZAXIRA_SOZLAMA })
  assertStringIncludes(p, SKIP)
  assertStringIncludes(p, "haqorat")
})

Deno.test("til sozlamasi so'rovga tushadi", () => {
  const avto = promptYasa({ ...asos, sozlama: { ...ZAXIRA_SOZLAMA, til: "auto" } })
  assertStringIncludes(avto, "QAYSI TILDA YOZILGAN BO'LSA")

  const rus = promptYasa({ ...asos, sozlama: { ...ZAXIRA_SOZLAMA, til: "ru" } })
  assertStringIncludes(rus, "rus tilida")
})

Deno.test("uzunlik chegarasi so'rovga tushadi", () => {
  const p = promptYasa({ ...asos, sozlama: { ...ZAXIRA_SOZLAMA, uzunlik: 90 } })
  assertStringIncludes(p, "90 belgi")
})

Deno.test("tahririyat ko'rsatmasi qo'shiladi va bo'sh bo'lsa qo'shilmaydi", () => {
  const bilan = promptYasa({ ...asos, sozlama: { ...ZAXIRA_SOZLAMA, ohang: "Doim 'siz' deb murojaat qil" } })
  assertStringIncludes(bilan, "Doim 'siz' deb murojaat qil")

  const siz = promptYasa({ ...asos, sozlama: ZAXIRA_SOZLAMA })
  assertEquals(siz.includes("TAHRIRIYAT KO'RSATMASI"), false)
})

/* ---------------- Tarmoqlar ---------------- */

Deno.test("so'rovda tarmoq nomi to'g'ri chiqadi", () => {
  const ig = promptYasa({ ...asos, sozlama: ZAXIRA_SOZLAMA, platforma: "instagram" })
  assertStringIncludes(ig, "Instagram sahifasining")

  const tg = promptYasa({ ...asos, sozlama: ZAXIRA_SOZLAMA, platforma: "telegram" })
  assertStringIncludes(tg, "Telegram sahifasining")
})

Deno.test("tarmoq ko'rsatilmasa YouTube deb hisoblanadi", () => {
  assertStringIncludes(promptYasa({ ...asos, sozlama: ZAXIRA_SOZLAMA }), "YouTube")
})

Deno.test("zaxira sozlamada hamma tarmoqda avtomatik rejim O'CHIQ", () => {
  // Bu qiymat kanal nomidan ommaviy matn chiqaradi — birorta ham
  // tarmoq sukut bo'yicha yoqilgan bo'lmasligi kerak
  for (const p of PLATFORMALAR) assertEquals(ZAXIRA_SOZLAMA.avto[p], false)
})
