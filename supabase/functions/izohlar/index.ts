import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { javobYoz, sozlamaYoz, sozlamalarOl } from "../_shared/izohJavob.ts"
import { PLATFORMALAR, type Platforma } from "../_shared/izohMatn.ts"
import { manbaOl } from "../_shared/izohManba.ts"
import { holatOl, yozuvSaqla, yozuvlarOl } from "../_shared/izohBaza.ts"
import { shablonOchir, shablonSaqla, shablonlarOl } from "../_shared/izohShablon.ts"

/**
 * IZOHLARGA JAVOB — BARCHA TARMOQLAR.
 *
 *   GET  ?action=list&platform=   — izohlar + bizning javob holatimiz
 *   POST ?action=draft            — bitta izohga AI javob yozdirish
 *   POST ?action=send             — javobni tarmoqqa yuborish
 *   POST ?action=skip             — bu izohga javob berilmasin
 *   POST ?action=config           — sozlamalarni yozish
 *
 * NEGA ALOHIDA FUNKSIYA: dastlab bu amallar `youtube-manage` ichida
 * edi, lekin endi ular Instagram, Facebook va Telegram uchun ham
 * ishlaydi — "youtube-manage" nomi yolg'on bo'lib qolardi va kod
 * o'qigan odam izohlar faqat YouTube'da ishlaydi deb o'ylardi.
 *
 * Tarmoqqa bog'liq qism faqat ikkita amal (`izohManba.ts`), qolgani —
 * AI, tekshiruvlar, baza va takrorga qarshi himoya — umumiy.
 */

function matn(v: unknown, chegara: number): string {
  return String(v ?? "").trim().slice(0, chegara)
}

/** So'rovdagi tarmoq nomi — noma'lumi rad etiladi */
function platformaOl(v: string): Platforma | null {
  return (PLATFORMALAR as readonly string[]).includes(v) ? (v as Platforma) : null
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  // Izohlarni faqat tahririyat boshqaradi
  const auth = await requireRole(req, "super_admin", "admin", "editor")
  if (auth.response) return auth.response

  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "list"

  try {
    /* ---------------- Ro'yxat ---------------- */
    if (action === "list" && req.method === "GET") {
      const p = platformaOl(url.searchParams.get("platform") || "youtube")
      if (!p) return errorResponse("Noma'lum tarmoq", 400)

      const sozlama = await sozlamalarOl()
      const { ok, izohlar, xato } = await manbaOl(p).izohlar(50)
      if (!ok) return jsonResponse({ platform: p, izohlar: [], sozlama, xato })

      // O'z izohimizga javob yozishning ma'nosi yo'q
      const korinadi = izohlar.filter((i) => !i.ozimizmi)
      const yozuvlar = await yozuvlarOl(p, korinadi.map((i) => i.id))

      return jsonResponse({
        platform: p,
        sozlama,
        izohlar: korinadi.map((i) => ({ ...i, yozuv: yozuvlar.get(i.id) || null })),
      })
    }

    /* ---------------- AI qoralama ---------------- */
    /**
     * Javob matnini yozdiradi, lekin TARMOQQA YUBORMAYDI —
     * tahririyat avval o'qib chiqadi.
     */
    if (action === "draft" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const p = platformaOl(matn(body.platform, 20))
      const id = matn(body.commentId, 120)
      const izoh = matn(body.izoh, 1500)
      if (!p) return errorResponse("Noma'lum tarmoq", 400)
      if (!id || !izoh) return errorResponse("Izoh ID va matni kerak", 400)

      const sozlama = await sozlamalarOl()
      const n = await javobYoz({
        izoh,
        muallif: matn(body.muallif, 60),
        videoSarlavha: matn(body.postTitle, 120),
        sozlama,
        platforma: p,
      })

      const asos = {
        platform: p,
        comment_id: id,
        video_id: matn(body.postId, 60) || "—",
        video_title: matn(body.postTitle, 200),
        muallif: matn(body.muallif, 100),
        izoh,
        izoh_vaqti: matn(body.vaqt, 40) || null,
        avto: false,
      }

      if (n.holat === "javob") {
        await yozuvSaqla({ ...asos, javob: n.matn, provayder: n.provayder, holat: "qoralama", sabab: null })
        return jsonResponse({ holat: "qoralama", javob: n.matn, provayder: n.provayder })
      }
      if (n.holat === "otkaz") {
        await yozuvSaqla({ ...asos, holat: "otkazildi", sabab: n.sabab })
        return jsonResponse({ holat: "otkazildi", sabab: n.sabab })
      }
      return errorResponse(n.sabab, 502)
    }

    /* ---------------- Yuborish ---------------- */
    /**
     * Matn TANADAN olinadi, bazadan emas: tahririyat AI yozganini
     * tahrirlagan bo'lishi mumkin va aynan tahrirlangani ketishi
     * kerak.
     */
    if (action === "send" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const p = platformaOl(matn(body.platform, 20))
      const id = matn(body.commentId, 120)
      const javob = matn(body.javob, 2000)
      if (!p) return errorResponse("Noma'lum tarmoq", 400)
      if (!id || !javob) return errorResponse("Izoh ID va javob matni kerak", 400)

      /**
       * IKKI MARTA YUBORILMASIN.
       *
       * Brauzerda tugma bosilgach bloklanadi, lekin bu yetarli emas:
       * ikkita oyna ochiq bo'lishi, so'rov qayta ketishi yoki
       * avtomatik yurish bilan ustma-ust tushishi mumkin. Bir izoh
       * ostida kanalning ikkita javobi — ko'zga tashlanadigan xato.
       */
      if (await holatOl(p, id) === "yuborildi") {
        return errorResponse("Bu izohga javob allaqachon yuborilgan", 409)
      }

      const asos = {
        platform: p,
        comment_id: id,
        video_id: matn(body.postId, 60) || "—",
        video_title: matn(body.postTitle, 200),
        muallif: matn(body.muallif, 100),
        izoh: matn(body.izoh, 1500) || "—",
        javob,
        avto: false,
      }

      const y = await manbaOl(p).javob(id, javob)
      if (!y.ok) {
        await yozuvSaqla({ ...asos, holat: "xato", sabab: y.xato })
        return errorResponse(y.xato, 400)
      }
      await yozuvSaqla({ ...asos, holat: "yuborildi", sabab: null, yuborilgan_at: new Date().toISOString() })
      return jsonResponse({ success: true })
    }

    /* ---------------- O'tkazib yuborish ---------------- */
    /**
     * "Bu izohga javob kerak emas" — avtomatik yurish uni boshqa
     * ko'rmasin. Aks holda har soatda AI bir xil izohni qayta ko'rib
     * bekorga token sarflardi.
     */
    if (action === "skip" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const p = platformaOl(matn(body.platform, 20))
      const id = matn(body.commentId, 120)
      if (!p) return errorResponse("Noma'lum tarmoq", 400)
      if (!id) return errorResponse("Izoh ID kerak", 400)

      await yozuvSaqla({
        platform: p,
        comment_id: id,
        video_id: matn(body.postId, 60) || "—",
        video_title: matn(body.postTitle, 200),
        muallif: matn(body.muallif, 100),
        izoh: matn(body.izoh, 1500) || "—",
        holat: "otkazildi",
        sabab: "tahririyat o'tkazib yubordi",
        avto: false,
      })
      return jsonResponse({ success: true })
    }

    /* ---------------- Sozlamalar ---------------- */
    if (action === "config" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const yozildi: string[] = []
      for (const [k, v] of Object.entries(body || {})) {
        if (await sozlamaYoz(k, String(v ?? "").slice(0, 1000))) yozildi.push(k)
      }
      if (yozildi.length === 0) return errorResponse("O'zgartiriladigan sozlama topilmadi", 400)
      return jsonResponse({ success: true, sozlama: await sozlamalarOl() })
    }

    /* ---------------- Tayyor javoblar (shablonlar) ----------------
     *
     * Ikkita maydon: `savol` — izohda nima yozilsa, `javob` — nima
     * javob berish. Mos kelgan izohga AI umuman chaqirilmaydi
     * (qarang: izohJavob.ts).
     */
    if (action === "shablon_list") {
      return jsonResponse({ shablonlar: await shablonlarOl() })
    }

    if (action === "shablon_saqla" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const r = await shablonSaqla({
        id: matn(body.id, 40) || undefined,
        savol: matn(body.savol, 300),
        javob: matn(body.javob, 1000),
        platform: body.platform,
        faol: body.faol === undefined ? true : Boolean(body.faol),
        user: auth.user.id,
      })
      if (!r.ok) return errorResponse(r.xato || "Saqlab bo'lmadi", 400)
      return jsonResponse({ success: true, shablonlar: await shablonlarOl() })
    }

    if (action === "shablon_ochir" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const id = matn(body.id, 40)
      if (!id) return errorResponse("ID kerak", 400)
      if (!(await shablonOchir(id))) return errorResponse("Shablon topilmadi", 404)
      return jsonResponse({ success: true, shablonlar: await shablonlarOl() })
    }

    return errorResponse("Noma'lum amal", 400)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Xatolik yuz berdi", 500)
  }
})
