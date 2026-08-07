import { supabaseAdmin } from "./supabase.ts"
import type { UmumIzoh } from "./izohTur.ts"

/**
 * TELEGRAM KANALIDAGI IZOHLAR.
 *
 * ⚠️ TELEGRAM BOSHQA TARMOQLARDAN TUBDAN FARQ QILADI.
 *
 * Telegram kanalida "izoh" degan narsa yo'q. Izohlar aslida
 * MUHOKAMA GURUHIDAGI xabarlar: kanalga ulangan guruh bo'lsa, har
 * post o'sha guruhga avtomatik ko'chiriladi va odamlar unga javob
 * yozadi. Ya'ni ishlashi uchun uchta shart bor:
 *
 *   1. kanalga muhokama guruhi ULANGAN bo'lishi kerak
 *      (Telegram: kanal sozlamalari -> Muhokama);
 *   2. bot o'sha GURUHDA bo'lishi kerak (admin qilib qo'yish eng
 *      ishonchlisi);
 *   3. botning "privacy mode" i O'CHIQ bo'lishi kerak (@BotFather ->
 *      /setprivacy -> Disable), aks holda bot guruhdagi xabarlarni
 *      umuman ko'rmaydi.
 *
 * Bironta shart bajarilmasa xabarlar shunchaki KELMAYDI — Telegram
 * xato ham qaytarmaydi. Shuning uchun quyida har bosqichda aniq sabab
 * qaytariladi, "izoh topilmadi" degan foydasiz javob emas.
 *
 * ⚠️ OFFSET. `getUpdates` o'qilgan yangilanishni O'CHIRADI: keyingi
 * so'rovda `offset` oshirilsa ular boshqa kelmaydi. Shuning uchun
 * offset bazaga yoziladi. Bu shuni ham anglatadiki, botning
 * yangilanishlarini boshqa hech kim o'qimasligi kerak — loyihada
 * webhook o'rnatilmagan, ya'ni muammo yo'q.
 */

const API = (token: string) => `https://api.telegram.org/bot${token}`

type TgKonfig = { chat_id?: string; izoh_guruh?: number; izoh_offset?: number }

async function konfigOl(): Promise<TgKonfig> {
  const { data } = await supabaseAdmin
    .from("smm_connections").select("config").eq("platform", "telegram").maybeSingle()
  return (data?.config || {}) as TgKonfig
}

async function konfigYoz(yangi: TgKonfig): Promise<void> {
  const eski = await konfigOl()
  await supabaseAdmin.from("smm_connections").upsert({
    platform: "telegram",
    config: { ...eski, ...yangi },
    updated_at: new Date().toISOString(),
  }, { onConflict: "platform" })
}

function token(): string {
  return Deno.env.get("TELEGRAM_BOT_TOKEN") || ""
}

async function tg(
  metod: string,
  q: Record<string, string | number>,
): Promise<{ ok: boolean; natija: any; xato: string }> {
  const t = token()
  if (!t) return { ok: false, natija: null, xato: "Telegram bot tokeni sozlanmagan" }
  try {
    const r = await fetch(`${API(t)}/${metod}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(q),
      signal: AbortSignal.timeout(20_000),
    })
    const d = await r.json().catch(() => ({}))
    if (!d?.ok) {
      /**
       * 409 — botga webhook o'rnatilgan. `getUpdates` va webhook bir
       * vaqtda ishlamaydi. Bu xato o'z-o'zidan tushunarsiz, aniq
       * aytamiz.
       */
      const tavsif = String(d?.description || `Telegram xatosi (${r.status})`)
      const aniq = /webhook is active/i.test(tavsif)
        ? "Botga webhook o'rnatilgan — izohlarni o'qib bo'lmaydi (deleteWebhook kerak)"
        : tavsif
      return { ok: false, natija: null, xato: aniq }
    }
    return { ok: true, natija: d.result, xato: "" }
  } catch (e) {
    return { ok: false, natija: null, xato: e instanceof Error ? e.message : "tarmoq xatosi" }
  }
}

/**
 * Muhokama guruhining ID sini topadi.
 *
 * Kanal sozlamasidan (`chat_id`) `getChat` orqali `linked_chat_id`
 * olinadi va SAQLAB QO'YILADI — har yurishda qayta so'ramaslik uchun.
 */
async function guruhId(): Promise<{ id: number; xato: string }> {
  const cfg = await konfigOl()
  if (cfg.izoh_guruh) return { id: cfg.izoh_guruh, xato: "" }

  if (!cfg.chat_id) return { id: 0, xato: "Telegram kanali sozlanmagan" }
  const r = await tg("getChat", { chat_id: cfg.chat_id })
  if (!r.ok) return { id: 0, xato: r.xato }

  const linked = Number(r.natija?.linked_chat_id || 0)
  if (!linked) {
    return {
      id: 0,
      xato: "Kanalga muhokama guruhi ulanmagan — izohlar Telegram'da shu guruh orqali ishlaydi",
    }
  }
  await konfigYoz({ izoh_guruh: linked })
  return { id: linked, xato: "" }
}

/**
 * Muhokama guruhidagi yangi xabarlar.
 *
 * ⚠️ O'QILGAN YANGILANISH YO'QOLADI. Shuning uchun offset FAQAT
 * hammasi qayta ishlangandan keyin oshiriladi (`offsetSaqla`), ro'yxat
 * ko'rilgan zahoti emas: panel ro'yxatni ochib yopsa, izohlar
 * yo'qolib ketmasligi kerak.
 */
export async function telegramIzohlar(limit: number): Promise<{ ok: boolean; izohlar: UmumIzoh[]; xato: string }> {
  const g = await guruhId()
  if (!g.id) return { ok: false, izohlar: [], xato: g.xato }

  const cfg = await konfigOl()
  const r = await tg("getUpdates", {
    offset: cfg.izoh_offset || 0,
    limit: 100,
    timeout: 0,
    allowed_updates: JSON.stringify(["message"]),
  })
  if (!r.ok) return { ok: false, izohlar: [], xato: r.xato }

  // Shu yurishda ko'rilgan eng katta update_id — offsetni oshirish uchun
  oxirgiKorilgan = ((r.natija as Record<string, any>[]) || [])
    .reduce((m, u) => Math.max(m, Number(u.update_id || 0)), 0)

  const izohlar: UmumIzoh[] = []
  for (const u of (r.natija as Record<string, any>[]) || []) {
    const m = u.message
    if (!m || Number(m.chat?.id) !== g.id) continue
    // Kanal postining guruhga avtomatik ko'chirilgani — izoh emas, POST
    if (m.is_automatic_forward) continue
    // Botning o'z xabari (bizning javobimiz)
    const bot = Boolean(m.from?.is_bot)
    const matn = String(m.text || m.caption || "")
    if (!matn) continue

    const asos = m.reply_to_message
    izohlar.push({
      id: String(m.message_id),
      postId: String(asos?.forward_from_message_id || asos?.message_id || ""),
      postTitle: String(asos?.text || asos?.caption || "").replace(/\s+/g, " ").slice(0, 120),
      havola: "",
      muallif: [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" ") ||
        String(m.from?.username || "—"),
      ozimizmi: bot,
      matn,
      vaqt: m.date ? new Date(Number(m.date) * 1000).toISOString() : "",
      yoqtirish: 0,
      javobMumkin: true,
      /**
       * Telegram javob berilganini AYTMAYDI: guruhdagi xabar ostida
       * "javoblar" tuzilmasi yo'q. Faqat bazadagi yozuvimizga
       * tayanamiz — qo'lda yozilgan javob hisobga olinmaydi.
       */
      javobBerilgan: false,
    })
  }

  izohlar.sort((a, b) => (b.vaqt || "").localeCompare(a.vaqt || ""))
  return { ok: true, izohlar: izohlar.slice(0, limit), xato: "" }
}

/**
 * Oxirgi `telegramIzohlar` chaqiruvida ko'rilgan eng katta update_id.
 *
 * Modul darajasida, chunki bitta chaqiruv ichida ishlatiladi:
 * ro'yxat olinadi -> qayta ishlanadi -> offset saqlanadi. Ikkinchi
 * marta `getUpdates` chaqirish bekorga so'rov bo'lardi.
 */
let oxirgiKorilgan = 0

/**
 * Ko'rib bo'lingan yangilanishlarni yopadi.
 *
 * FAQAT avtomatik yurish OXIRIDA chaqiriladi. Panel ro'yxatni
 * ochganda chaqirilmaydi: aks holda tahririyat ro'yxatni bir marta
 * ochib yopsa, javob berilmagan izohlar butunlay yo'qolib ketardi —
 * `getUpdates` o'qilgan yangilanishni qaytarmaydi.
 */
export async function telegramOffsetSaqla(): Promise<void> {
  if (!oxirgiKorilgan) return
  await konfigYoz({ izoh_offset: oxirgiKorilgan + 1 })
}

export async function telegramJavob(messageId: string, matn: string): Promise<{ ok: boolean; xato: string }> {
  const g = await guruhId()
  if (!g.id) return { ok: false, xato: g.xato }
  const r = await tg("sendMessage", {
    chat_id: g.id,
    reply_to_message_id: Number(messageId),
    text: matn.slice(0, 4000),
  })
  return r.ok ? { ok: true, xato: "" } : { ok: false, xato: r.xato }
}
