import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"

/**
 * `translate.ts` -> `supabase.ts` zanjiri modul yuklanishida Supabase
 * mijozini yaratadi va muhit o'zgaruvchisi bo'lmasa YIQILADI. Sinovga
 * baza kerak emas, shuning uchun soxta qiymat qo'yib, modulni
 * DINAMIK import qilamiz — statik import bundan oldin bajarilardi.
 */
Deno.env.set("SUPABASE_URL", Deno.env.get("SUPABASE_URL") || "http://localhost:54321")
Deno.env.set(
  "SUPABASE_SERVICE_ROLE_KEY",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "sinov-kaliti",
)

const { guruhniAjrat } = await import("./translate.ts")

/**
 * Guruhlab tarjimaning ENG XAVFLI qismi — javobni yozuvlarga qaytarib
 * taqsimlash. Bu yerdagi xato bir kompaniyaning tavsifini boshqasiga
 * yozib yuborardi va buni ko'z bilan payqash deyarli imkonsiz: matn
 * to'g'ri tilda, grammatikasi joyida, faqat noto'g'ri yozuvda.
 */

Deno.test("uch yozuv, ikki til — har biri o'z joyiga tushadi", () => {
  const natija = guruhniAjrat({
    ru: { "0::title": "Ноль", "1::title": "Один", "2::name": "Два" },
    en: { "0::title": "Zero", "1::title": "One", "2::name": "Two" },
  }, 3, ["ru", "en"])

  assertEquals(natija.length, 3)
  assertEquals(natija[0], { ru: { title: "Ноль" }, en: { title: "Zero" } })
  assertEquals(natija[1], { ru: { title: "Один" }, en: { title: "One" } })
  assertEquals(natija[2], { ru: { name: "Два" }, en: { name: "Two" } })
})

Deno.test("bir yozuvda bir nechta maydon", () => {
  const natija = guruhniAjrat({
    ru: { "0::title": "Сарлавҳа", "0::excerpt": "Қисқача", "1::title": "Иккинчи" },
  }, 2, ["ru"])

  assertEquals(natija[0], { ru: { title: "Сарлавҳа", excerpt: "Қисқача" } })
  assertEquals(natija[1], { ru: { title: "Иккинчи" } })
})

Deno.test("model tashlab ketgan yozuv BO'SH qoladi — qo'shnisiga yozilmaydi", () => {
  const natija = guruhniAjrat({ ru: { "0::title": "Бор", "2::title": "Ҳам бор" } }, 3, ["ru"])

  assertEquals(natija[0], { ru: { title: "Бор" } })
  assertEquals(natija[1], {})            // tushib qolgan
  assertEquals(natija[2], { ru: { title: "Ҳам бор" } })
})

Deno.test("buzuq kalitlar tashlanadi, to'g'rilari qoladi", () => {
  const natija = guruhniAjrat({
    ru: {
      "0::title": "Yaxshi",
      "title": "ajratkichsiz",       // ajratkich yo'q
      "a::title": "harfli indeks",   // raqam emas
      "9::title": "chegaradan tashqari",
      "-1::title": "manfiy",
      "1::": "maydonsiz",
    },
  }, 2, ["ru"])

  assertEquals(natija[0], { ru: { title: "Yaxshi" } })
  assertEquals(natija[1], {})
})

Deno.test("maydon nomi ichida ikki nuqta bo'lsa ham buzilmaydi", () => {
  // Ajratish BIRINCHI "::" bo'yicha — qolgani maydon nomiga tegishli
  const natija = guruhniAjrat({ ru: { "0::meta::title": "Qiymat" } }, 1, ["ru"])
  assertEquals(natija[0], { ru: { "meta::title": "Qiymat" } })
})

Deno.test("javobda yo'q til qo'shilmaydi", () => {
  const natija = guruhniAjrat({ ru: { "0::title": "Бор" } }, 1, ["ru", "en", "zh"])
  assertEquals(natija[0], { ru: { title: "Бор" } })
})

Deno.test("bo'sh javob — hamma yozuv bo'sh", () => {
  const natija = guruhniAjrat({}, 4, ["ru", "en", "zh"])
  assertEquals(natija, [{}, {}, {}, {}])
})
