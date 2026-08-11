import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { mosKeladi, normalize, shablonTanla, variantlar, type Shablon } from "./izohShablonMatn.ts"

/**
 * Shablon noto'g'ri mos kelsa, kanal nomidan BUTUNLAY BOSHQA savolga
 * javob chiqadi va buni hech kim tekshirmaydi (avtomatik rejim).
 * Shuning uchun chegaraviy holatlar shu yerda qotirilgan.
 */

Deno.test("normalize: o'zbek apostrofining hamma ko'rinishi bir xil bo'ladi", () => {
  const kutilgan = "o'g'it"
  assertEquals(normalize("o‘g‘it"), kutilgan)
  assertEquals(normalize("oʻgʻit"), kutilgan)
  assertEquals(normalize("oʼgʼit"), kutilgan)
  assertEquals(normalize("o`g`it"), kutilgan)
  assertEquals(normalize("O'G'IT"), kutilgan)
})

Deno.test("normalize: tinish belgisi va emoji bo'sh joyga aylanadi", () => {
  assertEquals(normalize("narxi qancha?!"), "narxi qancha")
  assertEquals(normalize("narxi   qancha 😊"), "narxi qancha")
  assertEquals(normalize("  Salom,   narx.  "), "salom narx")
})

Deno.test("mosKeladi: to'liq ibora izoh ichida uchraydi", () => {
  assertEquals(mosKeladi("narx qancha", "Salom, narx qancha aytasizmi?"), true)
})

Deno.test("mosKeladi: o'zbek qo'shimchalari to'sib qo'ymaydi", () => {
  // "narx" -> "narxi", "narxlari", "narxingiz"
  assertEquals(mosKeladi("narx", "Bu mahsulotning narxi qancha?"), true)
  assertEquals(mosKeladi("narx", "Narxlari qanday?"), true)
  assertEquals(mosKeladi("yetkazib berish", "Yetkazib berasizlarmi?"), false)
})

Deno.test("mosKeladi: hamma so'z bo'lishi shart, bittasi yetmaydi", () => {
  assertEquals(mosKeladi("hamkorlik narx", "Hamkorlik qilamizmi?"), false)
  assertEquals(mosKeladi("hamkorlik narx", "Hamkorlik narxi qancha?"), true)
})

Deno.test("mosKeladi: uch belgidan qisqa so'zlar hisobga olinmaydi", () => {
  // "va" har izohda bor — u bo'lmagani uchun mos kelmay qolmasin
  assertEquals(mosKeladi("narx va yetkazish", "Narxingiz va yetkazish haqida"), true)
})

Deno.test("mosKeladi: apostrof farqi to'sib qo'ymaydi", () => {
  assertEquals(mosKeladi("o'g'it", "Qaysi oʻgʻit yaxshi?"), true)
})

Deno.test("mosKeladi: bo'sh qiymatlar mos kelmaydi", () => {
  assertEquals(mosKeladi("", "narx qancha"), false)
  assertEquals(mosKeladi("narx", ""), false)
  assertEquals(mosKeladi("   ", "narx"), false)
})

Deno.test("mosKeladi: aloqasiz izohga YOPISHMAYDI", () => {
  assertEquals(mosKeladi("narx qancha", "Zo'r video, rahmat!"), false)
  assertEquals(mosKeladi("yetkazib berish", "Pomidor ekish haqida so'ramoqchiman"), false)
})

const sh = (id: string, savol: string, javob: string, platform: string | null = null, faol = true): Shablon =>
  ({ id, savol, javob, platform, faol })

Deno.test("shablonTanla: mos kelmasa null", () => {
  const r = shablonTanla([sh("1", "narx", "Narx haqida yozing")], "Zo'r video!", "youtube")
  assertEquals(r, null)
})

Deno.test("shablonTanla: o'chirilgan (faol=false) tanlanmaydi", () => {
  const r = shablonTanla([sh("1", "narx", "J", null, false)], "narxi qancha", "youtube")
  assertEquals(r, null)
})

Deno.test("shablonTanla: boshqa tarmoqning shabloni olinmaydi", () => {
  const r = shablonTanla([sh("1", "narx", "J", "telegram")], "narxi qancha", "youtube")
  assertEquals(r, null)
})

Deno.test("shablonTanla: tarmoqqa biriktirilgani umumiydan USTUN", () => {
  const r = shablonTanla([
    sh("1", "narx", "Umumiy javob", null),
    sh("2", "narx", "YouTube javobi", "youtube"),
  ], "narxi qancha", "youtube")
  assertEquals(r?.javob, "YouTube javobi")
})

Deno.test("variantlar: vergul, nuqtali vergul va yangi qator ajratadi", () => {
  assertEquals(variantlar("narx qancha, narxi qanday"), ["narx qancha", "narxi qanday"])
  assertEquals(variantlar("narx;qancha turadi"), ["narx", "qancha turadi"])
  assertEquals(variantlar("narx\nqancha turadi"), ["narx", "qancha turadi"])
  assertEquals(variantlar("  narx  ,  , qancha "), ["narx", "qancha"])
  assertEquals(variantlar(""), [])
})

Deno.test("mosKeladi: variantlardan BITTASI yetarli", () => {
  const savol = "narx qancha, narxi qanday, qancha turadi"
  assertEquals(mosKeladi(savol, "Salom, narx qancha?"), true)
  assertEquals(mosKeladi(savol, "Narxlaringiz qanday?"), true)
  assertEquals(mosKeladi(savol, "Bu qancha turadi?"), true)
  assertEquals(mosKeladi(savol, "Pomidor qachon ekiladi?"), false)
})

Deno.test("shablonTanla: mos kelgan ENG UZUN variant vazn beradi", () => {
  const r = shablonTanla([
    sh("1", "narx", "Umumiy narx"),
    sh("2", "salom, hamkorlik narxi", "Hamkorlik narxi"),
  ], "Salom, hamkorlik narxi qancha?", "youtube")
  // "hamkorlik narxi" (15) "narx" (4) dan uzun -> aniqrog'i tanlanadi
  assertEquals(r?.javob, "Hamkorlik narxi")
})

Deno.test("shablonTanla: savoli uzunrog'i (aniqrog'i) ustun", () => {
  const r = shablonTanla([
    sh("1", "narx", "Umumiy narx"),
    sh("2", "hamkorlik narx", "Hamkorlik narxi"),
  ], "Hamkorlik narxi qancha?", "youtube")
  assertEquals(r?.javob, "Hamkorlik narxi")
})

Deno.test("shablonTanla: bir xil vaznda natija BARQAROR (id bo'yicha)", () => {
  const a = sh("a", "narx", "Birinchi")
  const b = sh("b", "narx", "Ikkinchi")
  assertEquals(shablonTanla([a, b], "narxi qancha", "youtube")?.javob, "Birinchi")
  // Tartib almashsa ham natija o'zgarmasligi kerak
  assertEquals(shablonTanla([b, a], "narxi qancha", "youtube")?.javob, "Birinchi")
})
