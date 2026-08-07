import { javobYoz, sozlamalarOl } from "../izohJavob.ts"
import { izohlarniOl, javobYubor, tegilganlar, yozuvSaqla } from "../ytIzoh.ts"

/**
 * YOUTUBE IZOHLARIGA AVTOMATIK JAVOB — FON ISHI.
 *
 * Har yurishda: yangi izohlarni oladi, javob yozilmaganlarini ajratib
 * oladi, AI ga yozdiradi va YouTube'ga yuboradi.
 *
 * ⚠️ FAQAT SOZLAMA YOQILGAN BO'LSA ishlaydi. O'chiq bo'lsa hech
 * narsa qilmaydi va shuni aytadi. Bu ish kanal nomidan OMMAVIY matn
 * chiqaradi — uni tasodifan yoqib qo'yish mumkin bo'lmasligi kerak.
 *
 * Ruxsat `jobs` dispatcheri tomonidan tekshiriladi (cron maxfiy
 * kaliti yoki admin tokeni) — bu modul faqat ishni bajaradi.
 */

/**
 * BUTUN YURISH uchun vaqt chegarasi.
 *
 * Supabase edge funksiyani 150 soniyada uzadi. Bitta izohga AI
 * zanjiri 45 soniyagacha ketishi mumkin, ya'ni uchta sekin izoh
 * chegaraga yetkazadi. Uzilib qolgan yurish yomon emas (keyingi
 * yurish qolganini oladi), lekin YouTube'ga yuborilgan javob bazaga
 * yozilmay qolishi mumkin — o'shanda ikkinchi javob ketardi.
 *
 * Shuning uchun har izohdan OLDIN vaqt tekshiriladi va qolgan vaqt
 * bitta to'liq siklga yetmasa yurish tugatiladi.
 */
const ISH_BUDGET_MS = 100_000
/** Bitta izoh sikli (AI + yuborish) uchun eng yomon holat */
const BIR_SIKL_MS = 50_000

export async function run(): Promise<Record<string, unknown>> {
  const sozlama = await sozlamalarOl()
  if (!sozlama.avto) {
    return { otkazildi: true, sabab: "avtomatik rejim o'chiq (yt_izoh_avto)" }
  }

  const { ok, izohlar, xato, kanal } = await izohlarniOl(50)
  if (!ok) return { xato }

  /**
   * Tegmaydiganlar:
   *   - o'z izohimiz (kanal nomidan yozilgan)
   *   - ip yopilgan
   *   - kanal allaqachon javob bergan (qo'lda ham bo'lishi mumkin)
   */
  const nomzodlar = izohlar.filter((i) =>
    i.muallifKanal !== kanal && i.javobMumkin && !i.javobBerilgan
  )

  // Bazada izi bori — qoralamasi bor yoki o'tkazib yuborilgani
  const bor = await tegilganlar(nomzodlar.map((i) => i.id))
  const yangi = nomzodlar.filter((i) => !bor.has(i.id)).slice(0, sozlama.limit)

  const oxiri = Date.now() + ISH_BUDGET_MS
  let yuborildi = 0
  let otkazildi = 0
  let xatolar = 0
  let vaqtTugadi = false

  for (const izoh of yangi) {
    if (oxiri - Date.now() < BIR_SIKL_MS) { vaqtTugadi = true; break }

    const n = await javobYoz({
      izoh: izoh.matn,
      muallif: izoh.muallif,
      videoSarlavha: izoh.videoTitle,
      sozlama,
    })

    const asos = {
      comment_id: izoh.id,
      video_id: izoh.videoId,
      video_title: izoh.videoTitle,
      muallif: izoh.muallif,
      izoh: izoh.matn,
      izoh_vaqti: izoh.vaqt || null,
      avto: true,
    }

    if (n.holat === "otkaz") {
      await yozuvSaqla({ ...asos, holat: "otkazildi", sabab: n.sabab })
      otkazildi++
      continue
    }
    if (n.holat === "xato") {
      await yozuvSaqla({ ...asos, holat: "xato", sabab: n.sabab })
      xatolar++
      continue
    }

    /**
     * AVVAL YUBORAMIZ, KEYIN YOZAMIZ — teskarisi emas.
     *
     * Yuborishdan oldin "yuborildi" deb yozib qo'yilsa va yuborish
     * yiqilsa, izoh javobsiz qoladi va hech qachon qayta urinilmaydi.
     * Hozirgi tartibda eng yomon holat — baza yozuvi yo'qolishi, ya'ni
     * keyingi yurish o'sha izohni yana ko'radi. Lekin uni YouTube'ning
     * o'zi to'sadi: `javobBerilgan` tekshiruvi bizning javobimizni
     * ko'radi va ikkinchi marta yozilmaydi.
     */
    const y = await javobYubor(izoh.id, n.matn)
    if (y.ok) {
      await yozuvSaqla({
        ...asos,
        javob: n.matn,
        provayder: n.provayder,
        holat: "yuborildi",
        yuborilgan_at: new Date().toISOString(),
      })
      yuborildi++
    } else {
      /**
       * Javob matni SAQLANADI: AI uni qayta yozib bermasligi kerak
       * (token bekorga ketardi). Tahririyat panelda ko'radi va bir
       * bosishda qo'lda yuboradi.
       */
      await yozuvSaqla({ ...asos, javob: n.matn, provayder: n.provayder, holat: "xato", sabab: y.xato })
      xatolar++
    }
  }

  return {
    korildi: izohlar.length,
    yangi: yangi.length,
    yuborildi,
    otkazildi,
    xatolar,
    ...(vaqtTugadi ? { vaqtTugadi: true, izoh: "qolganlari keyingi yurishda" } : {}),
  }
}
