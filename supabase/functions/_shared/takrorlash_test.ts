import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { keyingiVaqt, boshlanishVaqti, takrorYaroqli } from "./takrorlash.ts"

/**
 * TAKRORLANISH SANALARI.
 *
 * Bu yerdagi xato jimgina yuz beradi: TZ noto'g'ri kunda yaratiladi
 * yoki umuman yaratilmaydi, va buni faqat bir oydan keyin payqash
 * mumkin. Ayniqsa oylik takrorlanish xavfli — 31-yanvarning "keyingi
 * oyi" yo'q.
 */

const kun = (s: string) => new Date(s + "T09:00:00.000Z")
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

Deno.test("kunlik — ertangi kun", () => {
  assertEquals(iso(keyingiVaqt(kun("2026-08-05"), "kunlik")), "2026-08-06")
})

Deno.test("kunlik — oy chegarasidan o'tadi", () => {
  assertEquals(iso(keyingiVaqt(kun("2026-08-31"), "kunlik")), "2026-09-01")
})

Deno.test("kunlik — yil chegarasidan o'tadi", () => {
  assertEquals(iso(keyingiVaqt(kun("2026-12-31"), "kunlik")), "2027-01-01")
})

Deno.test("haftalik — yetti kun", () => {
  assertEquals(iso(keyingiVaqt(kun("2026-08-05"), "haftalik")), "2026-08-12")
})

Deno.test("haftalik — oy chegarasidan o'tadi", () => {
  assertEquals(iso(keyingiVaqt(kun("2026-08-28"), "haftalik")), "2026-09-04")
})

Deno.test("oylik — oddiy holat", () => {
  assertEquals(iso(keyingiVaqt(kun("2026-03-15"), "oylik")), "2026-04-15")
})

Deno.test("oylik — 31-yanvardan keyin FEVRAL, mart emas", () => {
  // Sodda `setUTCMonth(+1)` bu yerda 3-martga sakrab ketardi va
  // fevral oyi umuman o'tkazib yuborilardi
  assertEquals(iso(keyingiVaqt(kun("2026-01-31"), "oylik")), "2026-02-28")
})

Deno.test("oylik — kabisa yilida 29-fevral", () => {
  assertEquals(iso(keyingiVaqt(kun("2028-01-31"), "oylik")), "2028-02-29")
})

Deno.test("oylik — 31-maydan keyin 30-iyun", () => {
  assertEquals(iso(keyingiVaqt(kun("2026-05-31"), "oylik")), "2026-06-30")
})

Deno.test("oylik — yil chegarasidan o'tadi", () => {
  assertEquals(iso(keyingiVaqt(kun("2026-12-15"), "oylik")), "2027-01-15")
})

Deno.test("oylik — vaqt saqlanadi", () => {
  const d = keyingiVaqt(new Date("2026-03-15T14:30:00.000Z"), "oylik")
  assertEquals(d?.toISOString(), "2026-04-15T14:30:00.000Z")
})

Deno.test("bir marta — takror yo'q", () => {
  assertEquals(keyingiVaqt(kun("2026-08-05"), "bir_marta"), null)
})

/* ========================================================================
 * BOSHLANISH VAQTI
 * ==================================================================== */

Deno.test("boshlanish — tayyor kechikish", () => {
  const oldin = Date.now()
  const d = boshlanishVaqti("2soat", "")
  const farq = d.getTime() - oldin
  // Ikki soat ± bir soniya
  assertEquals(farq > 2 * 3600_000 - 1000 && farq < 2 * 3600_000 + 1000, true)
})

Deno.test("boshlanish — darhol", () => {
  const farq = Math.abs(boshlanishVaqti("darhol", "").getTime() - Date.now())
  assertEquals(farq < 1000, true)
})

Deno.test("boshlanish — aniq vaqt kechikishdan USTUN", () => {
  const d = boshlanishVaqti("2soat", "2026-09-01T08:00:00.000Z")
  assertEquals(d.toISOString(), "2026-09-01T08:00:00.000Z")
})

Deno.test("boshlanish — buzuq sana kechikishga qaytadi", () => {
  // Aks holda `new Date("shunchaki matn")` Invalid Date beradi va
  // bazaga null tushib, TZ umuman boshlanmasdi
  const farq = Math.abs(boshlanishVaqti("darhol", "shunchaki matn").getTime() - Date.now())
  assertEquals(farq < 1000, true)
})

Deno.test("takrorYaroqli — faqat ma'lum qiymatlar", () => {
  assertEquals(takrorYaroqli("kunlik"), true)
  assertEquals(takrorYaroqli("haftalik"), true)
  assertEquals(takrorYaroqli("oylik"), true)
  assertEquals(takrorYaroqli("bir_marta"), true)
  assertEquals(takrorYaroqli("har_soat"), false)
  assertEquals(takrorYaroqli(""), false)
  assertEquals(takrorYaroqli(null), false)
})
