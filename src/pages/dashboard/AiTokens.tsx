import { useCallback, useEffect, useState } from "react"
import { Icon, I } from "../../lib/ui"
import { api } from "../../lib/api"
import { tr } from "../../lib/i18n"

/**
 * AI KALITLARI VA KVOTASI.
 *
 * MUAMMO EDI: AI ishlamay qolganda sabab ko'rinmasdi. Kvota tugadimi,
 * kalit noto'g'rimi, provayder yiqildimi — bilib bo'lmasdi, chunki
 * edge funksiya loglarini panelda o'qish imkoni yo'q. Kalitni
 * almashtirish uchun ham terminal va qayta deploy kerak edi.
 *
 * Endi muharrir shu yerdan ko'radi: qaysi provayder ulangan, bugun
 * qancha ishlatilgan, qancha qolgan, oxirgi xato nima. Yangi kalit
 * shu yerdan qo'shiladi va darhol ishlaydi.
 *
 * KALIT HECH QACHON ORQAGA QAYTMAYDI: serverdan faqat oxirgi 4 belgi
 * keladi. Kalitning o'zi Vault'da shifrlangan yotadi.
 */

type Provayder = {
  kalit: string
  nom: string
  olish: string
  panelda: boolean
  envda: boolean
  ulangan: boolean
  kunlik: number
  bugun: number
  qolgan: number
  hafta: number
  xato: number
  oxirgiXato: string | null
  tokenlar: number
}

type Kalit = {
  id: string
  provayder: string
  nom: string
  oxirgi4: string
  faol: boolean
  ishlatilgan: string | null
  oxirgiXato: string | null
  created_at: string
}

type Korsatma = { kalit: string; nom: string; izoh: string; matn: string }

type Holat = {
  provayderlar: Provayder[]
  kalitlar: Kalit[]
  vazifalar: { nom: string; soni: number; xato: number }[]
  kesh: { yozuvlar: number }
  jami: { hafta: number; xato: number; tokenlar: number }
  korsatmalar: Korsatma[]
}

const VAZIFA_NOM: Record<string, string> = {
  translate: "Tarjima",
  "comment-analysis": "Izoh tahlili",
  analyze: "SMM tahlili",
  generate: "Kontent yaratish",
  describe: "Rasm tavsifi",
  chat: "Maslahatchi",
  market: "Bozor tahlili",
  cover: "Muqova",
  transcribe: "Transkripsiya",
}

function son(n: number): string {
  return n.toLocaleString("uz-UZ")
}

export default function AiTokens() {
  const [holat, setHolat] = useState<Holat | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [xato, setXato] = useState("")

  // Qo'shish formasi: qaysi provayder uchun ochilgani
  const [ochiq, setOchiq] = useState<string | null>(null)
  const [yangiKalit, setYangiKalit] = useState("")
  const [yangiNom, setYangiNom] = useState("")
  const [band, setBand] = useState(false)
  const [ochirilyapti, setOchirilyapti] = useState<string | null>(null)

  // Qo'shimcha ko'rsatmalar: bo'lim yopiq turadi (kundalik ish emas),
  // tahrir esa saqlanmaguncha faqat qoralamada qoladi
  const [korsatmaOchiq, setKorsatmaOchiq] = useState(false)
  const [qoralama, setQoralama] = useState<Record<string, string>>({})

  const yukla = useCallback(async () => {
    try {
      setXato("")
      const d = await api<Holat>("/smm/ai?action=ai_holat", { method: "POST", body: "{}" })
      setHolat(d)
    } catch (e) {
      setXato(e instanceof Error ? e.message : tr("Ma'lumotni yuklab bo'lmadi"))
    } finally {
      setYuklanmoqda(false)
    }
  }, [])

  useEffect(() => { void yukla() }, [yukla])

  const qosh = async (provayder: string) => {
    if (yangiKalit.trim().length < 8) { setXato(tr("Kalit juda qisqa")); return }
    setBand(true)
    try {
      setXato("")
      const d = await api<Holat>("/smm/ai?action=ai_kalit_qosh", {
        method: "POST",
        body: JSON.stringify({ provayder, qiymat: yangiKalit.trim(), nom: yangiNom.trim() }),
      })
      setHolat(d)
      setOchiq(null); setYangiKalit(""); setYangiNom("")
    } catch (e) {
      setXato(e instanceof Error ? e.message : tr("Kalitni saqlab bo'lmadi"))
    } finally { setBand(false) }
  }

  const ochir = async (id: string) => {
    setBand(true)
    try {
      setXato("")
      const d = await api<Holat>("/smm/ai?action=ai_kalit_ochir", {
        method: "POST", body: JSON.stringify({ id }),
      })
      setHolat(d)
      setOchirilyapti(null)
    } catch (e) {
      setXato(e instanceof Error ? e.message : tr("Kalitni o'chirib bo'lmadi"))
    } finally { setBand(false) }
  }

  const korsatmaSaqla = async (vazifa: string, matn: string) => {
    setBand(true)
    try {
      setXato("")
      const d = await api<Holat>("/smm/ai?action=ai_korsatma_saqla", {
        method: "POST", body: JSON.stringify({ vazifa, matn }),
      })
      setHolat(d)
      // Saqlangach qoralama keraksiz — serverdagi qiymat ko'rsatiladi
      setQoralama((q) => { const n = { ...q }; delete n[vazifa]; return n })
    } catch (e) {
      setXato(e instanceof Error ? e.message : tr("Ko'rsatmani saqlab bo'lmadi"))
    } finally { setBand(false) }
  }

  if (yuklanmoqda) {
    return (
      <div className="mt-5 rounded-2xl border border-green/10 bg-white p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-50" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold">{tr("AI kalitlari va kvota")}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {tr("Qaysi provayder ulangan, bugun qancha ishlatilgan va qancha qolgan")}
          </p>
        </div>
        <button type="button" onClick={() => void yukla()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green/20 px-3 py-1.5 text-xs font-bold text-muted transition-colors hover:text-green">
          <Icon d={I.refresh} className="h-3.5 w-3.5" /> {tr("Yangilash")}
        </button>
      </div>

      {xato && (
        <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">{xato}</p>
      )}

      {/* ---- Provayderlar ---- */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {holat?.provayderlar.map((p) => {
          // Chiziq kvotaning qancha qismi ishlatilganini ko'rsatadi.
          // 100% dan oshib ketmasin — chegara taxminiy, haqiqiy sarf
          // undan ko'p bo'lishi mumkin.
          const foiz = Math.min(100, Math.round((p.bugun / Math.max(1, p.kunlik)) * 100))
          const ogohlik = foiz >= 80
          return (
            <div key={p.kalit}
              className={`rounded-xl border p-4 ${p.ulangan ? "border-green/15" : "border-gray-200 bg-gray-50/50"}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate font-display text-sm font-bold">{p.nom}</span>
                  <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    p.ulangan ? "bg-green/10 text-green" : "bg-gray-100 text-gray-500"}`}>
                    {p.ulangan ? tr("Ulangan") : tr("Ulanmagan")}
                  </span>
                </span>
                {p.ulangan && !p.panelda && (
                  // Muhit o'zgaruvchisidagi kalit paneldan o'chirilmaydi —
                  // buni aytib qo'yish kerak, aks holda "nega o'chmayapti?"
                  <span title={tr("Serverda sozlangan — paneldan o'chirilmaydi")}
                    className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                    {tr("server")}
                  </span>
                )}
              </div>

              {p.ulangan && (
                <>
                  <div className="mt-3 flex items-baseline justify-between text-xs">
                    <span className="font-bold text-ink">{son(p.qolgan)}</span>
                    <span className="text-muted">/ {son(p.kunlik)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full transition-all ${ogohlik ? "bg-orange-400" : "bg-green"}`}
                      style={{ width: `${foiz}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">
                    {tr("Bugun")}: {son(p.bugun)} · {tr("hafta")}: {son(p.hafta)}
                    {p.xato > 0 && <span className="text-orange-600"> · {son(p.xato)} {tr("xato")}</span>}
                  </p>
                </>
              )}

              {/* Kalitlar ro'yxati */}
              {holat.kalitlar.filter((k) => k.provayder === p.kalit).map((k) => (
                <div key={k.id} className="mt-2 flex items-center gap-2 rounded-lg bg-soft px-2 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-ink">{k.nom}</span>
                    <span className="block font-mono text-[10px] text-muted">••••{k.oxirgi4}</span>
                  </span>
                  {ochirilyapti === k.id ? (
                    <span className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => void ochir(k.id)} disabled={band}
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold text-red-500 hover:bg-red-50 disabled:opacity-50">
                        {tr("Ha")}
                      </button>
                      <button type="button" onClick={() => setOchirilyapti(null)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold text-muted hover:bg-gray-100">
                        {tr("Yo'q")}
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setOchirilyapti(k.id)} title={tr("O'chirish")}
                      className="grid h-5 w-5 shrink-0 place-items-center rounded text-red-400 transition-colors hover:bg-red-50 hover:text-red-500">
                      <Icon d="M18 6L6 18 M6 6l12 12" className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}

              {/* Qo'shish */}
              {ochiq === p.kalit ? (
                <div className="mt-2 space-y-1.5">
                  <input value={yangiNom} onChange={(e) => setYangiNom(e.target.value)}
                    placeholder={tr("Nomi (masalan: Zaxira)")}
                    className="w-full rounded-lg border border-green/20 bg-white px-2 py-1.5 text-xs outline-none focus:border-green" />
                  <input value={yangiKalit} onChange={(e) => setYangiKalit(e.target.value)}
                    type="password" autoComplete="off" placeholder={tr("Kalitni joylashtiring")}
                    className="w-full rounded-lg border border-green/20 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-green" />
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => void qosh(p.kalit)} disabled={band}
                      className="flex-1 rounded-lg bg-green px-2 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                      {band ? tr("Saqlanmoqda…") : tr("Saqlash")}
                    </button>
                    <button type="button" onClick={() => { setOchiq(null); setYangiKalit(""); setYangiNom("") }}
                      className="rounded-lg px-2 py-1.5 text-xs font-bold text-muted hover:text-ink">
                      {tr("Bekor")}
                    </button>
                  </div>
                  <a href={p.olish} target="_blank" rel="noopener noreferrer"
                    className="block text-[10px] font-bold text-green hover:underline">
                    {tr("Kalitni shu yerdan olish")} →
                  </a>
                </div>
              ) : (
                <button type="button" onClick={() => { setOchiq(p.kalit); setYangiKalit(""); setYangiNom("") }}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-green/20 px-2 py-1.5 text-[11px] font-bold text-green transition-colors hover:bg-green/5">
                  <Icon d={I.plus} className="h-3 w-3" /> {tr("Kalit qo'shish")}
                </button>
              )}

              {p.oxirgiXato && (
                <p className="mt-2 max-h-16 overflow-y-auto rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">
                  {p.oxirgiXato}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* ---- Nimaga sarflanmoqda ---- */}
      {holat && holat.vazifalar.length > 0 && (
        <div className="mt-4 rounded-xl bg-soft p-4">
          <p className="text-xs font-bold text-ink">{tr("So'nggi 7 kun — nimaga ishlatildi")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {holat.vazifalar.map((v) => (
              <span key={v.nom} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[11px]">
                <span className="font-bold text-ink">{VAZIFA_NOM[v.nom] ? tr(VAZIFA_NOM[v.nom]) : v.nom}</span>
                <span className="text-muted">{son(v.soni)}</span>
                {v.xato > 0 && <span className="text-orange-600">({son(v.xato)} {tr("xato")})</span>}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {tr("Keshda saqlangan javoblar")}: <strong>{son(holat.kesh.yozuvlar)}</strong> —{" "}
            {tr("bir marta tarjima qilingan matn qayta so'ralmaydi")}
          </p>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted">
        {tr("Kunlik chegara — bepul tarifning e'lon qilingan qiymati. Biz o'zimiz yuborgan so'rovlarni sanaymiz, shuning uchun bu taxminiy raqam.")}
      </p>

      {/* ---- AI ga qo'shimcha ko'rsatma ---- */}
      {/* Kodagi ko'rsatma ALMASHTIRILMAYDI, faqat oxiriga qo'shiladi:
          asosiy ko'rsatmada javob shakli belgilangan va uni buzish AI ni
          butunlay ishdan chiqarardi. */}
      {holat && holat.korsatmalar.length > 0 && (
        <div className="mt-5 border-t border-green/10 pt-5">
          <button type="button" onClick={() => setKorsatmaOchiq((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left">
            <span>
              <span className="block font-display font-bold">{tr("AI ga qo'shimcha ko'rsatma")}</span>
              <span className="mt-0.5 block text-sm text-muted">
                {tr("Har vazifa uchun o'z talabingizni yozing — AI shuni ham bajaradi")}
              </span>
            </span>
            <Icon d={korsatmaOchiq ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} className="h-4 w-4 shrink-0 text-muted" />
          </button>

          {korsatmaOchiq && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {holat.korsatmalar.map((k) => {
                const joriy = qoralama[k.kalit] ?? k.matn
                const ozgargan = joriy !== k.matn
                return (
                  <div key={k.kalit} className="rounded-xl border border-green/10 p-3">
                    {/* Nom va izoh SERVERDAN keladi — tarjima shu yerda,
                        render paytida bo'ladi (lug'at kaliti o'zbekcha) */}
                    <p className="text-xs font-bold text-ink">{tr(k.nom)}</p>
                    <p className="text-[11px] text-muted">{tr(k.izoh)}</p>
                    <textarea
                      value={joriy} rows={3} maxLength={2000}
                      onChange={(e) => setQoralama((q) => ({ ...q, [k.kalit]: e.target.value }))}
                      placeholder={tr("Masalan: har postda Telegram botimizni eslatib o't")}
                      className="mt-2 w-full resize-y rounded-lg border border-green/20 bg-white px-2 py-1.5 text-xs outline-none focus:border-green" />
                    {ozgargan && (
                      <div className="mt-1.5 flex gap-1.5">
                        <button type="button" onClick={() => void korsatmaSaqla(k.kalit, joriy)} disabled={band}
                          className="rounded-lg bg-green px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60">
                          {band ? tr("Saqlanmoqda…") : tr("Saqlash")}
                        </button>
                        <button type="button"
                          onClick={() => setQoralama((q) => { const n = { ...q }; delete n[k.kalit]; return n })}
                          className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-muted hover:text-ink">
                          {tr("Bekor")}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
