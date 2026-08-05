import { handleCors } from "../_shared/cors.ts"
import { requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"

/**
 * FON ISHLARI — YAGONA KIRISH NUQTASI.
 *
 * Ilgari har bir ish alohida edge funksiya edi: worker-rss-ingest,
 * worker-ai-draft, cron-news-publish va hokazo — jami 20 ta. Ularning
 * hech biri deploy qilinmagan va hech kim chaqirmasdi.
 *
 * NEGA BIRLASHTIRILDI
 * 1. Chegara. Supabase loyihada ~100 ta funksiyaga ruxsat beradi va
 *    biz 99 tada edik. Yigirmatasini alohida deploy qilish imkonsiz.
 * 2. Xavfsizlik. Ularning BIRORTASIDA avtorizatsiya tekshiruvi yo'q
 *    edi. Shundayligicha deploy qilinsa, internetda 20 ta himoyasiz
 *    nuqta paydo bo'lardi: bazaga yozadigan, AI ga pul sarflaydigan
 *    va tashqi manzillarni yuklab oladigan.
 * 3. Oltitasida `Deno.serve` umuman yo'q edi — ya'ni ular edge
 *    funksiya sifatida ishga ham tushmasdi.
 *
 * ISHLATISH
 *   POST /jobs?job=rss-ingest
 *   Sarlavha: `x-cron-secret: <CRON_SECRET>`   (pg_cron uchun)
 *   yoki admin/super_admin tokeni                (paneldan qo'lda)
 *
 * Modullar STATIK ro'yxatda: dinamik `import(o'zgaruvchi)` ni to'plovchi
 * ko'ra olmaydi va modul javobga qo'shilmay qolardi.
 */

const ISHLAR: Record<string, () => Promise<Record<string, unknown>>> = {
  "ai-categorize": () => import("../_shared/jobs/ai-categorize.ts"),
  "ai-draft": () => import("../_shared/jobs/ai-draft.ts"),
  "ai-news-engine": () => import("../_shared/jobs/ai-news-engine.ts"),
  "ai-seo": () => import("../_shared/jobs/ai-seo.ts"),
  "ai-summarize": () => import("../_shared/jobs/ai-summarize.ts"),
  "ai-translate": () => import("../_shared/jobs/ai-translate.ts"),
  "ai-validate": () => import("../_shared/jobs/ai-validate.ts"),
  "cleanup-deleted": () => import("../_shared/jobs/cleanup-deleted.ts"),
  "facebook-publish": () => import("../_shared/jobs/facebook-publish.ts"),
  "instagram-publish": () => import("../_shared/jobs/instagram-publish.ts"),
  /**
   * `media-process` ATAYLAB YO'Q.
   *
   * U `imageProcessor.ts` orqali `npm:sharp` ga bog'langan — bu
   * Node uchun yozilgan, C kutubxonasiga tayanadigan paket. Edge
   * muhitida u umuman yuklanmaydi, ya'ni ish har chaqiruvda import
   * bosqichidayoq yiqilardi. Ishlamaydigan yo'lni ro'yxatga qo'yish
   * "bor, lekin buzuq" degan yolg'on taassurot beradi.
   *
   * Rasm qayta ishlash kerak bo'lsa u alohida muhitda (Node server
   * yoki konteyner) ishlashi kerak.
   */
  "media-upload": () => import("../_shared/jobs/media-upload.ts"),
  "news-ingest": () => import("../_shared/jobs/news-ingest.ts"),
  "news-publish": () => import("../_shared/jobs/news-publish.ts"),
  "publish": () => import("../_shared/jobs/publish.ts"),
  "rss-ingest": () => import("../_shared/jobs/rss-ingest.ts"),
  "social-publish-scheduler": () => import("../_shared/jobs/social-publish-scheduler.ts"),
  "telegram-monitor": () => import("../_shared/jobs/telegram-monitor.ts"),
  "telegram-publish": () => import("../_shared/jobs/telegram-publish.ts"),
  "web-crawler": () => import("../_shared/jobs/web-crawler.ts"),
}

/**
 * Chaqiruvchi haqiqiy ekanini tekshiradi.
 *
 * Ikki yo'l: pg_cron maxfiy sarlavha bilan keladi, admin esa o'z
 * tokeni bilan. Ikkalasi ham bo'lmasa — rad etiladi.
 */
async function ruxsatBormi(req: Request): Promise<Response | null> {
  const maxfiy = Deno.env.get("CRON_SECRET") || ""
  if (maxfiy && req.headers.get("x-cron-secret") === maxfiy) return null

  const auth = await requireRole(req, "super_admin", "admin")
  return auth.response
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const url = new URL(req.url)
  const nom = url.searchParams.get("job") || ""

  // Ro'yxatni ko'rish uchun ham ruxsat kerak: ichki ishlar nomlari
  // tashqariga chiqib ketmasin
  const rad = await ruxsatBormi(req)
  if (rad) return rad

  if (!nom) return jsonResponse({ jobs: Object.keys(ISHLAR).sort() })
  const yukla = ISHLAR[nom]
  if (!yukla) return errorResponse(`Noma'lum ish: ${nom}`, 404)

  try {
    const mod = await yukla()
    // Ikki shakl bor: `run(req)` (Deno.serve dan ko'chirilganlari) va
    // `export default handler()` (hech qachon serve qilinmaganlari)
    const fn = (mod.run ?? mod.default) as
      | ((r: Request) => Promise<Response | unknown>)
      | undefined
    if (typeof fn !== "function") return errorResponse(`Ish ishga tushmaydi: ${nom}`, 500)

    const natija = await fn(req)
    if (natija instanceof Response) return natija
    return jsonResponse({ success: true, job: nom, natija: natija ?? null })
  } catch (e) {
    console.error(`jobs/${nom}:`, e instanceof Error ? e.message : e)
    return errorResponse(e instanceof Error ? e.message : "Ish bajarilmadi", 500)
  }
})
