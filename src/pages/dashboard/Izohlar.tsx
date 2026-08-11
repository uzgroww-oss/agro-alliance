import { useCallback, useEffect, useState } from "react"
import { Icon, I, Skeleton } from "../../lib/ui"
import { api } from "../../lib/api"
import { tr } from "../../lib/i18n"

/**
 * IZOHLARGA JAVOB — BARCHA TARMOQLAR.
 *
 * MUAMMO: kanallarga kuniga o'nlab izoh tushadi va ko'pchiligi
 * javobsiz qoladi. Javob olmagan tomoshabin ikkinchi marta yozmaydi,
 * tarmoqlar esa izoh ostidagi faollikni tavsiya algoritmida hisobga
 * oladi — ya'ni javobsiz izoh ikki tomonlama yo'qotish. Tahririyat
 * har biriga qo'lda javob yozishga ulgurmaydi.
 *
 * IKKI REJIM:
 *   QO'LDA    — "AI javob" bosiladi, matn chiqadi, tahrirlanadi va
 *               yuboriladi. Nima chiqishini oldindan ko'rasiz.
 *   AVTOMATIK — soatiga bir marta o'zi ishlaydi, javoblar odam
 *               ko'rmasdan chiqadi (fon ishi: `jobs?job=izohlar`).
 *
 * Avtomatik rejim HAR TARMOQ UCHUN ALOHIDA va oddiy holatda O'CHIQ:
 * u kanal nomidan ommaviy matn chiqaradi va buni faqat odam ataylab
 * yoqishi kerak. YouTube'da javoblar ishonchli chiqayotgan bo'lishi,
 * Instagram'da esa hali qo'lda ko'rish kerak bo'lishi mumkin.
 *
 * Ro'yxat TALAB BO'YICHA yuklanadi: har yuklash tarmoq kvotasidan
 * yeydi va varaq almashtirilmaguncha kerak emas.
 */

const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"

type IzohYozuv = {
  comment_id: string
  javob: string | null
  holat: "qoralama" | "yuborildi" | "otkazildi" | "xato"
  sabab: string | null
  avto: boolean
  provayder: string | null
  yuborilgan_at: string | null
}

type Izoh = {
  id: string
  postId: string
  postTitle: string
  havola: string
  muallif: string
  matn: string
  vaqt: string
  yoqtirish: number
  javobMumkin: boolean
  javobBerilgan: boolean
  yozuv: IzohYozuv | null
}

type Platforma = "youtube" | "instagram" | "facebook" | "telegram"

const TARMOQLAR: { k: Platforma; nom: string; rang: string }[] = [
  { k: "youtube", nom: "YouTube", rang: "#FF0000" },
  { k: "instagram", nom: "Instagram", rang: "#E1306C" },
  { k: "facebook", nom: "Facebook", rang: "#1877F2" },
  { k: "telegram", nom: "Telegram", rang: "#229ED9" },
]

type IzohSozlama = {
  avto: Record<Platforma, boolean>
  ohang: string
  til: string
  limit: number
  uzunlik: number
}

const HOLAT_NISHON: Record<string, { label: string; cls: string }> = {
  yuborildi: { label: "Javob yuborilgan", cls: "bg-green/10 text-green" },
  qoralama: { label: "Qoralama tayyor", cls: "bg-blue-50 text-blue-600" },
  otkazildi: { label: "O'tkazib yuborilgan", cls: "bg-gray-100 text-gray-600" },
  xato: { label: "Xato", cls: "bg-red-50 text-red-600" },
}

/** "2026-08-07T10:22:00Z" -> "07.08.2026 10:22" */
function vaqtMatn(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const BOSH_YOZUV: IzohYozuv = {
  comment_id: "", javob: null, holat: "qoralama", sabab: null,
  avto: false, provayder: null, yuborilgan_at: null,
}

/** Tayyor javob: ikkita maydon — nima yozilsa, nima javob berish */
type Shablon = {
  id: string
  savol: string
  javob: string
  /** null — hamma tarmoqda ishlaydi */
  platform: Platforma | null
  faol: boolean
  ishlatilgan: number
}

export default function Izohlar() {
  const [tarmoq, setTarmoq] = useState<Platforma>("youtube")
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [izohlar, setIzohlar] = useState<Izoh[]>([])
  const [sozlama, setSozlama] = useState<IzohSozlama | null>(null)
  const [xato, setXato] = useState("")
  const [xabar, setXabar] = useState("")
  /** Qaysi izoh ustida ish ketyapti — tugma ikki marta bosilmasin */
  const [band, setBand] = useState("")
  /** Tahrirlanayotgan javob matnlari: izoh ID -> matn */
  const [matnlar, setMatnlar] = useState<Record<string, string>>({})
  const [filtr, setFiltr] = useState<"javobsiz" | "hammasi" | "yuborilgan">("javobsiz")

  /* --- Tayyor javoblar --- */
  const [shablonlar, setShablonlar] = useState<Shablon[]>([])
  const [shablonOchiq, setShablonOchiq] = useState(false)
  const [yangiSavol, setYangiSavol] = useState("")
  const [yangiJavob, setYangiJavob] = useState("")
  const [yangiTarmoq, setYangiTarmoq] = useState<"hammasi" | Platforma>("hammasi")
  const [shablonBand, setShablonBand] = useState(false)

  /**
   * Yuklash funksiyasi HOLATNI O'ZGARTIRMASDAN boshlanadi.
   *
   * Birinchi amali — `await`. Sabab: uni effekt ham chaqiradi, effekt
   * tanasida esa sinxron `setState` bo'lmasligi kerak (React shu
   * sababdan qo'shimcha qayta chizish qiladi). "Yuklanmoqda" holati
   * varaq almashtirilganda yoki tugma bosilganda — ya'ni hodisa
   * ichida — qo'yiladi.
   */
  const yukla = useCallback(async (p: Platforma) => {
    try {
      const d = await api<{ izohlar: Izoh[]; sozlama: IzohSozlama; xato?: string }>(
        `/izohlar?action=list&platform=${p}`,
      )
      setIzohlar(d.izohlar || [])
      setSozlama(d.sozlama || null)
      if (d.xato) setXato(d.xato)
      // Bazadagi qoralamalar tahrirlash maydonlariga tushsin
      const m: Record<string, string> = {}
      for (const i of d.izohlar || []) if (i.yozuv?.javob) m[i.id] = i.yozuv.javob
      setMatnlar(m)
    } catch (e) {
      setXato(e instanceof Error ? e.message : tr("Izohlarni yuklab bo'lmadi"))
    } finally {
      setYuklanmoqda(false)
    }
  }, [])

  // Varaq almashganda o'sha tarmoqning izohlari yuklanadi.
  // Har yuklash tarmoq kvotasidan yeydi, shuning uchun faqat
  // ko'rilayotgan tarmoq so'raladi — hammasi birdan emas.
  // `await` orqali chaqiriladi: effekt tanasida sinxron setState
  // bo'lmasligi kerak (YoutubeStudio dagi bilan bir xil naqsh)
  useEffect(() => { void (async () => { await yukla(tarmoq) })() }, [tarmoq, yukla])

  /** Varaq almashtirish: eski ro'yxat darhol ketadi, skelet chiqadi */
  const varaqAlmash = (p: Platforma) => {
    if (p === tarmoq) return
    setYuklanmoqda(true)
    setXato("")
    setIzohlar([])
    setMatnlar({})
    setTarmoq(p)
  }

  /** Bitta izohning holatini ro'yxatda yangilaydi — qayta yuklamasdan */
  const yozuvniQoy = (id: string, y: Partial<IzohYozuv>) => {
    setIzohlar((prev) => prev.map((i) => i.id === id
      ? { ...i, yozuv: { ...BOSH_YOZUV, ...(i.yozuv || {}), comment_id: id, ...y } }
      : i))
  }

  /* ======================= TAYYOR JAVOBLAR =======================
   *
   * Ro'yxat TALAB BO'YICHA yuklanadi — bo'lim ochilgandagina. Izohlar
   * varag'ini ochgan odamning ko'pchiligiga u kerak emas, so'rov esa
   * bekorga ketardi.
   */
  const shablonlarniYukla = useCallback(async () => {
    try {
      const d = await api<{ shablonlar: Shablon[] }>("/izohlar?action=shablon_list")
      setShablonlar(d.shablonlar || [])
    } catch {
      setXato(tr("Tayyor javoblarni yuklab bo'lmadi"))
    }
  }, [])

  const shablonBolimi = () => {
    const ochilyapti = !shablonOchiq
    setShablonOchiq(ochilyapti)
    if (ochilyapti && shablonlar.length === 0) void shablonlarniYukla()
  }

  const shablonQosh = async () => {
    const savol = yangiSavol.trim()
    const javob = yangiJavob.trim()
    if (savol.length < 2 || javob.length < 2) {
      setXato(tr("Ikkala maydonni ham to'ldiring"))
      return
    }
    setShablonBand(true)
    setXato("")
    try {
      const d = await api<{ shablonlar: Shablon[] }>("/izohlar?action=shablon_saqla", {
        method: "POST",
        body: JSON.stringify({ savol, javob, platform: yangiTarmoq }),
      })
      setShablonlar(d.shablonlar || [])
      // Maydonlar tozalanadi — ketma-ket bir nechta shablon yozish oson bo'lsin
      setYangiSavol("")
      setYangiJavob("")
      setXabar(tr("✅ Tayyor javob qo'shildi"))
    } catch (e) {
      setXato(e instanceof Error ? e.message : tr("Saqlab bo'lmadi"))
    } finally {
      setShablonBand(false)
    }
  }

  const shablonniOchir = async (id: string) => {
    setShablonBand(true)
    try {
      const d = await api<{ shablonlar: Shablon[] }>("/izohlar?action=shablon_ochir", {
        method: "POST", body: JSON.stringify({ id }),
      })
      setShablonlar(d.shablonlar || [])
    } catch (e) {
      setXato(e instanceof Error ? e.message : tr("O'chirib bo'lmadi"))
    } finally {
      setShablonBand(false)
    }
  }

  /** Shablon matnini javob maydoniga qo'yadi (yubormaydi — ko'rib chiqasiz) */
  const shablonniQoy = (izohId: string, javob: string) => {
    setMatnlar((p) => ({ ...p, [izohId]: javob }))
  }

  /** Shu tarmoqda ishlaydigan shablonlar — tanlash ro'yxati uchun */
  const tarmoqShablonlari = shablonlar.filter((s) => s.faol && (!s.platform || s.platform === tarmoq))

  const aiJavob = async (i: Izoh) => {
    setBand(i.id); setXabar("")
    try {
      const d = await api<{ holat: string; javob?: string; sabab?: string; provayder?: string }>(
        "/izohlar?action=draft",
        {
          method: "POST",
          body: JSON.stringify({
            platform: tarmoq, commentId: i.id, izoh: i.matn, muallif: i.muallif,
            postId: i.postId, postTitle: i.postTitle, vaqt: i.vaqt,
          }),
        },
      )
      if (d.holat === "otkazildi") {
        yozuvniQoy(i.id, { holat: "otkazildi", sabab: d.sabab || "" })
        setXabar(tr("AI bu izohga javob berishni tavsiya qilmadi"))
      } else {
        setMatnlar((p) => ({ ...p, [i.id]: d.javob || "" }))
        yozuvniQoy(i.id, { holat: "qoralama", javob: d.javob || "", provayder: d.provayder || null, sabab: null })
      }
    } catch (e) {
      setXabar(`❌ ${e instanceof Error ? e.message : tr("AI javob yozmadi")}`)
    } finally {
      setBand("")
    }
  }

  const yubor = async (i: Izoh) => {
    const javob = (matnlar[i.id] || "").trim()
    if (!javob) return
    setBand(i.id); setXabar("")
    try {
      await api("/izohlar?action=send", {
        method: "POST",
        body: JSON.stringify({
          platform: tarmoq, commentId: i.id, javob, izoh: i.matn, muallif: i.muallif,
          postId: i.postId, postTitle: i.postTitle,
        }),
      })
      yozuvniQoy(i.id, { holat: "yuborildi", javob, sabab: null, yuborilgan_at: new Date().toISOString() })
      setXabar(tr("✅ Javob yuborildi"))
    } catch (e) {
      setXabar(`❌ ${e instanceof Error ? e.message : tr("Yuborilmadi")}`)
    } finally {
      setBand("")
    }
  }

  const kerakEmas = async (i: Izoh) => {
    setBand(i.id); setXabar("")
    try {
      await api("/izohlar?action=skip", {
        method: "POST",
        body: JSON.stringify({
          platform: tarmoq, commentId: i.id, izoh: i.matn, muallif: i.muallif,
          postId: i.postId, postTitle: i.postTitle,
        }),
      })
      yozuvniQoy(i.id, { holat: "otkazildi", sabab: tr("tahririyat o'tkazib yubordi") })
    } catch (e) {
      setXabar(`❌ ${e instanceof Error ? e.message : tr("Saqlanmadi")}`)
    } finally {
      setBand("")
    }
  }

  const sozlamaSaqla = async (yangi: Partial<IzohSozlama>) => {
    if (!sozlama) return
    const oldingi = sozlama
    // Darhol ko'rsatamiz — server javobini kutib turish sekin ko'rinadi
    setSozlama({ ...sozlama, ...yangi })
    setXabar("")
    try {
      const tana: Record<string, string> = {}
      /**
       * O'ZGARGAN tarmoqlarning HAMMASI yoziladi.
       *
       * Ilgari faqat ko'rilayotgan tarmoq yozilardi
       * (`izoh_avto_${tarmoq}`) — bitta katakcha uchun to'g'ri edi,
       * lekin "hammasini yoqish" tugmasi to'rttasini birdan
       * o'zgartiradi va uchtasi jimgina yo'qolardi.
       *
       * Endi eski holat bilan solishtiriladi: nima o'zgargan bo'lsa
       * o'sha ketadi. Bitta katakcha bosilganda ham xuddi shu kod
       * ishlaydi — bitta kalit jo'natiladi.
       */
      if (yangi.avto !== undefined) {
        for (const t of TARMOQLAR) {
          if (yangi.avto[t.k] !== oldingi.avto[t.k]) {
            tana["izoh_avto_" + t.k] = String(yangi.avto[t.k])
          }
        }
      }
      if (yangi.ohang !== undefined) tana.izoh_ohang = yangi.ohang
      if (yangi.til !== undefined) tana.izoh_til = yangi.til
      if (yangi.limit !== undefined) tana.izoh_limit = String(yangi.limit)
      if (yangi.uzunlik !== undefined) tana.izoh_uzunlik = String(yangi.uzunlik)
      const d = await api<{ sozlama: IzohSozlama }>("/izohlar?action=config", {
        method: "POST", body: JSON.stringify(tana),
      })
      if (d.sozlama) setSozlama(d.sozlama)
      setXabar(tr("✅ Sozlama saqlandi"))
    } catch (e) {
      /**
       * Saqlanmagan bo'lsa ESKI holatga qaytamiz.
       * Ekranda "avtomatik yoqilgan" turib, aslida o'chiq bo'lishi —
       * eng chalg'ituvchi holat: tahririyat izohlar o'zi javob
       * olyapti deb o'ylab, ularni umuman ko'rmay qo'yardi.
       */
      setSozlama(oldingi)
      setXabar(`❌ ${e instanceof Error ? e.message : tr("Saqlanmadi")}`)
    }
  }

  const javobsiz = izohlar.filter((i) => !i.yozuv && !i.javobBerilgan).length

  /**
   * Ro'yxatda ellikkacha izoh bo'ladi va ularning ko'pchiligiga
   * allaqachon javob berilgan. Sukut bo'yicha faqat JAVOBSIZLARI
   * ko'rsatiladi: ish shu yerda, qolgani esa arxiv.
   */
  const korinadi = izohlar.filter((i) => {
    if (filtr === "hammasi") return true
    if (filtr === "javobsiz") return !i.yozuv && !i.javobBerilgan
    return i.yozuv?.holat === "yuborildi" || i.javobBerilgan
  })

  const avtoYoqilgan = Boolean(sozlama?.avto?.[tarmoq])
  const tarmoqNomi = TARMOQLAR.find((t) => t.k === tarmoq)?.nom || tarmoq
  const yoqilganSoni = TARMOQLAR.filter((t) => sozlama?.avto?.[t.k]).length
  const hammasiYoqilgan = yoqilganSoni === TARMOQLAR.length

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green/10 text-green">
            <Icon d={I.message} className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display font-bold">{tr("Izohlarga javob")}</h3>
            <p className="text-xs text-muted">
              {avtoYoqilgan ? tr("Bu tarmoqda avtomatik rejim yoqilgan") : tr("AI javob yozadi, siz tasdiqlaysiz")}
            </p>
          </div>
        </div>
        {javobsiz > 0 && (
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-600">
            {javobsiz} {tr("javobsiz")}
          </span>
        )}
      </div>

      {/* TARMOQ VARAQLARI.
          Har varaq alohida so'rov yuboradi. Hammasi birdan yuklansa
          to'rtta tarmoq kvotasi bir vaqtda sarflanardi, holbuki
          tahririyat odatda bittasiga qaraydi. */}
      <div className="mt-4 flex flex-wrap gap-1 rounded-xl bg-soft p-1">
        {TARMOQLAR.map((t) => (
          <button key={t.k} onClick={() => varaqAlmash(t.k)}
            className={"inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors " +
              (tarmoq === t.k ? "bg-white shadow-sm" : "text-muted hover:text-ink")}
            style={tarmoq === t.k ? { color: t.rang } : undefined}>
            <span className="h-2 w-2 rounded-full" style={{ background: t.rang }} />
            {t.nom}
            {sozlama?.avto?.[t.k] && (
              <span className="rounded bg-green/15 px-1 text-[9px] font-bold text-green">{tr("avto")}</span>
            )}
          </button>
        ))}
      </div>

      {(
        <div className="mt-4 space-y-4">
          {xabar && (
            <div className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${xabar.startsWith("✅") ? "bg-green/10 text-green" : xabar.startsWith("❌") ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-700"}`}>{xabar}</div>
          )}
          {xato && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{xato}</div>}

          {/* ---------------- Sozlamalar ---------------- */}
          {sozlama && (
            <div className="rounded-xl border border-green/10 bg-[#fafdf7] p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={avtoYoqilgan}
                  onChange={(e) => void sozlamaSaqla({ avto: { ...sozlama.avto, [tarmoq]: e.target.checked } })}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-green" />
                <span>
                  <span className="block text-sm font-bold">{tr("Avtomatik javob")} — {tarmoqNomi}</span>
                  <span className="block text-xs text-muted">
                    {tr("Soatiga bir marta yangi izohlarga o'zi javob yozadi va yuboradi. Javoblar kanal nomidan ommaviy chiqadi — siz ko'rib tasdiqlamaysiz.")}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted">
                    {tr("Ohang, til va uzunlik hamma tarmoqqa umumiy. Bu katakcha faqat shu tarmoq uchun.")}
                  </span>
                </span>
              </label>

              {/*
                HAMMA TARMOQNI BIRDAN YOQISH.
                Yuqoridagi katakcha bittasini boshqaradi — to'rttasini
                yoqish uchun to'rt marta varaq almashtirish kerak edi.
                Bu tugma to'rtalasini bitta so'rovda yozadi.
                Alohida turadi va matni ochiq: bu KENGROQ harakat,
                tasodifan bosilmasligi kerak.
              */}
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg bg-white/70 p-3">
                <input type="checkbox" checked={hammasiYoqilgan}
                  onChange={(e) => {
                    const q = e.target.checked
                    const avto = { ...sozlama.avto }
                    for (const t of TARMOQLAR) avto[t.k] = q
                    void sozlamaSaqla({ avto })
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-green" />
                <span>
                  <span className="block text-sm font-bold">
                    {tr("Hamma tarmoqda avtomatik javob")}
                    <span className="ml-2 rounded bg-green/15 px-1.5 py-0.5 text-[10px] font-bold text-green">
                      {yoqilganSoni}/{TARMOQLAR.length}
                    </span>
                  </span>
                  <span className="block text-xs text-muted">
                    {tr("YouTube, Instagram, Facebook va Telegram — to'rttasini birdan yoqadi yoki o'chiradi.")}
                  </span>
                </span>
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-bold text-muted">
                  {tr("Javob tili")}
                  <select value={sozlama.til} onChange={(e) => void sozlamaSaqla({ til: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-green">
                    <option value="auto">{tr("Izoh tilida")}</option>
                    <option value="uz">{tr("O'zbekcha")}</option>
                    <option value="ru">{tr("Ruscha")}</option>
                    <option value="en">{tr("Inglizcha")}</option>
                  </select>
                </label>
                <label className="block text-xs font-bold text-muted">
                  {tr("Javob uzunligi (belgi)")}
                  <input type="number" min={60} max={500} defaultValue={sozlama.uzunlik}
                    onBlur={(e) => { const v = Number(e.target.value); if (v && v !== sozlama.uzunlik) void sozlamaSaqla({ uzunlik: v }) }}
                    className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-green" />
                </label>
                <label className="block text-xs font-bold text-muted">
                  {tr("Bir yurishda ko'pi bilan")}
                  <input type="number" min={1} max={50} defaultValue={sozlama.limit}
                    onBlur={(e) => { const v = Number(e.target.value); if (v && v !== sozlama.limit) void sozlamaSaqla({ limit: v }) }}
                    className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-green" />
                </label>
              </div>

              <label className="mt-3 block text-xs font-bold text-muted">
                {tr("AI ga qo'shimcha ko'rsatma")}
                <textarea rows={2} defaultValue={sozlama.ohang}
                  onBlur={(e) => { if (e.target.value !== sozlama.ohang) void sozlamaSaqla({ ohang: e.target.value }) }}
                  placeholder={tr("Masalan: doim hurmat bilan murojaat qil, narx haqida hech narsa aytma")}
                  className="mt-1 w-full resize-y rounded-lg border border-green/20 bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-green" />
              </label>
            </div>
          )}

          {/* ================= TAYYOR JAVOBLAR =================
              Bir xil savolga bir xil javob. Ikkita maydon: izohda
              nima yozilsa va nima javob berish. Mos kelgan izohga AI
              umuman chaqirilmaydi. */}
          <div className="mt-4 rounded-xl border border-green/15 bg-white/70">
            <button onClick={shablonBolimi}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
              <span>
                <span className="block text-sm font-bold">
                  {tr("Tayyor javoblar")}
                  {shablonlar.length > 0 && (
                    <span className="ml-2 rounded bg-green/15 px-1.5 py-0.5 text-[10px] font-bold text-green">
                      {shablonlar.length}
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted">
                  {tr("Bir xil savolga bir xil javob — AI chaqirilmaydi")}
                </span>
              </span>
              <Icon d={shablonOchiq ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} className="h-4 w-4 shrink-0 text-muted" />
            </button>

            {shablonOchiq && (
              <div className="border-t border-green/10 p-4">
                {/* --- Yangi qo'shish: IKKITA MAYDON --- */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-muted">
                    {tr("Izohda shu yozilsa")}
                    <textarea rows={3} value={yangiSavol} onChange={(e) => setYangiSavol(e.target.value)}
                      placeholder={tr("narx qancha, narxi qanday, qancha turadi")}
                      className="mt-1 w-full resize-y rounded-lg border border-green/20 bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-green" />
                    <span className="mt-1 block font-normal text-[11px] leading-snug text-muted">
                      {tr("Bir nechta variantni vergul bilan ajrating. Kam so'z yozsangiz — ko'proq izohga mos keladi.")}
                    </span>
                  </label>

                  <label className="block text-xs font-bold text-muted">
                    {tr("Shu javob yuboriladi")}
                    <textarea rows={3} value={yangiJavob} onChange={(e) => setYangiJavob(e.target.value)}
                      placeholder={tr("Salom! Narxlar bo'yicha bizga yozing, batafsil aytamiz.")}
                      className="mt-1 w-full resize-y rounded-lg border border-green/20 bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-green" />
                    <span className="mt-1 block font-normal text-[11px] leading-snug text-muted">
                      {tr("Matn AYNAN shu ko'rinishda ketadi — AI unga tegmaydi.")}
                    </span>
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="block text-xs font-bold text-muted">
                    {tr("Qaysi tarmoqda")}
                    <select value={yangiTarmoq} onChange={(e) => setYangiTarmoq(e.target.value as typeof yangiTarmoq)}
                      className="mt-1 block rounded-lg border border-green/20 bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-green">
                      <option value="hammasi">{tr("Hamma tarmoqda")}</option>
                      {TARMOQLAR.map((t) => <option key={t.k} value={t.k}>{t.nom}</option>)}
                    </select>
                  </label>
                  <button onClick={() => void shablonQosh()} disabled={shablonBand}
                    className="rounded-lg bg-green px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
                    {tr("Qo'shish")}
                  </button>
                </div>

                {/* --- Mavjud shablonlar --- */}
                {shablonlar.length === 0 ? (
                  <p className="mt-4 text-xs text-muted">
                    {tr("Hali tayyor javob yo'q. Yuqorida birinchisini yozing.")}
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {shablonlar.map((s) => (
                      <li key={s.id} className="flex items-start gap-3 rounded-lg border border-green/10 bg-white p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-soft px-1.5 py-0.5 text-[10px] font-bold text-ink">
                              {s.platform ? TARMOQLAR.find((t) => t.k === s.platform)?.nom : tr("Hammasi")}
                            </span>
                            {s.ishlatilgan > 0 && (
                              <span className="rounded bg-green/10 px-1.5 py-0.5 text-[10px] font-bold text-green">
                                {s.ishlatilgan}× {tr("ishlatilgan")}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 break-words text-xs font-bold text-ink">{s.savol}</p>
                          <p className="mt-0.5 break-words text-xs text-muted">→ {s.javob}</p>
                        </div>
                        <button onClick={() => void shablonniOchir(s.id)} disabled={shablonBand}
                          title={tr("O'chirish")}
                          className="shrink-0 rounded-lg border border-green/15 p-1.5 text-muted transition-colors hover:text-red-500 disabled:opacity-50">
                          {/* `I` to'plamida o'chirish ikonkasi yo'q —
                              boshqa panellarda ham xuddi shu yo'l
                              bevosita yozilgan */}
                          <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6"
                            className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* ---------------- Ro'yxat ---------------- */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 rounded-lg bg-soft p-1">
              {([
                ["javobsiz", "Javobsiz"],
                ["hammasi", "Hammasi"],
                ["yuborilgan", "Javob berilgan"],
              ] as const).map(([k, label]) => (
                <button key={k} onClick={() => setFiltr(k)}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${filtr === k ? "bg-white text-green shadow-sm" : "text-muted hover:text-ink"}`}>
                  {tr(label)}
                </button>
              ))}
            </div>
            <button onClick={() => { setYuklanmoqda(true); void yukla(tarmoq) }} disabled={yuklanmoqda}
              className="inline-flex items-center gap-1.5 rounded-lg border border-green/20 px-3 py-1.5 text-xs font-bold text-green disabled:opacity-60">
              <Icon d={I.refresh} className={`h-3.5 w-3.5 ${yuklanmoqda ? "animate-spin" : ""}`} /> {tr("Yangilash")}
            </button>
          </div>

          {yuklanmoqda ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
          ) : korinadi.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              {izohlar.length === 0
                ? tr("Izoh topilmadi.")
                : filtr === "javobsiz" ? tr("Javobsiz izoh qolmadi.") : tr("Bu turkumda izoh yo'q.")}
            </p>
          ) : (
            <div className="space-y-2">
              {korinadi.map((i) => {
                const y = i.yozuv
                const nishon = y ? HOLAT_NISHON[y.holat] : null
                const yuborilgan = y?.holat === "yuborildi" || i.javobBerilgan
                const ish = band === i.id
                return (
                  <div key={i.id} className="rounded-xl border border-green/10 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <span className="font-bold text-ink">{i.muallif || tr("Noma'lum")}</span>
                      <span>{vaqtMatn(i.vaqt)}</span>
                      {i.yoqtirish > 0 && (
                        <span className="inline-flex items-center gap-1"><Icon d={I.star} className="h-3 w-3" />{i.yoqtirish}</span>
                      )}
                      {i.postTitle && (i.havola
                        ? <a href={i.havola} target="_blank" rel="noreferrer"
                            className="line-clamp-1 max-w-[220px] hover:text-green hover:underline">{i.postTitle}</a>
                        : <span className="line-clamp-1 max-w-[220px]">{i.postTitle}</span>
                      )}
                      {nishon && <span className={`rounded px-1.5 py-0.5 font-bold ${nishon.cls}`}>{tr(nishon.label)}</span>}
                      {y?.avto && <span className="rounded bg-purple-100 px-1.5 py-0.5 font-bold text-purple-600">AI</span>}
                    </div>

                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink/85">{i.matn}</p>

                    {y?.sabab && (
                      <p className="mt-1.5 rounded-lg bg-soft px-2.5 py-1.5 text-[11px] text-muted">{y.sabab}</p>
                    )}

                    {/* Javob berilgan izohda matn faqat ko'rsatiladi */}
                    {yuborilgan ? (
                      y?.javob && (
                        <p className="mt-2 rounded-lg border-l-2 border-green/40 bg-green/5 px-3 py-2 text-sm">{y.javob}</p>
                      )
                    ) : !i.javobMumkin ? (
                      <p className="mt-2 text-[11px] text-muted">{tr("Bu postda izohga javob yozish yopilgan.")}</p>
                    ) : (
                      <>
                        {/* Maydon DOIM ko'rinadi.
                            Ilgari u faqat AI qoralama yozgandan keyin
                            chiqardi — AI "javob bermaslik kerak" desa
                            tahririyat qo'lda ham yoza olmay, boshi
                            berk ko'chaga tushardi. */}
                        <textarea
                          value={matnlar[i.id] || ""}
                          onChange={(e) => setMatnlar((p) => ({ ...p, [i.id]: e.target.value }))}
                          rows={2}
                          placeholder={tr("Javobni AI yozsin yoki o'zingiz yozing…")}
                          className="mt-2 w-full resize-y rounded-lg border border-green/20 px-3 py-2 text-sm outline-none focus:border-green" />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button onClick={() => void aiJavob(i)} disabled={ish}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                            {ish
                              ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              : <Icon d={I.brain} className="h-3.5 w-3.5" />}
                            {matnlar[i.id] ? tr("Qayta yozdirish") : tr("AI javob")}
                          </button>
                          <button onClick={() => void yubor(i)} disabled={ish || !(matnlar[i.id] || "").trim()}
                            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-green/30 px-3 py-1.5 text-xs font-bold text-green disabled:opacity-40">
                            <Icon d={I.send} className="h-3.5 w-3.5" /> {tr("Yuborish")}
                          </button>
                          <button onClick={() => void kerakEmas(i)} disabled={ish}
                            className="rounded-lg border border-green/15 px-3 py-1.5 text-xs font-bold text-muted disabled:opacity-60">
                            {tr("Kerak emas")}
                          </button>

                          {/* Tayyor javobni QO'LDA qo'yish. Faqat matn
                              maydoniga tushadi — ko'rib, kerak bo'lsa
                              tahrirlab, o'zingiz yuborasiz.
                              Shablon yo'q bo'lsa umuman ko'rinmaydi. */}
                          {tarmoqShablonlari.length > 0 && (
                            <select value="" disabled={ish}
                              onChange={(e) => {
                                const s = tarmoqShablonlari.find((x) => x.id === e.target.value)
                                if (s) shablonniQoy(i.id, s.javob)
                              }}
                              className="rounded-lg border border-green/20 bg-white px-2 py-1.5 text-xs font-bold text-ink outline-none focus:border-green disabled:opacity-60">
                              <option value="">{tr("Tayyor javob…")}</option>
                              {tarmoqShablonlari.map((s) => (
                                <option key={s.id} value={s.id}>{s.savol.slice(0, 40)}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </>
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
