import { useCallback, useEffect, useRef, useState } from "react"
import { Icon, I, Skeleton } from "../../lib/ui"
import { api } from "../../lib/api"
import { tr } from "../../lib/i18n"

/**
 * YOUTUBE STUDIYASI — kanalni shu paneldan boshqarish.
 *
 * Video yuklash, sarlavha/tavsif/teg/maxfiylikni o'zgartirish, muqova
 * rasm qo'yish va videoni o'chirish. Hammasi kanal EGASI nomidan
 * bajariladi, shuning uchun Google rozilik oynasi orqali bir marta
 * ulanish talab qilinadi.
 *
 * VIDEO FAYLI SERVERIMIZDAN O'TMAYDI: brauzer faylni to'g'ridan-to'g'ri
 * YouTube'ga yuboradi. Aks holda 500 MB lik video edge funksiya orqali
 * o'tishi kerak bo'lardi — u bunga mo'ljallanmagan.
 */

const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"

type YtVideo = {
  id: string; title: string; description: string; tags: string[]
  categoryId: string; thumbnail: string; publishedAt: string
  privacy: string; uploadStatus: string; duration: string
  views: number; likes: number; comments: number
}
type Kanal = { id: string; title: string; thumbnail: string; subscribers: number; videoCount: number; viewCount: number }
type Turkum = { id: string; title: string }

const MAXFIYLIK: Record<string, { label: string; cls: string }> = {
  public: { label: "Ochiq", cls: "bg-green/10 text-green" },
  unlisted: { label: "Havola orqali", cls: "bg-blue-50 text-blue-600" },
  private: { label: "Yopiq", cls: "bg-gray-100 text-gray-600" },
}

const son = (n: number) => n.toLocaleString("ru-RU")

/** "PT12M30S" -> "12:30" */
function davomiylik(iso: string): string {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return ""
  const [h, d, s] = [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)]
  const ikki = (n: number) => String(n).padStart(2, "0")
  return h ? `${h}:${ikki(d)}:${ikki(s)}` : `${d}:${ikki(s)}`
}

/** Faylni brauzerda data-URL ga aylantiradi (muqova uchun) */
function faylniOqi(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(new Error(tr("Faylni o'qib bo'lmadi")))
    r.readAsDataURL(f)
  })
}

export default function YoutubeStudio() {
  const [ulangan, setUlangan] = useState<boolean | null>(null)
  const [kanal, setKanal] = useState<Kanal | null>(null)
  const [videos, setVideos] = useState<YtVideo[]>([])
  const [turkumlar, setTurkumlar] = useState<Turkum[]>([])
  const [xato, setXato] = useState("")
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [tahrir, setTahrir] = useState<YtVideo | null>(null)
  const [ochirilyapti, setOchirilyapti] = useState<YtVideo | null>(null)
  const [xabar, setXabar] = useState("")

  const sorov = useCallback(async () => {
    try {
      const d = await api<{ videos: YtVideo[]; ulangan: boolean; kanal: Kanal | null; xato?: string }>(
        "/youtube/manage?action=videos",
      )
      setUlangan(d.ulangan)
      setKanal(d.kanal || null)
      setVideos(d.videos || [])
      if (d.xato) setXato(d.xato)
    } catch (e) {
      setXato(e instanceof Error ? e.message : tr("Yuklab bo'lmadi"))
    } finally {
      setYuklanmoqda(false)
    }
  }, [])

  /** Qo'lda yangilash — skeleton va eski xato tiklanadi */
  const yukla = useCallback(() => {
    setYuklanmoqda(true)
    setXato("")
    void sorov()
  }, [sorov])

  // `await` dan keyin — effekt tanasida sinxron setState bo'lmasin
  useEffect(() => { void (async () => { await sorov() })() }, [sorov])
  useEffect(() => {
    void (async () => {
      try {
        const d = await api<{ categories: Turkum[] }>("/youtube/manage?action=categories")
        setTurkumlar(d.categories || [])
      } catch { /* turkumsiz ham yuklash ishlaydi — zaxira qiymat bor */ }
    })()
  }, [])

  const ochir = async (v: YtVideo) => {
    setXabar("")
    try {
      await api(`/youtube/manage?action=delete&id=${v.id}`, { method: "DELETE" })
      setVideos((prev) => prev.filter((x) => x.id !== v.id))
      setOchirilyapti(null)
      setXabar(tr("✅ Video o'chirildi"))
    } catch (e) {
      setXabar(`❌ ${e instanceof Error ? e.message : tr("O'chirilmadi")}`)
    }
  }

  if (yuklanmoqda && ulangan === null) {
    return (
      <div className={card}>
        <Skeleton className="h-6 w-40 rounded" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#FF0000" aria-hidden>
                <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
              </svg>
            </span>
            <div>
              {/*
                ULASH TUGMASI BU YERDA YO'Q — ATAYLAB.
                Kanal tarmoqlar ro'yxatidagi kartochkadan bir marta
                ulanadi. Ilgari ikkita ulash nuqtasi bor edi va
                foydalanuvchi ikki marta ulashga majbur bo'lardi.
              */}
              <h3 className="font-display font-bold">
                {ulangan && kanal ? kanal.title : tr("Kanal ulanmagan")}
              </h3>
              <p className="text-sm text-muted">
                {ulangan ? tr("Video yuklash, tahrirlash va o'chirish") : tr("YouTube kartochkasidan kanalni ulang")}
              </p>
            </div>
          </div>
          {ulangan && (
            <button onClick={yukla}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-105">
              <Icon d={I.refresh} className="h-4 w-4" /> {tr("Yangilash")}
            </button>
          )}
        </div>

        {xabar && (
          <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold ${xabar.startsWith("✅") ? "bg-green/10 text-green" : xabar.startsWith("❌") ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-700"}`}>{xabar}</div>
        )}
        {xato && <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{xato}</div>}

        {ulangan && kanal && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { icon: I.users, t: "Obunachilar", v: son(kanal.subscribers) },
              { icon: I.media, t: "Videolar", v: son(kanal.videoCount) },
              { icon: I.eye, t: "Jami ko'rishlar", v: son(kanal.viewCount) },
            ].map((s) => (
              <div key={s.t} className="rounded-xl bg-[#fafdf7] p-4">
                <Icon d={s.icon} className="h-4 w-4 text-green" />
                <div className="mt-1 font-display text-xl font-extrabold">{s.v}</div>
                <div className="text-[11px] text-muted">{tr(s.t)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {ulangan && <UploadForm turkumlar={turkumlar} onDone={yukla} />}

      {ulangan && (
        <div className={card}>
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold">{tr("Kanal videolari")}</h3>
            <span className="text-xs text-muted">{videos.length} {tr("ta")}</span>
          </div>

          {yuklanmoqda ? (
            <div className="mt-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
          ) : videos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{tr("Kanalda video yo'q.")}</p>
          ) : (
            <div className="mt-4 space-y-2">
              {videos.map((v) => {
                const mx = MAXFIYLIK[v.privacy] || { label: v.privacy, cls: "bg-gray-100 text-gray-600" }
                return (
                  <div key={v.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-green/10 bg-[#fafdf7] p-3">
                    <div className="relative shrink-0">
                      {v.thumbnail
                        ? <img loading="lazy" decoding="async" src={v.thumbnail} alt="" className="h-14 w-24 rounded-lg object-cover" />
                        : <span className="grid h-14 w-24 place-items-center rounded-lg bg-green/10 text-green"><Icon d={I.play} className="h-5 w-5" /></span>}
                      {v.duration && <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[9px] font-bold text-white">{davomiylik(v.duration)}</span>}
                    </div>

                    <div className="min-w-0 flex-1">
                      <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer"
                        className="line-clamp-1 text-sm font-bold hover:text-green hover:underline">{v.title}</a>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                        <span className={`rounded px-1.5 py-0.5 font-bold ${mx.cls}`}>{tr(mx.label)}</span>
                        {/* Yuklangandan keyin YouTube videoni qayta ishlaydi —
                            shu paytda u hali ko'rinmaydi, sababini aytamiz */}
                        {v.uploadStatus === "uploaded" && (
                          <span className="rounded bg-orange-50 px-1.5 py-0.5 font-bold text-orange-600">{tr("qayta ishlanmoqda")}</span>
                        )}
                        {v.uploadStatus === "rejected" && (
                          <span className="rounded bg-red-50 px-1.5 py-0.5 font-bold text-red-600">{tr("rad etilgan")}</span>
                        )}
                        <span>{v.publishedAt}</span>
                        <span className="inline-flex items-center gap-1"><Icon d={I.eye} className="h-3 w-3" />{son(v.views)}</span>
                        <span className="inline-flex items-center gap-1"><Icon d={I.star} className="h-3 w-3" />{son(v.likes)}</span>
                        <span className="inline-flex items-center gap-1"><Icon d={I.message} className="h-3 w-3" />{son(v.comments)}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => setTahrir(v)} title={tr("Tahrirlash")}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-green/20 text-green transition-colors hover:bg-green hover:text-white">
                        <Icon d={I.gear} className="h-4 w-4" />
                      </button>
                      <button onClick={() => setOchirilyapti(v)} title={tr("O'chirish")}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600">
                        <Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tahrir && (
        <EditModal
          v={tahrir}
          turkumlar={turkumlar}
          onClose={() => setTahrir(null)}
          onSaved={() => { setTahrir(null); yukla() }}
        />
      )}

      {ochirilyapti && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setOchirilyapti(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50">
              <Icon d="M12 9v4 M12 17h.01 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" className="h-7 w-7 text-red-500" />
            </span>
            <h3 className="mt-4 font-display text-lg font-extrabold">{tr("Videoni o'chirish")}</h3>
            <p className="mt-2 text-sm text-muted">
              {tr("Video YouTube'dan butunlay o'chadi va uni qaytarib bo'lmaydi.")}
            </p>
            <p className="mt-2 line-clamp-2 rounded-lg bg-soft px-3 py-2 text-xs font-semibold">{ochirilyapti.title}</p>
            <div className="mt-5 flex justify-center gap-3">
              <button onClick={() => setOchirilyapti(null)} className="rounded-xl border-2 border-green/30 px-5 py-2.5 text-sm font-bold">{tr("Bekor qilish")}</button>
              <button onClick={() => ochir(ochirilyapti)} className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-bold text-white">{tr("O'chirish")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------- Yuklash ---------------- */

function UploadForm({ turkumlar, onDone }: { turkumlar: Turkum[]; onDone: () => void }) {
  const [ochiq, setOchiq] = useState(false)
  const [fayl, setFayl] = useState<File | null>(null)
  const [muqova, setMuqova] = useState<File | null>(null)
  const [form, setForm] = useState({ title: "", description: "", tags: "", privacy: "private", categoryId: "22", madeForKids: false })
  const [foiz, setFoiz] = useState(0)
  const [holat, setHolat] = useState("")
  const [band, setBand] = useState(false)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  const tozala = () => {
    setFayl(null); setMuqova(null); setFoiz(0)
    setForm({ title: "", description: "", tags: "", privacy: "private", categoryId: "22", madeForKids: false })
  }

  const yukla = async () => {
    if (!fayl) { setHolat(tr("❌ Video faylni tanlang")); return }
    if (!form.title.trim()) { setHolat(tr("❌ Sarlavha kiriting")); return }
    setBand(true); setHolat(""); setFoiz(0)

    try {
      // 1) Seans ochamiz — metama'lumot server orqali yuboriladi
      const init = await api<{ uploadUrl: string }>("/youtube/manage?action=upload-init", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          privacy: form.privacy,
          categoryId: form.categoryId,
          madeForKids: form.madeForKids,
          size: fayl.size,
          mime: fayl.type || "video/*",
        }),
      })
      if (!init.uploadUrl) throw new Error("Yuklash manzili olinmadi")

      // 2) Faylni TO'G'RIDAN-TO'G'RI YouTube'ga yuboramiz.
      //    fetch emas, XMLHttpRequest — faqat u yuklash jarayonini
      //    foizda ko'rsata oladi. 500 MB lik faylda bu shart.
      setHolat(tr("Yuklanmoqda..."))
      const videoId = await new Promise<string>((res, rej) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr
        xhr.open("PUT", init.uploadUrl, true)
        xhr.setRequestHeader("Content-Type", fayl.type || "video/*")
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setFoiz(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { res(JSON.parse(xhr.responseText).id || "") } catch { res("") }
          } else {
            let m = `YouTube xatosi (${xhr.status})`
            try { m = JSON.parse(xhr.responseText)?.error?.message || m } catch { /* JSON emas */ }
            rej(new Error(m))
          }
        }
        xhr.onerror = () => rej(new Error(tr("Tarmoq uzildi")))
        xhr.onabort = () => rej(new Error(tr("Bekor qilindi")))
        xhr.send(fayl)
      })

      // 3) Muqova — alohida so'rov, YouTube uni yuklash bilan birga qabul qilmaydi
      if (muqova && videoId) {
        setHolat(tr("Muqova qo'yilmoqda..."))
        try {
          const b64 = await faylniOqi(muqova)
          await api("/youtube/manage?action=thumbnail", {
            method: "POST", body: JSON.stringify({ id: videoId, image: b64 }),
          })
        } catch (e) {
          // Video YUKLANDI — muqova yiqilgani hammasini bekor qilmaydi
          setHolat(`⚠️ Video yuklandi, lekin muqova qo'yilmadi: ${e instanceof Error ? e.message : ""}`)
          tozala(); setOchiq(false); onDone(); setBand(false)
          return
        }
      }

      setHolat(tr("✅ Video yuklandi. YouTube uni bir necha daqiqada qayta ishlaydi."))
      tozala()
      setOchiq(false)
      onDone()
    } catch (e) {
      setHolat(`❌ ${e instanceof Error ? e.message : tr("Yuklanmadi")}`)
    } finally {
      setBand(false)
      xhrRef.current = null
    }
  }

  const bekor = () => { xhrRef.current?.abort(); setBand(false); setFoiz(0) }

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold">{tr("Video yuklash")}</h3>
          <p className="text-sm text-muted">{tr("Fayl brauzerdan to'g'ridan-to'g'ri YouTube'ga yuboriladi")}</p>
        </div>
        <button onClick={() => setOchiq((o) => !o)}
          className="inline-flex items-center gap-2 rounded-xl border border-green/25 px-4 py-2 text-sm font-bold text-green transition-colors hover:bg-green/5">
          <Icon d={ochiq ? I.chevDown : I.plus} className="h-4 w-4" /> {ochiq ? tr("Yopish") : tr("Yangi video")}
        </button>
      </div>

      {holat && (
        <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold ${holat.startsWith("✅") ? "bg-green/10 text-green" : holat.startsWith("❌") ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-700"}`}>{holat}</div>
      )}

      {band && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold">{foiz}%</span>
            <button onClick={bekor} className="font-bold text-red-500 hover:underline">{tr("Bekor qilish")}</button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-soft">
            <div className="h-full rounded-full bg-green transition-all" style={{ width: `${foiz}%` }} />
          </div>
        </div>
      )}

      {ochiq && !band && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted">{tr("Video fayl")}</span>
              <input type="file" accept="video/*" onChange={(e) => setFayl(e.target.files?.[0] || null)}
                className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-green file:px-2 file:py-1 file:text-xs file:font-bold file:text-white" />
              {fayl && <span className="mt-1 block text-[11px] text-muted">{(fayl.size / 1024 / 1024).toFixed(1)} MB</span>}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted">{tr("Muqova rasmi")}<span className="font-normal">{tr(" (ixtiyoriy, 2 MB gacha)")}</span></span>
              <input type="file" accept="image/jpeg,image/png" onChange={(e) => setMuqova(e.target.files?.[0] || null)}
                className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-green file:px-2 file:py-1 file:text-xs file:font-bold file:text-white" />
            </label>
          </div>

          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={tr("Sarlavha")} maxLength={100}
            className="w-full rounded-lg border border-green/20 px-3 py-2 text-sm outline-none focus:border-green" />

          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4} placeholder={tr("Tavsif — video ostida chiqadigan matn")} maxLength={5000}
            className="w-full resize-none rounded-lg border border-green/20 px-3 py-2 text-sm outline-none focus:border-green" />

          <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder={tr("Teglar — vergul bilan ajrating")}
            className="w-full rounded-lg border border-green/20 px-3 py-2 text-sm outline-none focus:border-green" />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted">{tr("Kim ko'ra oladi")}</span>
              <select value={form.privacy} onChange={(e) => setForm((f) => ({ ...f, privacy: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green">
                <option value="private">{tr("Yopiq — faqat men")}</option>
                <option value="unlisted">{tr("Havola orqali")}</option>
                <option value="public">{tr("Ochiq — hamma")}</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted">{tr("Turkum")}</span>
              <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green">
                {turkumlar.length === 0 && <option value="22">{tr("Odamlar va bloglar")}</option>}
                {turkumlar.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>
          </div>

          {/* Google talabi: bu belgilanmasa yuklash rad etiladi */}
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.madeForKids} onChange={(e) => setForm((f) => ({ ...f, madeForKids: e.target.checked }))}
              className="h-4 w-4 accent-green" />
            {tr("Bu video bolalar uchun mo'ljallangan")}
          </label>

          <button onClick={yukla} disabled={band}
            className="w-full rounded-xl bg-red-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-transform hover:scale-[1.01] disabled:opacity-60">
            {tr("YouTube'ga yuklash")}
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------------- Tahrirlash ---------------- */

function EditModal({ v, turkumlar, onClose, onSaved }: {
  v: YtVideo; turkumlar: Turkum[]; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: v.title, description: v.description,
    tags: (v.tags || []).join(", "), privacy: v.privacy || "private",
    categoryId: v.categoryId || "22",
  })
  const [muqova, setMuqova] = useState<File | null>(null)
  const [band, setBand] = useState(false)
  const [xabar, setXabar] = useState("")

  const saqla = async () => {
    if (!form.title.trim()) { setXabar(tr("❌ Sarlavha bo'sh bo'lishi mumkin emas")); return }
    setBand(true); setXabar("")
    try {
      await api("/youtube/manage?action=update", {
        method: "POST",
        body: JSON.stringify({
          id: v.id,
          title: form.title.trim(),
          description: form.description,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          privacy: form.privacy,
          categoryId: form.categoryId,
        }),
      })
      if (muqova) {
        const b64 = await faylniOqi(muqova)
        await api("/youtube/manage?action=thumbnail", {
          method: "POST", body: JSON.stringify({ id: v.id, image: b64 }),
        })
      }
      onSaved()
    } catch (e) {
      setXabar(`❌ ${e instanceof Error ? e.message : tr("Saqlanmadi")}`)
    } finally {
      setBand(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-green/10 px-6 py-4">
          <h3 className="font-display text-lg font-extrabold">{tr("Videoni tahrirlash")}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-soft">
            <Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6">
          {xabar && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{xabar}</div>}

          <div className="flex items-center gap-3">
            {v.thumbnail && <img src={v.thumbnail} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" />}
            <label className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-muted">{tr("Yangi muqova")}<span className="font-normal">{tr(" (2 MB gacha)")}</span></span>
              <input type="file" accept="image/jpeg,image/png" onChange={(e) => setMuqova(e.target.files?.[0] || null)}
                className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-green file:px-2 file:py-1 file:text-xs file:font-bold file:text-white" />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-muted">{tr("Sarlavha")}</span>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={100}
              className="mt-1 w-full rounded-lg border border-green/20 px-3 py-2 text-sm outline-none focus:border-green" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted">{tr("Tavsif")}</span>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={6} maxLength={5000}
              className="mt-1 w-full resize-none rounded-lg border border-green/20 px-3 py-2 text-sm outline-none focus:border-green" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted">{tr("Teglar")}</span>
            <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder={tr("vergul bilan ajrating")}
              className="mt-1 w-full rounded-lg border border-green/20 px-3 py-2 text-sm outline-none focus:border-green" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted">{tr("Kim ko'ra oladi")}</span>
              <select value={form.privacy} onChange={(e) => setForm((f) => ({ ...f, privacy: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green">
                <option value="private">{tr("Yopiq")}</option>
                <option value="unlisted">{tr("Havola orqali")}</option>
                <option value="public">{tr("Ochiq")}</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted">{tr("Turkum")}</span>
              <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-green/20 bg-white px-3 py-2 text-sm outline-none focus:border-green">
                {turkumlar.length === 0 && <option value={form.categoryId}>{tr("Joriy turkum")}</option>}
                {turkumlar.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-green/10 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border-2 border-green/30 px-5 py-2.5 text-sm font-bold">{tr("Bekor qilish")}</button>
          <button onClick={saqla} disabled={band}
            className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {band ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon d={I.check} className="h-4 w-4" />}
            {tr("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  )
}
