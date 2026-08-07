import { javobYoz, sozlamalarOl } from "../izohJavob.ts"
import { PLATFORMALAR, type Platforma } from "../izohMatn.ts"
import { manbaOl } from "../izohManba.ts"
import { tegilganlar, yozuvSaqla } from "../izohBaza.ts"

/**
 * IZOHLARGA AVTOMATIK JAVOB — FON ISHI.
 *
 * Har yurishda, AVTOMATIK REJIMI YOQILGAN har bir tarmoq uchun:
 * yangi izohlarni oladi, javob berilmaganlarini ajratadi, AI ga
 * yozdiradi va yuboradi.
 *
 * ⚠️ Tarmoqning rejimi o'chiq bo'lsa u UMUMAN so'ralmaydi: kanal
 * nomidan ommaviy matn chiqaradigan ishni tasodifan yoqib qo'yish
 * mumkin bo'lmasligi kerak. Hech qaysi tarmoq yoqilmagan bo'lsa
 * ish darhol qaytadi va bironta tashqi so'rov yubormaydi.
 *
 * Ruxsat `jobs` dispatcheri tomonidan tekshiriladi (cron maxfiy
 * kaliti yoki admin tokeni) — bu modul faqat ishni bajaradi.
 */

/**
 * BUTUN YURISH uchun vaqt chegarasi.
 *
 * Supabase edge funksiyani 150 soniyada uzadi. Bitta izohga AI
 * zanjiri 45 soniyagacha ketishi mumkin. Uzilib qolgan yurish yomon
 * emas (keyingisi qolganini oladi), lekin tarmoqqa yuborilgan javob
 * bazaga yozilmay qolishi mumkin — o'shanda ikkinchi javob ketardi.
 *
 * Shuning uchun har izohdan OLDIN vaqt tekshiriladi va qolgan vaqt
 * bitta to'liq siklga yetmasa yurish tugatiladi.
 */
const ISH_BUDGET_MS = 110_000
/** Bitta izoh sikli (AI + yuborish) uchun eng yomon holat */
const BIR_SIKL_MS = 50_000

type Natija = { yuborildi: number; otkazildi: number; xatolar: number; korildi: number; xato?: string }

async function tarmoqniYurgiz(
  p: Platforma,
  sozlama: Awaited<ReturnType<typeof sozlamalarOl>>,
  oxiri: number,
): Promise<Natija> {
  const bosh: Natija = { yuborildi: 0, otkazildi: 0, xatolar: 0, korildi: 0 }
  const manba = manbaOl(p)

  const { ok, izohlar, xato } = await manba.izohlar(50)
  if (!ok) return { ...bosh, xato }
  bosh.korildi = izohlar.length

  // O'z izohimiz va yopiq iplar tashlab yuboriladi
  const nomzodlar = izohlar.filter((i) => !i.ozimizmi && i.javobMumkin && !i.javobBerilgan)
  const bor = await tegilganlar(p, nomzodlar.map((i) => i.id))
  const yangi = nomzodlar.filter((i) => !bor.has(i.id)).slice(0, sozlama.limit)

  for (const izoh of yangi) {
    if (oxiri - Date.now() < BIR_SIKL_MS) break

    const n = await javobYoz({
      izoh: izoh.matn,
      muallif: izoh.muallif,
      videoSarlavha: izoh.postTitle,
      sozlama,
      platforma: p,
    })

    const asos = {
      platform: p,
      comment_id: izoh.id,
      video_id: izoh.postId || "—",
      video_title: izoh.postTitle,
      muallif: izoh.muallif,
      izoh: izoh.matn,
      izoh_vaqti: izoh.vaqt || null,
      avto: true,
    }

    if (n.holat === "otkaz") {
      await yozuvSaqla({ ...asos, holat: "otkazildi", sabab: n.sabab })
      bosh.otkazildi++
      continue
    }
    if (n.holat === "xato") {
      await yozuvSaqla({ ...asos, holat: "xato", sabab: n.sabab })
      bosh.xatolar++
      continue
    }

    /**
     * AVVAL YUBORAMIZ, KEYIN YOZAMIZ — teskarisi emas.
     *
     * Yuborishdan oldin "yuborildi" deb yozib qo'yilsa va yuborish
     * yiqilsa, izoh javobsiz qolib hech qachon qayta urinilmaydi.
     * Hozirgi tartibda eng yomon holat — baza yozuvi yo'qolishi, ya'ni
     * keyingi yurish o'sha izohni yana ko'radi. Uni esa tarmoqning
     * o'zi to'sadi: `javobBerilgan` bizning javobimizni ko'radi.
     * (Telegram bundan mustasno — pastdagi izohga qarang.)
     */
    const y = await manba.javob(izoh.id, n.matn)
    if (y.ok) {
      await yozuvSaqla({
        ...asos,
        javob: n.matn,
        provayder: n.provayder,
        holat: "yuborildi",
        yuborilgan_at: new Date().toISOString(),
      })
      bosh.yuborildi++
    } else {
      /**
       * Javob matni SAQLANADI: AI uni qayta yozib bermasligi kerak
       * (token bekorga ketardi). Tahririyat panelda ko'radi va bir
       * bosishda qo'lda yuboradi.
       */
      await yozuvSaqla({ ...asos, javob: n.matn, provayder: n.provayder, holat: "xato", sabab: y.xato })
      bosh.xatolar++
    }
  }

  /**
   * Telegram uchun: o'qilgan yangilanishlarni yopamiz. Faqat SHU
   * YERDA — hammasi qayta ishlangandan keyin. Ro'yxat olingan zahoti
   * yopilsa, vaqt tugab qolgan holatda javob berilmagan izohlar
   * butunlay yo'qolib ketardi.
   */
  if (manba.yakunla) await manba.yakunla()

  return bosh
}

export async function run(): Promise<Record<string, unknown>> {
  const sozlama = await sozlamalarOl()
  const yoqilgan = PLATFORMALAR.filter((p) => sozlama.avto[p])
  if (yoqilgan.length === 0) {
    return { otkazildi: true, sabab: "hech bir tarmoqda avtomatik rejim yoqilmagan" }
  }

  const oxiri = Date.now() + ISH_BUDGET_MS
  const natija: Record<string, Natija> = {}
  for (const p of yoqilgan) {
    // Vaqt tugagan bo'lsa qolgan tarmoqlar keyingi yurishda
    if (oxiri - Date.now() < BIR_SIKL_MS) {
      natija[p] = { yuborildi: 0, otkazildi: 0, xatolar: 0, korildi: 0, xato: "vaqt tugadi — keyingi yurishda" }
      continue
    }
    natija[p] = await tarmoqniYurgiz(p, sozlama, oxiri)
  }
  return natija
}
