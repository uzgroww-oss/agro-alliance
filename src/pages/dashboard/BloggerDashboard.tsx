import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import DashboardLayout from "../../components/DashboardLayout"
import MediaUpload from "../../components/MediaUpload"

import { Icon, I } from "../../lib/ui"
import { Skeleton, SkeletonTable, SkeletonStatGrid, ErrorState, useBusy } from "../../lib/ui"
import { api, type User } from "../../lib/api"
import { useAuth } from "../../lib/auth"
import { categories } from "../../lib/bloggers"

const VILOYATLAR = [
  "Qoraqalpog'iston Respublikasi",
  "Andijon viloyati",
  "Buxoro viloyati",
  "Farg'ona viloyati",
  "Jizzax viloyati",
  "Namangan viloyati",
  "Navoiy viloyati",
  "Qashqadaryo viloyati",
  "Samarqand viloyati",
  "Sirdaryo viloyati",
  "Surxondaryo viloyati",
  "Toshkent viloyati",
  "Toshkent shahri",
  "Xorazm viloyati",
]

const nav = [
  { label: "Dashboard", icon: I.home },
  { label: "Topshiriqlar", icon: I.task },
  { label: "Profilim", icon: I.user },
  { label: "Ijtimoiy tarmoqlar", icon: I.link2 },
  { label: "Videolar", icon: I.media },
  { label: "Rasmlar", icon: I.image },
  { label: "Xizmatlar", icon: I.check },
  { label: "Hududlar", icon: I.pin },
  { label: "Yo'nalishlar", icon: I.sprout },
  { label: "Yutuqlar", icon: I.trophy },
  { label: "Brendlar", icon: I.building },
  { label: "Auditoriya", icon: I.chart },
]

const platIcon: Record<string, { d: string; color: string }> = {
  YouTube: { d: I.youtube, color: "#FF0000" },
  Instagram: { d: I.instagram, color: "#E1306C" },
  TikTok: { d: I.tiktok, color: "#000000" },
  Telegram: { d: I.telegram, color: "#229ED9" },
  Facebook: { d: I.facebook, color: "#1877F2" },
}
const catLabel = (k: string) => categories.find((c) => c.key === k)?.label ?? k

const quickActions: { icon: string; t: string; tab?: string; action?: "reload" }[] = [
  { icon: I.upload, t: "Video yuklash", tab: "Videolar" },
  { icon: I.link2, t: "Silka biriktirish", tab: "Ijtimoiy tarmoqlar" },
  { icon: I.refresh, t: "Profilni yangilash", action: "reload" },
  { icon: I.chart, t: "Statistikani ko'rish", tab: "Auditoriya" },
]
const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"

/* ---------- Profile ---------- */
function ProfileCard({ me, reload }: { me: User; reload: () => void }) {
  // "Yangilash" tugmasi bloklanmagan edi: qayta-qayta bosilsa N ta parallel
  // /me so'rovi ketardi va ekranda hech narsa o'zgarmasdi.
  const [refreshing, runRefresh] = useBusy()
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState("")
  const [syncSuccess, setSyncSuccess] = useState("")
  const [youtubeUrl, setYoutubeUrl] = useState((me.profile as Record<string, string>)?.youtube_channel || "")
  const [instagramUrl, setInstagramUrl] = useState((me.profile as Record<string, string>)?.instagram_url || "")
  const [syncingIg, setSyncingIg] = useState(false)
  const [igError, setIgError] = useState("")
  const [igSuccess, setIgSuccess] = useState("")
  const igFromSocials = (me.socials || []).find(s => s.platform === "instagram")
  const [igData, setIgData] = useState<{ profile: { username: string; name: string; biography: string; profile_picture_url: string } | null; stats: { followers_count: number; follows_count: number; media_count: number } | null; media: Array<{ id: string; media_type: string; media_url: string; permalink: string; caption: string; timestamp: string; like_count: number; comments_count: number }> } | null>(
    igFromSocials ? {
      profile: {
        username: igFromSocials.link?.split("/").pop() || "",
        name: igFromSocials.name || "",
        biography: "",
        profile_picture_url: igFromSocials.avatar || "",
      },
      stats: {
        followers_count: Number(igFromSocials.subscribers) || 0,
        follows_count: 0,
        media_count: 0,
      },
      media: [],
    } : null
  )
  // Avtomatik sinxronizatsiya davomida "Instagram ulanmagan" formasi ko'rinardi,
  // ya'ni ulangan foydalanuvchiga ham "ulang" deb turardi. Endi shu holat kuzatiladi.
  const [autoSyncing, setAutoSyncing] = useState(Boolean(instagramUrl && (!igFromSocials || !igData?.media?.length)))
  useEffect(() => {
    if (instagramUrl && (!igFromSocials || !igData?.media?.length)) {
      (async () => {
        try {
          const res = await api<any>("/me/profile", { method: "PUT", body: JSON.stringify({ instagram_url: instagramUrl }) })
          if (res.profile || res.stats) setIgData({ profile: res.profile, stats: res.stats, media: res.media || [] })
        } catch { /* skip */ } finally { setAutoSyncing(false) }
      })()
    }
  }, [])

  const p = me.profile || {}
  const [form, setForm] = useState({ name: me.name, age: String(p.age ?? ""), gender: String(p.gender ?? ""), region: String(p.region ?? ""), language: String(p.language ?? ""), niche: String(p.niche ?? ""), bio: String(p.bio ?? ""), about: String(p.about ?? "") })
  const initials = me.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const save = async () => {
    setSaving(true)
    try { await api("/me/profile", { method: "PUT", body: JSON.stringify(form) }); setEdit(false) }
    finally { setSaving(false) }
  }

  const syncYoutube = async () => {
    setSyncError("")
    setSyncSuccess("")
    if (!youtubeUrl.trim()) { setSyncError("YouTube kanal linkini kiriting"); return }
    if (!youtubeUrl.match(/(youtube\.com|youtu\.be)/i)) { setSyncError("Yaroqli YouTube URL kiriting"); return }
    setSyncing(true)
    try {
      const res = await api<{ success: boolean; avatar: string; banner: string; channel_name: string }>("/me/profile", {
        method: "PUT",
        body: JSON.stringify({ youtube_url: youtubeUrl.trim() })
      })
      setSyncSuccess(`Muvaffaqiyatli sinxronlandi: ${res.channel_name}`)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Xatolik yuz berdi")
    } finally {
      setSyncing(false)
    }
  }

  const rows: [string, "name" | "age" | "gender" | "region" | "language" | "niche" | "bio" | "about", string, string][] = [
    ["Ism", "name", I.user, me.name],
    ["Yosh", "age", I.gear, String(p.age || "—")],
    ["Jinsi", "gender", I.users, String(p.gender || "—")],
    ["Hudud", "region", I.pin, String(p.region || "—")],
    ["Til", "language", I.globe, String(p.language || "—")],
    ["Yo'nalish", "niche", I.sprout, catLabel(String(p.niche || ""))],
    ["Bio", "bio", I.doc, String(p.bio || "—")],
    ["Haqida", "about", I.doc, p.about ? String(p.about).slice(0, 50) + "…" : "—"],
  ]

  return (
    <div className={card}>
      <h3 className="font-display text-lg font-bold">Profil ma'lumotlari</h3>
      <div className="mt-4">
        {/* YouTube Sync Section */}
        <div className="mb-4 rounded-xl border border-green/20 bg-soft p-3">
          <div className="flex items-center gap-2 text-green mb-2">
            <Icon d={I.youtube} className="h-4 w-4" />
            <span className="font-display text-xs font-bold">YouTube kanal</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/@yourchannel"
              className="flex-1 min-w-[160px] rounded-lg border border-green/20 bg-white px-2.5 py-2 text-xs outline-none focus:border-green"
            />
            <button
              onClick={syncYoutube}
              disabled={syncing || !youtubeUrl.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white shadow transition-transform hover:scale-105 disabled:opacity-60"
            >
              {syncing ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Icon d={I.refresh} className="h-4 w-4" />
              )}
              {syncing ? "Sinxronlanmoqda..." : "Sinxronlash"}
            </button>
          </div>
          {syncError && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v4 M12 16h.01" className="h-3.5 w-3.5 shrink-0" />
              {syncError}
            </div>
          )}
          {syncSuccess && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-green/10 px-3 py-2 text-xs text-green">
              <Icon d={I.check} className="h-3.5 w-3.5 shrink-0" />
              {syncSuccess}
            </div>
          )}
        </div>

        {/* Instagram Sync Section */}
        <div className="mb-4 rounded-xl border border-pink-200 bg-pink-50/50 p-3">
          <div className="flex items-center gap-2 text-pink-600 mb-2">
            <Icon d={I.instagram} className="h-4 w-4" />
            <span className="font-display text-xs font-bold">Instagram akkaunt</span>
          </div>

          {igData ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                {igData.profile?.profile_picture_url && (
                  <img src={igData.profile.profile_picture_url} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-pink-200" />
                )}
                <div>
                  <p className="text-sm font-bold">{igData.profile?.name || igData.profile?.username}</p>
                  <p className="text-[11px] text-muted">@{igData.profile?.username}</p>
                </div>
                <div className="ml-auto flex gap-4 text-center">
                  <div>
                    <p className="text-sm font-bold">{igData.stats?.followers_count?.toLocaleString() || 0}</p>
                    <p className="text-[10px] text-muted">Obunachilar</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{igData.stats?.media_count || 0}</p>
                    <p className="text-[10px] text-muted">Postlar</p>
                  </div>
                </div>
              </div>

              {igData.media && igData.media.length > 0 && (
                <div className="grid grid-cols-6 gap-1 mb-3">
                  {igData.media.map((m) => (
                    <a key={m.id} href={m.permalink} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden rounded-md bg-pink-100">
                      {m.media_url ? (
                        <img src={m.media_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-pink-400"><Icon d={I.instagram} className="h-3.5 w-3.5" /></span>
                      )}
                      {m.media_type === "VIDEO" && (
                        <span className="absolute top-0.5 right-0.5 grid h-3 w-3 place-items-center rounded-full bg-black/60 text-white"><Icon d={I.play} className="h-2 w-2" /></span>
                      )}
                    </a>
                  ))}
                </div>
              )}

              {igData.profile?.biography && (
                <p className="text-[10px] text-muted line-clamp-2 mb-2">{igData.profile.biography}</p>
              )}

              <button onClick={() => { setIgData(null); setInstagramUrl("") }} className="text-[10px] text-pink-500 hover:underline">
                Akkauntni o'zgartirish
              </button>
            </div>
          ) : autoSyncing ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-20" /></div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://www.instagram.com/yourusername"
                  className="flex-1 min-w-[160px] rounded-lg border border-pink-300/50 bg-white px-2.5 py-2 text-xs outline-none focus:border-pink-500"
                />
                <button
                  onClick={async () => {
                    setIgError(""); setIgSuccess("")
                    if (!instagramUrl.trim()) { setIgError("Instagram linkini kiriting"); return }
                    if (!instagramUrl.match(/instagram\.com/i)) { setIgError("Yaroqli Instagram URL kiriting"); return }
                    setSyncingIg(true)
                    try {
                      type IgRes = { success: boolean; profile: any; stats: any; media: any[]; error?: string }
                      const res = await api<IgRes>("/me/profile", { method: "PUT", body: JSON.stringify({ instagram_url: instagramUrl.trim() }) })
                      if (res.error) {
                        setIgError(res.error)
                      } else if (res.profile || res.stats) {
                        setIgData({ profile: res.profile, stats: res.stats, media: res.media || [] })
                        setIgSuccess("Instagram akkaunt muvaffaqiyatli sinxronlandi!")
                      } else {
                        setIgSuccess("Instagram akkaunt saqlandi!")
                      }
                    } catch (err) {
                      setIgError(err instanceof Error ? err.message : "Xatolik")
                    } finally { setSyncingIg(false) }
                  }}
                  disabled={syncingIg || !instagramUrl.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow transition-transform hover:scale-105 disabled:opacity-60"
                >
                  {syncingIg ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Icon d={I.refresh} className="h-4 w-4" />
                  )}
                  {syncingIg ? "Sinxronlanmoqda..." : "Sinxronlash"}
                </button>
              </div>
              {igError && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v4 M12 16h.01" className="h-3.5 w-3.5 shrink-0" />
                  {igError}
                </div>
              )}
              {igSuccess && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-green/10 px-3 py-2 text-xs text-green">
                  <Icon d={I.check} className="h-3.5 w-3.5 shrink-0" />
                  {igSuccess}
                </div>
              )}
            </>
          )}
        </div>

        {/* Banner */}
        <div className="mb-3">
          <div className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-soft">
            {p.banner ? (
              <img src={String(p.banner)} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-muted">Banner YouTube'dan yuklanadi</span>
            )}
          </div>
        </div>
        {/* Avatar */}
        <div className="mb-3 flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-green/10 ring-2 ring-soft">
            {p.photo ? (
              <img src={String(p.photo)} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center font-display text-lg font-extrabold text-green">{initials}</span>
            )}
          </div>
          <span className="text-[11px] text-muted">Profil rasmi</span>
        </div>
        {/* Fields */}
        <div className="space-y-2">
          {rows.slice(0, 6).map(([label, key, icon, display]) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <Icon d={icon} className="h-3.5 w-3.5 shrink-0 text-muted" />
              <span className="w-16 shrink-0 text-muted">{label}</span>
              {edit && key === "region" ? (
                <select value={form.region} onChange={(e) => setForm((s) => ({ ...s, region: e.target.value }))} className="flex-1 rounded-lg border border-green/20 px-2 py-1 text-xs outline-none focus:border-green">
                  <option value="">Viloyatni tanlang</option>
                  {VILOYATLAR.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : edit && key !== "niche" ? (
                <input value={form[key]} onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))} className="flex-1 rounded-lg border border-green/20 px-2 py-1 text-xs outline-none focus:border-green" />
              ) : edit && key === "niche" ? (
                <select value={form.niche} onChange={(e) => setForm((s) => ({ ...s, niche: e.target.value }))} className="flex-1 rounded-lg border border-green/20 px-2 py-1 text-xs outline-none">
                  {categories.filter((c) => c.key !== "all").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              ) : (
                <span className="font-semibold truncate">{display}</span>
              )}
            </div>
          ))}
          {edit && (
            <>
              <div className="flex items-start gap-3 text-sm">
                <Icon d={I.fileText} className="h-4 w-4 shrink-0 text-muted mt-1" />
                <span className="w-20 shrink-0 text-muted text-xs">Bio (qisqa)</span>
                <input value={form.bio} onChange={(e) => setForm((s) => ({ ...s, bio: e.target.value }))} placeholder="10 ta so'z atrofida" maxLength={120} className="flex-1 rounded-lg border border-green/20 px-2 py-1 outline-none focus:border-green" />
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Icon d={I.fileText} className="h-4 w-4 shrink-0 text-muted mt-1" />
                <span className="w-20 shrink-0 text-muted text-xs">Haqida</span>
                <textarea value={form.about} onChange={(e) => setForm((s) => ({ ...s, about: e.target.value }))} rows={3} className="flex-1 rounded-lg border border-green/20 px-2 py-1 outline-none focus:border-green resize-none" />
              </div>
            </>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => (edit ? save() : setEdit(true))} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-green px-4 py-2 text-xs font-bold text-white shadow transition-transform hover:scale-105 disabled:opacity-60">
          {edit ? (saving ? "Saqlanmoqda…" : "Saqlash") : "Tahrirlash"} <Icon d={edit ? "M9 12l2 2 4-4" : "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"} className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => runRefresh(reload)} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-lg border border-green/25 px-3 py-2 text-xs font-bold transition-colors hover:border-green hover:text-green disabled:opacity-60">
          {refreshing ? "Yangilanmoqda…" : "Yangilash"} <Icon d={I.refresh} className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  )
}

/* ---------- Socials ---------- */
function SocialsCard({ me: _me, reload: _reload }: { me: User; reload: () => void }) {
  const [socials, setSocials] = useState(_me.socials || [])
  const [adding, setAdding] = useState(false)
  const [link, setLink] = useState("")
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Set<string>>(new Set())

  // Ro'yxat props'dan bir marta olinardi va qo'shgandan keyin yangilanmasdi:
  // foydalanuvchi yangi tarmoqni ko'rmay, "Qo'shish" ni yana bosardi (dublikat).
  useEffect(() => { setSocials(_me.socials || []) }, [_me.socials])

  const add = async () => {
    if (!link.trim()) return
    setBusy(true)
    try {
      await api("/me/socials", { method: "POST", body: JSON.stringify({ link }) })
      setLink("")
      setAdding(false)
      await _reload()
    } finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setDeleting((prev) => new Set(prev).add(id))
    try {
      setSocials((prev) => prev.filter((s) => s.id !== id))
      await api(`/me/socials/${id}`, { method: "DELETE" })
    } finally {
      setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }
  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Ijtimoiy tarmoqlarim</h3>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1.5 rounded-lg border border-green/20 px-3 py-2 text-xs font-bold text-green transition-colors hover:bg-green hover:text-white">
          <Icon d={I.plus} className="h-4 w-4" /> Qo'shish
        </button>
      </div>
      {adding && (
        <div className="mt-3 rounded-xl bg-soft p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="YouTube, Instagram, TikTok, Telegram..." className="flex-1 min-w-[180px] rounded-lg border border-green/20 px-2.5 py-1.5 text-xs outline-none focus:border-green" />
            <button onClick={add} disabled={busy} className="rounded-lg bg-green px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">{busy ? "..." : "Qo'shish"}</button>
          </div>
        </div>
      )}
      <div className="mt-3 space-y-2">
        {socials.length === 0 && <p className="py-3 text-center text-xs text-muted">Hali tarmoq qo'shilmagan.</p>}
        {socials.map((s) => {
          const pi = platIcon[s.platform] ?? { d: I.link2, color: "#5bb420" }
          return (
            <div key={s.id} className="flex items-center gap-2.5 rounded-lg border border-green/8 bg-[#fafdf7] px-2.5 py-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white shadow-sm" style={{ color: pi.color }}><Icon d={pi.d} className="h-3.5 w-3.5" /></span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{s.name || s.platform}</span>
              <a href={s.link.startsWith("http") ? s.link : `https://${s.link}`} target="_blank" rel="noreferrer" className="shrink-0 text-muted hover:text-green"><Icon d={I.external} className="h-3 w-3" /></a>
              <button onClick={() => remove(s.id)} disabled={deleting.has(s.id)} className="shrink-0 grid h-5 w-5 place-items-center rounded text-red-400 hover:bg-red-50 disabled:opacity-40">
                {deleting.has(s.id) ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-red-400 border-t-transparent" /> : <Icon d="M18 6L6 18 M6 6l12 12" className="h-3 w-3" />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Videos ---------- */
function VideosCard({ me, reload: _reload }: { me: User; reload: () => void }) {
  const [videos, setVideos] = useState<NonNullable<typeof me.videos>>(me.videos || [])
  const [adding, setAdding] = useState(false)
  const [link, setLink] = useState("")
  const [busy, setBusy] = useState(false)
  const [linkError, setLinkError] = useState("")
  const [loadingYoutube, setLoadingYoutube] = useState(false)
  const [youtubeChannelVids, setYoutubeChannelVids] = useState<Array<{ id: string; title: string; thumbnail: string; publishedAt: string; viewCount: string }>>([])
  const [selectedVids, setSelectedVids] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Alohida holat: ilgari `busy` ni qo'lda qo'shish va YouTube'dan saqlash
  // birga ishlatardi, natijada bittasi ikkinchisining tugmasini bloklardi.
  const [savingSelected, setSavingSelected] = useState(false)

  useEffect(() => { fetchYoutubeChannelVideos() }, [])

  const add = async () => {
    setLinkError("")
    if (!link.trim()) { setLinkError("Link kiriting"); return }
    if (!link.trim().match(/^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%.+~#=]{1,256}\.[a-zA-Z]{2,}/)) {
      setLinkError("Yaroqli URL formatida emas")
      return
    }
    setBusy(true)
    try {
      const res = await api<{ success: boolean; video: (typeof videos)[0] }>("/me/videos", { method: "POST", body: JSON.stringify({ link: link.trim() }) })
      if (res.video) setVideos((prev) => [...prev, res.video])
      setLink(""); setAdding(false); setLinkError("")
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Xatolik yuz berdi")
    }
    finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setDeleting(true)
    await api(`/me/videos/${id}`, { method: "DELETE" })
    setVideos((prev) => prev.filter((v) => v.id !== id))
    setDeleting(false)
    setDeleteTarget(null)
  }

  // YouTube kanal videolarini olish
  const fetchYoutubeChannelVideos = async () => {
    setLoadingYoutube(true)
    try {
      const data = await api<{ videos: Array<{ id: string; title: string; thumbnail: string; publishedAt: string; viewCount: string }> }>("/me/youtube-videos")
      setYoutubeChannelVids(data.videos || [])
    } catch (err) {
      console.error("YouTube videolarni olishda xatolik:", err)
    } finally {
      setLoadingYoutube(false)
    }
  }

  // Instagram postlarini olish — qo'yilgan link egasining username'ini ajratib olish
  const extractIgUsername = (raw: string): string => {
    if (!raw) return ""
    const url = raw.trim()
    // to'liq link bo'lsa
    const m = url.match(/instagram\.com\/([^/?#]+)/i)
    let seg = m ? m[1] : url.replace(/^@/, "")
    seg = seg.replace(/[^a-zA-Z0-9_.].*$/, "") // faqat username qismini qoldirish
    const skip = ["p", "reel", "reels", "tv", "stories", "explore", "s"]
    if (!seg || skip.includes(seg.toLowerCase())) return ""
    return seg
  }
  // Eng so'nggi qo'yilgan Instagram linkini afzal ko'rish (socials > profile.instagram_url)
  const igSocial = (me.socials || []).find(
    (s) => /instagram/i.test(String(s.platform)) || /instagram\.com/i.test(String(s.link || "")),
  )
  const igUsername =
    extractIgUsername(igSocial?.link || "") ||
    extractIgUsername(String((me.profile as Record<string, string>)?.instagram_url || ""))
  const [igPosts, setIgPosts] = useState<Array<{ id: string; media_type: string; media_url: string; permalink: string; caption: string; timestamp: string; like_count: number; comments_count: number }>>([])
  const [loadingIg, setLoadingIg] = useState(false)
  const [selectedIgPosts, setSelectedIgPosts] = useState<Set<string>>(new Set())
  const [savingIg, setSavingIg] = useState(false)

  const fetchInstagramPosts = async () => {
    if (!igUsername) return
    setLoadingIg(true)
    try {
      const data = await api<{ success: boolean; media: typeof igPosts }>("/instagram-fetch", {
        method: "POST", body: JSON.stringify({ username: igUsername })
      })
      setIgPosts(data.media || [])
    } catch (err) {
      console.error("Instagram postlarni olishda xatolik:", err)
    } finally {
      setLoadingIg(false)
    }
  }
  useEffect(() => { fetchInstagramPosts() }, [])

  const igAdded = (m: { id: string; permalink: string }) => videos.some((v) => v.id === m.id || v.link === m.permalink)

  const toggleIgSelection = (postId: string) => {
    setSelectedIgPosts((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  // Tanlangan Instagram postlarni profilga saqlash
  const saveSelectedIgPosts = async () => {
    if (selectedIgPosts.size === 0) return
    setSavingIg(true)
    try {
      const chosen = igPosts.filter((m) => selectedIgPosts.has(m.id) && !igAdded(m))
      const results = await Promise.allSettled(
        chosen.map((m) =>
          api<{ success: boolean; video: (typeof videos)[0] }>("/me/videos", {
            method: "POST",
            body: JSON.stringify({
              link: m.permalink,
              youtube_id: m.id,
              name: m.caption ? m.caption.slice(0, 80) : "Instagram post",
              thumbnail: m.media_type === "VIDEO" ? null : m.media_url,
              views: String(m.like_count || 0),
              date: (m.timestamp || "").split("T")[0],
            }),
          })
        )
      )
      const added = results.reduce<(typeof videos)[0][]>((acc, r) => {
        if (r.status === "fulfilled" && r.value.video) acc.push(r.value.video)
        return acc
      }, [])
      if (added.length) setVideos((prev) => [...prev, ...added])
      setSelectedIgPosts(new Set())
    } catch (err) {
      console.error("Instagram postlarni saqlashda xatolik:", err)
    } finally {
      setSavingIg(false)
    }
  }

  // Videoni tanlash/ochirish
  const toggleVideoSelection = (videoId: string) => {
    setSelectedVids((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) next.delete(videoId)
      else next.add(videoId)
      return next
    })
  }

  // Tanlangan videolarni saqlash
  const saveSelectedVideos = async () => {
    if (selectedVids.size === 0 || savingSelected) return
    setSavingSelected(true)
    try {
      // Tanlangan videolarni metadata'ga qo'shish
      const selectedVideos = youtubeChannelVids
        .filter((v) => selectedVids.has(v.id))
        .map((v) => ({
          id: v.id,
          name: v.title,
          link: `https://www.youtube.com/watch?v=${v.id}`,
          thumbnail: v.thumbnail,
          views: v.viewCount,
          plats: ["YouTube"],
          date: v.publishedAt,
          status: "published",
        }))

      // Mavjud videolarni saqlab qolish, yangilarini qo'shish
      const existingIds = new Set(videos.map((v) => v.id))
      const newVids = selectedVideos.filter((v) => !existingIds.has(v.id))

      if (newVids.length > 0) {
        // Barcha saqlashlarni parallel bajarish
        const results = await Promise.allSettled(
          newVids.map((vid) =>
            api<{ success: boolean; video: (typeof videos)[0] }>("/me/videos", {
              method: "POST", body: JSON.stringify({
                link: vid.link,
                youtube_id: vid.id,
                name: vid.name,
                thumbnail: vid.thumbnail,
                views: vid.views,
                date: vid.date,
              })
            })
          )
        )
        const added = results.reduce<(typeof videos)[0][]>((acc, r) => {
          if (r.status === "fulfilled" && r.value.video) acc.push(r.value.video)
          return acc
        }, [])
        if (added.length) setVideos((prev) => [...prev, ...added])
      }
      setSelectedVids(new Set())
    } catch (err) {
      console.error("Videolarni saqlashda xatolik:", err)
    } finally {
      setSavingSelected(false)
    }
  }

  return (
    <div className={card}>
      {/* YouTube kanal videolari — tepada */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Icon d={I.youtube} className="h-4 w-4 text-red-500" />
              YouTube kanal videolari
            </h3>
            <p className="text-[11px] text-muted">Kanal videolarini tanlab profilga qo'shing.</p>
          </div>
          <button
            onClick={fetchYoutubeChannelVideos}
            disabled={loadingYoutube}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green/20 px-3 py-1.5 text-[11px] font-bold text-green transition-colors hover:bg-green hover:text-white disabled:opacity-60"
          >
            {loadingYoutube ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Icon d={I.refresh} className="h-3 w-3" />
            )}
            {loadingYoutube ? "Yuklanmoqda..." : "Yangilash"}
          </button>
        </div>

        {loadingYoutube && (
          <div className="grid gap-1 grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
            ))}
          </div>
        )}

        {!loadingYoutube && youtubeChannelVids.length === 0 && (
          <p className="py-4 text-center text-xs text-muted border border-dashed border-green/20 rounded-lg">YouTube kanal ulanmagan yoki videolar topilmadi.</p>
        )}

        {!loadingYoutube && youtubeChannelVids.length > 0 && (
          <>
            {selectedVids.size > 0 && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-green/10 px-3 py-2">
                <span className="text-[11px] font-semibold text-green">{selectedVids.size} ta tanlandi</span>
                <button onClick={saveSelectedVideos} disabled={savingSelected} className="rounded-md bg-green px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-60">
                  {savingSelected ? "Saqlanmoqda..." : "Profilga qo'shish"}
                </button>
              </div>
            )}
            <div className="grid gap-1 grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
              {youtubeChannelVids.map((v) => {
                const isAdded = videos.some((vid) => vid.id === v.id)
                return (
                  <div
                    key={v.id}
                    className={`relative rounded-lg border p-0.5 transition-all ${
                      isAdded ? "border-green/30 bg-green/5 opacity-75" : selectedVids.has(v.id) ? "border-green bg-green/5" : "border-green/10 hover:border-green/30"
                    } ${isAdded ? "cursor-default" : "cursor-pointer"}`}
                    onClick={() => !isAdded && toggleVideoSelection(v.id)}
                  >
                    <div className="relative overflow-hidden rounded">
                      {v.thumbnail ? (
                        <img src={v.thumbnail} alt={v.title} className="aspect-[2/3] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[2/3] w-full items-center justify-center bg-soft text-green"><Icon d={I.play} className="h-3.5 w-3.5" /></div>
                      )}
                      <div className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-0.5 py-[1px] text-[7px] text-white">
                        {parseInt(v.viewCount).toLocaleString()}
                      </div>
                      {isAdded && (
                        <div className="absolute top-0.5 left-0.5 rounded bg-green/90 px-0.5 py-[1px] text-[7px] font-bold text-white">Qo'shilgan</div>
                      )}
                      {!isAdded && selectedVids.has(v.id) && (
                        <div className="absolute top-0.5 left-0.5 grid h-3 w-3 place-items-center rounded-full bg-green text-white">
                          <Icon d={I.check} className="h-1.5 w-1.5" />
                        </div>
                      )}
                    </div>
                    <p className="mt-px text-[7px] font-medium line-clamp-1 leading-tight text-muted">{v.title}</p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Instagram postlari */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Icon d={I.instagram} className="h-4 w-4 text-pink-500" />
              Instagram postlari
              {igUsername && <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-600">@{igUsername}</span>}
            </h3>
            <p className="text-[11px] text-muted">Instagram postlaringizni tanlab profilga qo'shing.</p>
          </div>
          <button
            onClick={fetchInstagramPosts}
            disabled={loadingIg || !igUsername}
            className="inline-flex items-center gap-1.5 rounded-lg border border-pink-300/50 px-3 py-1.5 text-[11px] font-bold text-pink-500 transition-colors hover:bg-pink-500 hover:text-white disabled:opacity-60"
          >
            {loadingIg ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Icon d={I.refresh} className="h-3 w-3" />
            )}
            {loadingIg ? "Yuklanmoqda..." : "Yangilash"}
          </button>
        </div>

        {!igUsername && (
          <p className="py-4 text-center text-xs text-muted border border-dashed border-pink-300/50 rounded-lg">Instagram akkaunt ulanmagan. "Profilim" bo'limida Instagram linkingizni sinxronlang.</p>
        )}

        {igUsername && loadingIg && (
          <div className="grid gap-1 grid-cols-3 sm:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        )}

        {igUsername && !loadingIg && igPosts.length === 0 && (
          <p className="py-4 text-center text-xs text-muted border border-dashed border-pink-300/50 rounded-lg">Instagram postlari topilmadi. Akkaunt Business/Creator turida ekanini tekshiring.</p>
        )}

        {!loadingIg && igPosts.length > 0 && (
          <>
            {selectedIgPosts.size > 0 && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-pink-50 px-3 py-2">
                <span className="text-[11px] font-semibold text-pink-600">{selectedIgPosts.size} ta tanlandi</span>
                <button onClick={saveSelectedIgPosts} disabled={savingIg} className="rounded-md bg-pink-500 px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-60">
                  {savingIg ? "Saqlanmoqda..." : "Profilga qo'shish"}
                </button>
              </div>
            )}
            <div className="grid gap-1 grid-cols-3 sm:grid-cols-6">
              {igPosts.map((m) => {
                const isAdded = igAdded(m)
                return (
                  <div
                    key={m.id}
                    className={`relative rounded-lg border p-0.5 transition-all ${
                      isAdded ? "border-pink-300/50 bg-pink-50 opacity-75" : selectedIgPosts.has(m.id) ? "border-pink-500 bg-pink-50" : "border-pink-200/50 hover:border-pink-400"
                    } ${isAdded ? "cursor-default" : "cursor-pointer"}`}
                    onClick={() => !isAdded && toggleIgSelection(m.id)}
                  >
                    <div className="relative overflow-hidden rounded bg-pink-50">
                      {m.media_url ? (
                        <img src={m.media_url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center bg-pink-100 text-pink-400">
                          <Icon d={I.instagram} className="h-5 w-5" />
                        </div>
                      )}
                      <div className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded bg-black/70 px-1 py-[1px] text-[8px] text-white">
                        ♥ {(m.like_count || 0).toLocaleString()}
                      </div>
                      {m.media_type === "VIDEO" && (
                        <div className="absolute top-0.5 right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-black/60 text-white">
                          <Icon d={I.play} className="h-2 w-2" />
                        </div>
                      )}
                      {isAdded && (
                        <div className="absolute top-0.5 left-0.5 rounded bg-pink-500/90 px-1 py-[1px] text-[8px] font-bold text-white">Qo'shilgan</div>
                      )}
                      {!isAdded && selectedIgPosts.has(m.id) && (
                        <div className="absolute top-0.5 left-0.5 grid h-4 w-4 place-items-center rounded-full bg-pink-500 text-white">
                          <Icon d={I.check} className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </div>
                    {m.caption && <p className="mt-px text-[8px] font-medium line-clamp-1 leading-tight text-muted">{m.caption}</p>}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Tanlangan / Qo'shilgan videolar — pastda */}
      <div className="border-t border-green/10 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base font-bold">Profilimdagi videolar</h3>
          <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1 rounded-lg bg-green px-2.5 py-1.5 text-[10px] font-bold text-white">
            <Icon d={I.plus} className="h-3 w-3" /> Qo'shish
          </button>
        </div>

        {adding && (
          <div className="mb-3 rounded-lg bg-soft p-2.5">
            <div className="flex items-center gap-2">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Video linkini joylang..." className="flex-1 rounded-lg border border-green/20 px-2.5 py-1.5 text-xs outline-none focus:border-green" />
              <button onClick={add} disabled={busy} className="rounded-md bg-green px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-60">{busy ? "..." : "Qo'shish"}</button>
            </div>
            {linkError && <p className="mt-1 text-[10px] text-red-500">{linkError}</p>}
          </div>
        )}

        {videos.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">Hali video qo'shilmagan.</p>
        ) : (
          <div className="space-y-1.5">
            {videos.map((v) => (
              <div key={v.id} className="flex items-center gap-2 rounded-lg border border-green/8 bg-[#fafdf7] px-2.5 py-2">
                {v.thumbnail ? (
                  <img src={v.thumbnail} alt="" className="h-8 w-12 shrink-0 rounded object-cover" />
                ) : (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-green/10 text-green"><Icon d={I.play} className="h-3 w-3" /></span>
                )}
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{v.name}</span>
                <span className="text-[9px] text-muted shrink-0">{v.views} ko'rish</span>
                <button onClick={() => setDeleteTarget(v.id)} className="shrink-0 grid h-7 w-7 place-items-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                  <Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* O'chirish modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              {deleting ? (
                <span className="grid h-14 w-14 place-items-center rounded-full bg-green/10">
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-green border-t-transparent" />
                </span>
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-full bg-red-50">
                  <Icon d="M12 9v4 M12 17h.01 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" className="h-7 w-7 text-red-500" />
                </span>
              )}
              <h3 className="mt-4 font-display text-lg font-extrabold">{deleting ? "O'chirilmoqda..." : "Videoni o'chirish"}</h3>
              <p className="mt-2 text-sm text-muted">{deleting ? "Iltimos kuting..." : "Bu videoni o'chirishni xohlaysizmi?"}</p>
            </div>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-xl border-2 border-green/30 px-6 py-2.5 text-sm font-bold text-ink transition-colors hover:border-green hover:text-green disabled:opacity-50">
                Bekor qilish
              </button>
              <button onClick={() => remove(deleteTarget)} disabled={deleting} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/30 transition-transform hover:scale-105 disabled:opacity-60">
                {deleting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" className="h-4 w-4" />
                )}
                {deleting ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Overview({ me, reload, onNav }: { me: User; reload: () => void; onNav: (tab: string) => void }) {
  const [refreshing, setRefreshing] = useState(false)
  const doRefresh = async () => {
    setRefreshing(true)
    try { await reload() } finally { setTimeout(() => setRefreshing(false), 400) }
  }
  const socialCount = me.socials?.length || 0
  const videoCount = me.videos?.length || 0
  const statCards = [
    { icon: I.link2, t: "Ijtimoiy tarmoqlar", v: String(socialCount), delta: `${socialCount} ta ulangan` },
    { icon: I.media, t: "Joylangan videolar", v: String(videoCount), delta: videoCount ? `${videoCount} ta video` : "Hali yo'q" },
    { icon: I.chart, t: "Profil holati", v: me.status === "active" ? "Faol" : "Yangi", delta: me.status === "active" ? "Tasdiqlangan" : "Kutilmoqda" },
  ]

  return (
    <>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Bloger Dashboard</h1>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((s) => (
          <div key={s.t} className={card.replace("p-6", "p-5")}>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-soft text-green"><Icon d={s.icon} className="h-5 w-5" /></span>
            <div className="mt-3 text-xs text-muted">{s.t}</div>
            <div className="mt-1 font-display text-2xl font-extrabold">{s.v}</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-green"><Icon d="M5 15l7-7 7 7" className="h-3 w-3" /> {s.delta}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Chap ustun — Profile */}
        <ProfileCard me={me} reload={reload} />
        {/* O'ng ustun — Socials + Tezkor amallar */}
        <div className="flex flex-col gap-5">
          <SocialsCard me={me} reload={reload} />
          <div className={card}>
            <h3 className="font-display text-base font-bold">Tezkor amallar</h3>
            <div className="mt-3 space-y-2">
              {quickActions.map((a) => {
                const isRefresh = a.action === "reload"
                const busy = isRefresh && refreshing
                return (
                  <button
                    key={a.t}
                    onClick={() => (isRefresh ? doRefresh() : a.tab && onNav(a.tab))}
                    disabled={busy}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-green/10 bg-[#fafdf7] px-3 py-2.5 text-xs font-semibold transition-colors hover:border-green/30 hover:bg-soft disabled:opacity-60"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-green shadow-sm">
                      {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-green border-t-transparent" /> : <Icon d={a.icon} className="h-3.5 w-3.5" />}
                    </span>
                    {busy ? "Yangilanmoqda..." : a.t}
                    <Icon d={I.chevRight} className="ml-auto h-3.5 w-3.5 text-muted" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function ProfileTab({ me, reload }: { me: User; reload: () => void }) {
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Profilim</h1>
      <p className="mt-1 text-sm text-muted">Shaxsiy ma'lumotlaringizni tahrirlang.</p>
      <div className="mt-6"><ProfileCard me={me} reload={reload} /></div>
    </>
  )
}

function SocialsTab({ me, reload }: { me: User; reload: () => void }) {
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Ijtimoiy tarmoqlar</h1>
      <p className="mt-1 text-sm text-muted">Ijtimoiy tarmoq akkauntlaringizni boshqaring.</p>
      <div className="mt-6"><SocialsCard me={me} reload={reload} /></div>
    </>
  )
}

function VideosTab({ me, reload }: { me: User; reload: () => void }) {
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Videolarim</h1>
      <p className="mt-1 text-sm text-muted">Joylangan videolaringizni boshqaring.</p>
      <div className="mt-6"><VideosCard me={me} reload={reload} /></div>
    </>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-soft text-green"><Icon d={I.gear} className="h-8 w-8" /></span><h2 className="mt-4 font-display text-xl font-bold">{title}</h2><p className="mt-2 text-muted">Bu bo'lim tez orada qo'shiladi.</p></div></div>
  )
}

/* ---------- Services Tab ---------- */
function ServicesTab() {
  const [items, setItems] = useState<{ id: string; title: string; description: string }[]>([])
  const [title, setTitle] = useState("")
  const [desc, setDesc] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  // silent=true -> mutatsiyadan keyingi qayta yuklash. Skeleton ko'rsatilmaydi,
  // aks holda butun forma (input'lar bilan) qayta mount bo'lib, fokus yo'qolardi.
  const load = (silent = false) => {
    if (!silent) setLoading(true)
    api<{ services: { id: string; title: string; description: string }[] }>("/me/services")
      .then((d) => setItems(d.services || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const add = async () => {
    if (!title.trim()) return
    setBusy(true)
    try { await api("/me/services", { method: "POST", body: JSON.stringify({ title: title.trim(), description: desc.trim() }) }); setTitle(""); setDesc(""); load(true) }
    finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setDeleting((prev) => new Set(prev).add(id))
    try { await api(`/me/services/${id}`, { method: "DELETE" }); load(true) }
    finally { setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n }) }
  }

  return (
    <div>
      <h2 className="font-display text-xl font-extrabold tracking-tight">Xizmatlarim</h2>
      <p className="mt-1 text-sm text-muted">Taqdim etayotgan xizmatlaringiz.</p>
      <div className="mt-5 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading ? (
          <SkeletonTable rows={4} cols={3} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Xizmat nomi" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Tavsif (ixtiyoriy)" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
              <button onClick={add} disabled={busy} className="rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Icon d={I.plus} className="h-4 w-4 inline" /> Qo'shish</button>
            </div>
            <div className="mt-4 space-y-2">
              {items.length === 0 && <p className="py-4 text-center text-sm text-muted">Hali xizmat qo'shilmagan.</p>}
              {items.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-green/8 bg-[#fafdf7] px-3 py-2.5">
                  <Icon d={I.check} className="h-4 w-4 shrink-0 text-green" />
                  <span className="flex-1 text-sm font-medium">{s.title}</span>
                  {s.description && <span className="text-xs text-muted">{s.description}</span>}
                  <button onClick={() => remove(s.id)} disabled={deleting.has(s.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-40">
                    {deleting.has(s.id) ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" /> : <Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- Topshiriqlar (TZ) Tab ---------- */
type MeTask = {
  assignment_id: string; status: string; is_read: boolean; note: string | null
  title: string; description: string | null; priority: string; deadline: string | null; created_at: string
  file_url?: string | null; file_name?: string | null
}
const tzPrioLabel: Record<string, string> = { low: "Past", normal: "O'rta", high: "Yuqori" }
const tzPrioColor: Record<string, string> = {
  low: "bg-gray-100 text-gray-600", normal: "bg-blue-100 text-blue-700", high: "bg-red-100 text-red-600",
}
const tzStatusLabel: Record<string, string> = { new: "Yangi", in_progress: "Bajarilmoqda", done: "Bajarildi" }

function TasksTab() {
  const [tasks, setTasks] = useState<MeTask[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // silent=true -> mutatsiyadan keyingi qayta yuklash. Skeleton ko'rsatilmaydi,
  // aks holda butun forma (input'lar bilan) qayta mount bo'lib, fokus yo'qolardi.
  const load = (silent = false) => {
    if (!silent) setLoading(true)
    api<{ tasks: MeTask[] }>("/me/tasks")
      .then((d) => setTasks(d.tasks || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const setStatus = async (id: string, status: string) => {
    setBusy(id)
    setTasks((prev) => prev.map((t) => t.assignment_id === id ? { ...t, status, is_read: true } : t))
    try { await api(`/me/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status, is_read: true }) }) }
    finally { setBusy(null) }
  }

  const unread = tasks.filter((t) => !t.is_read).length

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Topshiriqlarim</h2>
          <p className="mt-1 text-sm text-muted">Administrator tomonidan yuborilgan topshiriqlar (TZ).</p>
        </div>
        {unread > 0 && <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">{unread} ta yangi</span>}
      </div>

      {loading ? (
        <div className="mt-5"><SkeletonTable rows={3} cols={1} /></div>
      ) : tasks.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-green/10 bg-white py-12 text-center">
          <Icon d={I.task} className="mx-auto h-10 w-10 text-green/30" />
          <p className="mt-3 text-sm text-muted">Hozircha topshiriq yo'q.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {tasks.map((t) => (
            <div key={t.assignment_id} className={`${card} ${!t.is_read ? "ring-2 ring-green/30" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tzPrioColor[t.priority] || tzPrioColor.normal}`}>{tzPrioLabel[t.priority] || t.priority}</span>
                  {!t.is_read && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">Yangi</span>}
                  <h3 className="font-display font-bold">{t.title}</h3>
                </div>
                <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${t.status === "done" ? "bg-green/10 text-green" : t.status === "in_progress" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{tzStatusLabel[t.status] || t.status}</span>
              </div>
              {t.description && <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">{t.description}</p>}
              {t.file_url && (
                <a href={t.file_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green/10 px-3 py-1.5 text-xs font-semibold text-green hover:bg-green/20">
                  <Icon d={I.paperclip} className="h-3.5 w-3.5" /> {t.file_name || "TZ faylini yuklab olish"}
                </a>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
                <span>📅 {t.deadline ? `Muddat: ${t.deadline}` : "Muddatsiz"}</span>
                <span>{new Date(t.created_at).toLocaleDateString()}</span>
              </div>
              {/* Holatni o'zgartirish */}
              <div className="mt-3 flex flex-wrap gap-2">
                {[["new", "Yangi"], ["in_progress", "Bajarilmoqda"], ["done", "Bajarildi"]].map(([val, label]) => (
                  <button key={val} disabled={busy === t.assignment_id} onClick={() => setStatus(t.assignment_id, val)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${t.status === val ? "bg-green text-white" : "border border-green/25 text-ink hover:border-green hover:text-green"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Regions Tab ---------- */
function RegionsTab() {
  const [items, setItems] = useState<{ id: string; region: string }[]>([])
  const [region, setRegion] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  // silent=true -> mutatsiyadan keyingi qayta yuklash. Skeleton ko'rsatilmaydi,
  // aks holda butun forma (input'lar bilan) qayta mount bo'lib, fokus yo'qolardi.
  const load = (silent = false) => {
    if (!silent) setLoading(true)
    api<{ regions: { id: string; region: string }[] }>("/me/regions")
      .then((d) => setItems(d.regions || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const add = async () => {
    if (!region.trim()) return
    setBusy(true)
    try { await api("/me/regions", { method: "POST", body: JSON.stringify({ region: region.trim() }) }); setRegion(""); load(true) }
    finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setDeleting((prev) => new Set(prev).add(id))
    try { await api(`/me/regions/${id}`, { method: "DELETE" }); load(true) }
    finally { setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n }) }
  }

  return (
    <div>
      <h2 className="font-display text-xl font-extrabold tracking-tight">Hududlarim</h2>
      <p className="mt-1 text-sm text-muted">Faoliyat yuritayotgan hududlaringiz.</p>
      <div className="mt-5 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading ? (
          <SkeletonTable rows={3} cols={2} />
        ) : (
          <>
            <div className="flex gap-3">
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="flex-1 rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green">
                <option value="">Viloyatni tanlang</option>
                {VILOYATLAR.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <button onClick={add} disabled={busy || !region} className="rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Icon d={I.plus} className="h-4 w-4 inline" /> Qo'shish</button>
            </div>
            <div className="mt-4 space-y-2">
              {items.length === 0 && <p className="py-4 text-center text-sm text-muted">Hali hudud qo'shilmagan.</p>}
              {items.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-green/8 bg-[#fafdf7] px-3 py-2.5">
                  <Icon d={I.pin} className="h-4 w-4 shrink-0 text-green" />
                  <span className="flex-1 text-sm font-medium">{r.region}</span>
                  <button onClick={() => remove(r.id)} disabled={deleting.has(r.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-40">
                    {deleting.has(r.id) ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" /> : <Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- Specializations Tab ---------- */
function SpecializationsTab() {
  const [items, setItems] = useState<{ id: string; specialization_key: string }[]>([])
  const [key, setKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  // silent=true -> mutatsiyadan keyingi qayta yuklash. Skeleton ko'rsatilmaydi,
  // aks holda butun forma (input'lar bilan) qayta mount bo'lib, fokus yo'qolardi.
  const load = (silent = false) => {
    if (!silent) setLoading(true)
    api<{ specializations: { id: string; specialization_key: string }[] }>("/me/specializations")
      .then((d) => setItems(d.specializations || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const add = async () => {
    if (!key.trim()) return
    setBusy(true)
    try { await api("/me/specializations", { method: "POST", body: JSON.stringify({ specialization_key: key.trim() }) }); setKey(""); load(true) }
    finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setDeleting((prev) => new Set(prev).add(id))
    try { await api(`/me/specializations/${id}`, { method: "DELETE" }); load(true) }
    finally { setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n }) }
  }

  return (
    <div>
      <h2 className="font-display text-xl font-extrabold tracking-tight">Yo'nalishlarim</h2>
      <p className="mt-1 text-sm text-muted">Mutaxassislik yo'nalishlaringiz.</p>
      <div className="mt-5 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading ? (
          <SkeletonTable rows={3} cols={2} />
        ) : (
          <>
            <div className="flex gap-3">
              <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Yo'nalish kalit so'zi (masalan: fermerlik)" className="flex-1 rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
              <button onClick={add} disabled={busy} className="rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Icon d={I.plus} className="h-4 w-4 inline" /> Qo'shish</button>
            </div>
            <div className="mt-4 space-y-2">
              {items.length === 0 && <p className="py-4 text-center text-sm text-muted">Hali yo'nalish qo'shilmagan.</p>}
              {items.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-green/8 bg-[#fafdf7] px-3 py-2.5">
                  <Icon d={I.sprout} className="h-4 w-4 shrink-0 text-green" />
                  <span className="flex-1 text-sm font-medium">{s.specialization_key}</span>
                  <button onClick={() => remove(s.id)} disabled={deleting.has(s.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-40">
                    {deleting.has(s.id) ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" /> : <Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- Achievements Tab ---------- */
function AchievementsTab() {
  const [items, setItems] = useState<{ id: string; title: string; subtitle: string }[]>([])
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  // silent=true -> mutatsiyadan keyingi qayta yuklash. Skeleton ko'rsatilmaydi,
  // aks holda butun forma (input'lar bilan) qayta mount bo'lib, fokus yo'qolardi.
  const load = (silent = false) => {
    if (!silent) setLoading(true)
    api<{ achievements: { id: string; title: string; subtitle: string }[] }>("/me/achievements")
      .then((d) => setItems(d.achievements || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const add = async () => {
    if (!title.trim()) return
    setBusy(true)
    try { await api("/me/achievements", { method: "POST", body: JSON.stringify({ title: title.trim(), subtitle: subtitle.trim() }) }); setTitle(""); setSubtitle(""); load(true) }
    finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setDeleting((prev) => new Set(prev).add(id))
    try { await api(`/me/achievements/${id}`, { method: "DELETE" }); load(true) }
    finally { setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n }) }
  }

  return (
    <div>
      <h2 className="font-display text-xl font-extrabold tracking-tight">Yutuqlarim</h2>
      <p className="mt-1 text-sm text-muted">Erishgan yutuqlaringiz.</p>
      <div className="mt-5 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading ? (
          <SkeletonTable rows={4} cols={3} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Yutuq nomi" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Qo'shimcha ma'lumot" className="rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
              <button onClick={add} disabled={busy} className="rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Icon d={I.plus} className="h-4 w-4 inline" /> Qo'shish</button>
            </div>
            <div className="mt-4 space-y-2">
              {items.length === 0 && <p className="py-4 text-center text-sm text-muted">Hali yutuq qo'shilmagan.</p>}
              {items.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-green/8 bg-[#fafdf7] px-3 py-2.5">
                  <Icon d={I.trophy} className="h-4 w-4 shrink-0 text-gold" />
                  <span className="flex-1 text-sm font-medium">{a.title}</span>
                  {a.subtitle && <span className="text-xs text-muted">{a.subtitle}</span>}
                  <button onClick={() => remove(a.id)} disabled={deleting.has(a.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-40">
                    {deleting.has(a.id) ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" /> : <Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- Images Tab ---------- */
function ImagesTab() {
  const [items, setItems] = useState<{ id: string; url: string; caption?: string }[]>([])
  const [caption, setCaption] = useState("")
  const [loading, setLoading] = useState(true)

  // silent=true -> mutatsiyadan keyingi qayta yuklash. Skeleton ko'rsatilmaydi,
  // aks holda butun forma (input'lar bilan) qayta mount bo'lib, fokus yo'qolardi.
  const load = (silent = false) => {
    if (!silent) setLoading(true)
    api<{ images: { id: string; url: string; caption?: string }[] }>("/me/images")
      .then((d) => setItems(d.images || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  // Yuklash tugagach ro'yxat qayta so'raladi — shu oraliqda hech qanday belgi
  // yo'q edi va yangi rasm ko'rinmasdan turardi.
  const [uploading, setUploading] = useState(false)
  const onUpload = async (result: { storageKey: string; signedUrl: string }) => {
    setUploading(true)
    try {
      await api("/me/images", { method: "POST", body: JSON.stringify({ url: result.signedUrl, caption }) })
      setCaption("")
      await api<{ images: { id: string; url: string; caption?: string }[] }>("/me/images")
        .then((d) => setItems(d.images || []))
        .catch(() => {})
    } catch { /* ignore */ } finally { setUploading(false) }
  }

  const remove = async (id: string) => {
    setDeleting((prev) => new Set(prev).add(id))
    try { await api(`/me/images/${id}`, { method: "DELETE" }); load(true) }
    finally { setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n }) }
  }

  return (
    <div>
      <h2 className="font-display text-xl font-extrabold tracking-tight">Rasmlarim</h2>
      <p className="mt-1 text-sm text-muted">Galereyangizga rasm qo'shing. Bir nechta faylni bir vaqtda yuklashingiz mumkin.</p>
      <div className="mt-5 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        <MediaUpload onUpload={onUpload} multiple accept="image/*" />
        {uploading && (
          <p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-green">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-green border-t-transparent" />
            Galereyaga qo'shilmoqda…
          </p>
        )}
        {loading ? (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {items.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted">Hali rasm qo'shilmagan.</p>}
            {items.map((img) => (
              <div key={img.id} className="group relative overflow-hidden rounded-xl border border-green/10">
                <img src={img.url} alt={img.caption || ""} className="h-36 w-full object-cover" />
                {img.caption && <p className="truncate px-2 py-1 text-xs text-muted">{img.caption}</p>}
                {/* Touch qurilmada doim ko'rinadi (hover yo'q), sichqonchada — hover'da */}
                <button onClick={() => remove(img.id)} disabled={deleting.has(img.id)} className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-lg bg-black/50 text-white opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 disabled:opacity-100">
                  {deleting.has(img.id) ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
/* ---------- Brands Tab ---------- */
function BrandsTab() {
  const [items, setItems] = useState<{ id: string; name: string }[]>([])
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  // silent=true -> mutatsiyadan keyingi qayta yuklash. Skeleton ko'rsatilmaydi,
  // aks holda butun forma (input'lar bilan) qayta mount bo'lib, fokus yo'qolardi.
  const load = (silent = false) => {
    if (!silent) setLoading(true)
    api<{ brands: { id: string; name: string }[] }>("/me/brands")
      .then((d) => setItems(d.brands || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const add = async () => {
    if (!name.trim()) return
    setBusy(true)
    try { await api("/me/brands", { method: "POST", body: JSON.stringify({ name: name.trim() }) }); setName(""); load(true) }
    finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setDeleting((prev) => new Set(prev).add(id))
    try { await api(`/me/brands/${id}`, { method: "DELETE" }); load(true) }
    finally { setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n }) }
  }

  return (
    <div>
      <h2 className="font-display text-xl font-extrabold tracking-tight">Hamkor brendlarim</h2>
      <p className="mt-1 text-sm text-muted">Hamkorlik qilgan brendlaringiz.</p>
      <div className="mt-5 rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
        {loading ? (
          <SkeletonTable rows={4} cols={3} />
        ) : (
          <>
            <div className="flex gap-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brend nomi" className="flex-1 rounded-lg border border-green/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-green" />
              <button onClick={add} disabled={busy} className="shrink-0 rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Icon d={I.plus} className="h-4 w-4 inline" /> Qo'shish</button>
            </div>
            <div className="mt-4 space-y-2">
              {items.length === 0 && <p className="py-4 text-center text-sm text-muted">Hali brend qo'shilmagan.</p>}
              {items.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-lg border border-green/8 bg-[#fafdf7] px-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-green/10 text-green"><Icon d={I.building} className="h-4 w-4" /></span>
                  <span className="flex-1 text-sm font-medium">{b.name}</span>
                  <button onClick={() => remove(b.id)} disabled={deleting.has(b.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-40">
                    {deleting.has(b.id) ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" /> : <Icon d="M18 6L6 18 M6 6l12 12" className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- Audience Tab ---------- */
function AudienceTab({ me, reload: _reload }: { me: User; reload: () => void }) {
  const p = me.profile || {}
  const [male, setMale] = useState(() => ((p as Record<string, unknown>).genderDistribution as Record<string, number>)?.male || 68)
  const [female, setFemale] = useState(() => ((p as Record<string, unknown>).genderDistribution as Record<string, number>)?.female || 32)
  const [ages, setAges] = useState(() => {
    const stored = ((p as Record<string, unknown>).ageDistribution as Record<string, number>) || {}
    return Object.keys(stored).length > 0 ? stored : { "18-24": 18, "25-34": 42, "35-44": 25, "45+": 15 }
  })
  const [regions, setRegions] = useState(() => {
    const stored = ((p as Record<string, unknown>).regionDistribution as Record<string, number>) || {}
    return Object.keys(stored).length > 0 ? stored : { "Toshkent": 38, "Toshkent viloyati": 22, "Farg'ona viloyati": 12, "Namangan viloyati": 8, "Boshqalar": 20 }
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api("/me/profile", {
        method: "PUT",
        body: JSON.stringify({
          genderDistribution: { male, female },
          ageDistribution: ages,
          regionDistribution: regions,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const updateAge = (key: string, value: number) => {
    setAges((prev) => ({ ...prev, [key]: value }))
  }

  const updateRegion = (key: string, value: number) => {
    setRegions((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <h2 className="font-display text-xl font-extrabold tracking-tight">Auditoriya analitikasi</h2>
      <p className="mt-1 text-sm text-muted">YouTube kanalingiz auditoriyasi haqida ma'lumot.</p>

      {/* YouTube sinxronlash haqida ma'lumot */}
      <div className="mt-4 rounded-xl border border-green/20 bg-soft p-4">
        <p className="text-sm text-muted">
          <Icon d={I.youtube} className="inline h-4 w-4 text-red-500" /> YouTube kanalni sinxronlaganingizda analytics avtomatik yangilanadi.
        </p>
      </div>

      {saved && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-green/10 px-4 py-3 text-sm font-semibold text-green">
          <Icon d={I.check} className="h-4 w-4" /> Saqlandi!
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {/* Jins taqsimoti */}
        <div className="rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
          <h3 className="font-display text-base font-bold">Jins taqsimoti</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="flex items-center justify-between text-sm">
                <span className="text-muted">Erkaklar (%)</span>
                <span className="font-bold text-green">{male}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={male}
                onChange={(e) => { const v = parseInt(e.target.value); setMale(v); setFemale(100 - v) }}
                className="mt-2 w-full accent-green"
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-sm">
                <span className="text-muted">Ayollar (%)</span>
                <span className="font-bold text-blue-500">{female}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={female}
                onChange={(e) => { const v = parseInt(e.target.value); setFemale(v); setMale(100 - v) }}
                className="mt-2 w-full accent-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Yosh oralig'lari */}
        <div className="rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)]">
          <h3 className="font-display text-base font-bold">Yosh oralig'lari</h3>
          <div className="mt-4 space-y-3">
            {Object.entries(ages).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-16 text-sm text-muted">{key}</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={value}
                  onChange={(e) => updateAge(key, parseInt(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-green/20 px-2 py-1 text-sm text-center outline-none focus:border-green"
                />
                <span className="text-sm text-muted">%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hududlar */}
        <div className="rounded-2xl border border-green/10 bg-white p-5 shadow-[0_4px_24px_rgba(91,180,32,0.05)] lg:col-span-2">
          <h3 className="font-display text-base font-bold">Top hududlar</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(regions).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-muted">{key}</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={value}
                  onChange={(e) => updateRegion(key, parseInt(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-green/20 px-2 py-1 text-sm text-center outline-none focus:border-green"
                />
                <span className="text-sm text-muted">%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60"
        >
          {saving ? "Saqlanmoqda..." : "Saqlash"}
        </button>
      </div>
    </div>
  )
}

export default function BloggerDashboard() {
  const [active, setActive] = useState("Dashboard")
  const [me, setMe] = useState<User | null>(null)
  const { user, logout } = useAuth()
  const nav2 = useNavigate()
  const [meFailed, setMeFailed] = useState(false)
  // Ilgari xato yutib yuborilardi: /me ishlamasa sahifa ABADIY "Yuklanmoqda…"
  // holatida qolib ketardi, qayta urinish tugmasi ham yo'q edi.
  const reload = () => api<{ me: User }>("/me")
    .then((d) => { setMe(d.me); setMeFailed(false) })
    .catch(() => setMeFailed(true))
  useEffect(() => { reload() }, [])
  const initials = (user?.name || "FE").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const doLogout = () => { logout(); nav2("/kirish") }
  return (
    <DashboardLayout nav={nav} active={active} onNav={setActive} onLogout={doLogout} user={{ name: user?.name || "Bloger", role: "Blogger", initials }}>
      {meFailed ? <ErrorState onRetry={reload} message="Profil ma'lumotini yuklab bo'lmadi. Internet aloqasini tekshiring." />
        : !me ? (
          <div className="space-y-6">
            <SkeletonStatGrid />
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          </div>
        )
        : active === "Dashboard" ? <Overview me={me} reload={reload} onNav={setActive} />
        : active === "Topshiriqlar" ? <TasksTab />
        : active === "Profilim" ? <ProfileTab me={me} reload={reload} />
        : active === "Ijtimoiy tarmoqlar" ? <SocialsTab me={me} reload={reload} />
        : active === "Videolar" ? <VideosTab me={me} reload={reload} />
        : active === "Xizmatlar" ? <ServicesTab />
        : active === "Hududlar" ? <RegionsTab />
        : active === "Yo'nalishlar" ? <SpecializationsTab />
        : active === "Yutuqlar" ? <AchievementsTab />
        : active === "Rasmlar" ? <ImagesTab />
        : active === "Brendlar" ? <BrandsTab />
        : active === "Auditoriya" ? <AudienceTab me={me} reload={reload} />
        : <Placeholder title={active} />}
    </DashboardLayout>
  )
}



