import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import DashboardLayout, { LineChart, Donut } from "../../components/DashboardLayout"
import { Icon, I } from "../../lib/ui"
import { api, type User } from "../../lib/api"
import { useAuth } from "../../lib/auth"
import { categories } from "../../lib/bloggers"

const nav = [
  { label: "Dashboard", icon: I.home },
  { label: "Profilim", icon: I.user },
  { label: "Ijtimoiy tarmoqlar", icon: I.link2 },
  { label: "Videolar", icon: I.media },
  { label: "Statistika", icon: I.chart },
  { label: "Hamkorliklar", icon: I.handshake },
  { label: "Xabarlar", icon: I.message },
  { label: "Sozlamalar", icon: I.gear },
]

const platIcon: Record<string, { d: string; color: string }> = {
  YouTube: { d: I.youtube, color: "#FF0000" },
  Instagram: { d: I.instagram, color: "#E1306C" },
  TikTok: { d: I.tiktok, color: "#000000" },
  Telegram: { d: I.telegram, color: "#229ED9" },
  Facebook: { d: I.facebook, color: "#1877F2" },
}
const catLabel = (k: string) => categories.find((c) => c.key === k)?.label ?? k

const statCards = [
  { icon: I.users, t: "Jami obunachilar", v: "1.2M+", delta: "12.5% o'tgan oyga nisbatan" },
  { icon: I.eye, t: "Oylik ko'rishlar", v: "870K+", delta: "8.4% o'tgan oyga nisbatan" },
  { icon: I.chart, t: "Engagement", v: "8.7%", delta: "1.1% o'tgan oyga nisbatan" },
  { icon: I.media, t: "Joylangan videolar", v: "126", delta: "6 ta yangi video" },
  { icon: I.link2, t: "Faol platformalar", v: "5", delta: "Barchasi faol" },
]
const donutSegs = [
  { label: "YouTube", value: 55.2, color: "#22c55e" },
  { label: "Instagram", value: 19.8, color: "#E1306C" },
  { label: "TikTok", value: 7.8, color: "#0f172a" },
  { label: "Telegram", value: 7.4, color: "#229ED9" },
  { label: "Facebook", value: 4.6, color: "#1877F2" },
  { label: "Boshqalar", value: 5.2, color: "#94a3b8" },
]
const ageBars = [{ l: "18-24", v: 18 }, { l: "25-34", v: 42 }, { l: "35-44", v: 25 }, { l: "45+", v: 15 }]
const quickActions = [
  { icon: I.upload, t: "Video yuklash" }, { icon: I.link2, t: "Silka biriktirish" },
  { icon: I.refresh, t: "Profilni yangilash" }, { icon: I.chart, t: "Statistikani ko'rish" },
]
const card = "min-w-0 rounded-2xl border border-green/10 bg-white p-6 shadow-[0_4px_24px_rgba(91,180,32,0.05)]"

/* ---------- Profile ---------- */
function ProfileCard({ me, reload }: { me: User; reload: () => void }) {
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const p = me.profile || {}
  const [form, setForm] = useState({ name: me.name, age: p.age || "", gender: p.gender || "", region: p.region || "", language: p.language || "", niche: p.niche || "" })
  const initials = me.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const save = async () => {
    setSaving(true)
    try { await api("/me/profile", { method: "PUT", body: JSON.stringify(form) }); setEdit(false); reload() }
    finally { setSaving(false) }
  }
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = async () => { await api("/me/profile", { method: "PUT", body: JSON.stringify({ photo: r.result }) }); reload() }
    r.readAsDataURL(f)
  }
  const rows: [string, keyof typeof form, string, string][] = [
    ["Ism", "name", I.user, me.name],
    ["Yosh", "age", I.gear, p.age || "—"],
    ["Jinsi", "gender", I.users, p.gender || "—"],
    ["Hudud", "region", I.pin, p.region || "—"],
    ["Til", "language", I.globe, p.language || "—"],
    ["Yo'nalish", "niche", I.sprout, catLabel(p.niche || "")],
  ]
  return (
    <div className={card}>
      <h3 className="font-display text-lg font-bold">Profil ma'lumotlari</h3>
      <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <button onClick={() => fileRef.current?.click()} className="group relative h-28 w-28 overflow-hidden rounded-full bg-green/10 ring-4 ring-soft">
            {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" />
              : <span className="grid h-full w-full place-items-center font-display text-3xl font-extrabold text-green">{initials}</span>}
            <span className="absolute inset-0 hidden place-items-center bg-black/40 text-white group-hover:grid"><Icon d={I.upload} className="h-6 w-6" /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <span className="text-xs text-muted">Rasm yuklash</span>
        </div>
        <div className="space-y-2.5">
          {rows.map(([label, key, icon, display]) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <Icon d={icon} className="h-4 w-4 shrink-0 text-muted" />
              <span className="w-20 shrink-0 text-muted">{label}</span>
              {edit && key !== "niche" ? (
                <input value={form[key]} onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))} className="flex-1 rounded-lg border border-green/20 px-2 py-1 outline-none focus:border-green" />
              ) : edit && key === "niche" ? (
                <select value={form.niche} onChange={(e) => setForm((s) => ({ ...s, niche: e.target.value }))} className="flex-1 rounded-lg border border-green/20 px-2 py-1 outline-none">
                  {categories.filter((c) => c.key !== "all").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              ) : (
                <span className="font-semibold">{display}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={() => (edit ? save() : setEdit(true))} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green/25 transition-transform hover:scale-105 disabled:opacity-60">
          {edit ? (saving ? "Saqlanmoqda…" : "Saqlash") : "Profilni tahrirlash"} <Icon d={edit ? "M9 12l2 2 4-4" : "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"} className="h-4 w-4" />
        </button>
        <button onClick={reload} className="inline-flex items-center gap-2 rounded-xl border-2 border-green/25 px-5 py-2.5 text-sm font-bold transition-colors hover:border-green hover:text-green">
          Ma'lumotni yangilash <Icon d={I.refresh} className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/* ---------- Socials ---------- */
function SocialsCard({ me, reload }: { me: User; reload: () => void }) {
  const list = me.socials || []
  const [adding, setAdding] = useState(false)
  const [link, setLink] = useState("")
  const [busy, setBusy] = useState(false)
  const add = async () => {
    if (!link.trim()) return
    setBusy(true)
    try { await api("/me/socials", { method: "POST", body: JSON.stringify({ link }) }); setLink(""); setAdding(false); reload() }
    finally { setBusy(false) }
  }
  const remove = async (id: number) => { await api(`/me/socials/${id}`, { method: "DELETE" }); reload() }
  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Ijtimoiy tarmoqlarim</h3>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1.5 rounded-lg border border-green/20 px-3 py-2 text-xs font-bold text-green transition-colors hover:bg-green hover:text-white">
          <Icon d={I.plus} className="h-4 w-4" /> Yangi tarmoq qo'shish
        </button>
      </div>
      {adding && (
        <div className="mt-4 rounded-xl bg-soft p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Kanal linkini joylang — YouTube, Instagram, TikTok, Telegram, Facebook" className="flex-1 rounded-lg border border-green/20 px-3 py-2 text-sm outline-none focus:border-green" />
            <button onClick={add} disabled={busy} className="rounded-lg bg-green px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "Olinmoqda…" : "Qo'shish"}</button>
          </div>
          <p className="mt-2 text-[11px] text-muted">✨ Platforma, nom, avatar va obunachilar soni avtomatik aniqlanadi.</p>
        </div>
      )}
      <div className="mt-4 space-y-2.5">
        {list.length === 0 && <p className="py-4 text-center text-sm text-muted">Hali ijtimoiy tarmoq qo'shilmagan.</p>}
        {list.map((s) => {
          const pi = platIcon[s.platform] ?? { d: I.link2, color: "#5bb420" }
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-green/8 bg-[#fafdf7] p-3">
              {s.avatar
                ? <img src={s.avatar} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white shadow-sm" style={{ color: pi.color }}><Icon d={pi.d} className="h-4 w-4" /></span>}
              <div className="w-32 shrink-0">
                <span className="block truncate text-sm font-semibold">{s.name || s.platform}</span>
                <span className="block text-[11px] text-muted">{s.platform}{s.subscribers ? ` · ${s.subscribers}` : ""}</span>
              </div>
              <a href={s.link.startsWith("http") ? s.link : `https://${s.link}`} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-muted hover:text-green">
                <span className="truncate">{s.link}</span><Icon d={I.external} className="h-3.5 w-3.5 shrink-0" />
              </a>
              <span className="rounded-md bg-green/10 px-2 py-1 text-[11px] font-bold text-green">Ulangan</span>
              <button onClick={() => remove(s.id)} className="grid h-7 w-7 place-items-center rounded-lg text-red-400 hover:bg-red-50"><Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" className="h-4 w-4" /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Videos ---------- */
function VideosCard({ me, reload }: { me: User; reload: () => void }) {
  const vids = me.videos || []
  const [adding, setAdding] = useState(false)
  const [link, setLink] = useState("")
  const [busy, setBusy] = useState(false)
  const add = async () => {
    if (!link.trim()) return
    setBusy(true)
    try { await api("/me/videos", { method: "POST", body: JSON.stringify({ link }) }); setLink(""); setAdding(false); reload() }
    finally { setBusy(false) }
  }
  const remove = async (id: number) => { await api(`/me/videos/${id}`, { method: "DELETE" }); reload() }
  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Joylangan videolarim</h3>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1.5 rounded-lg bg-green px-3 py-2 text-xs font-bold text-white"><Icon d={I.plus} className="h-4 w-4" /> Video qo'shish</button>
      </div>
      {adding && (
        <div className="mt-4 rounded-xl bg-soft p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Video linkini joylang — YouTube, TikTok..." className="flex-1 rounded-lg border border-green/20 px-3 py-2 text-sm outline-none focus:border-green" />
            <button onClick={add} disabled={busy} className="rounded-lg bg-green px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "Olinmoqda…" : "Qo'shish"}</button>
          </div>
          <p className="mt-2 text-[11px] text-muted">✨ Video nomi, ko'rishlar soni va rasmi avtomatik olinadi.</p>
        </div>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="pb-3 font-semibold">Video nomi</th><th className="pb-3 font-semibold">Sana</th>
              <th className="pb-3 font-semibold">Platforma</th><th className="pb-3 font-semibold">Ko'rishlar</th>
              <th className="pb-3 font-semibold">Silka</th><th className="pb-3 font-semibold">Holati</th><th></th>
            </tr>
          </thead>
          <tbody>
            {vids.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted">Hali video qo'shilmagan.</td></tr>}
            {vids.map((v) => (
              <tr key={v.id} className="border-t border-green/8 text-sm">
                <td className="py-3 pr-3"><span className="flex items-center gap-2.5">{v.thumbnail ? <img src={v.thumbnail} alt="" className="h-9 w-14 shrink-0 rounded object-cover" /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green/10 text-green"><Icon d={I.play} className="h-3.5 w-3.5" /></span>}<span className="font-medium">{v.name}</span></span></td>
                <td className="py-3 pr-3 text-muted">{v.date}</td>
                <td className="py-3 pr-3"><span className="flex gap-1">{(v.plats || []).map((pp) => { const pi = platIcon[pp]; return <span key={pp} style={{ color: pi?.color }}><Icon d={pi?.d ?? I.link2} className="h-4 w-4" /></span> })}</span></td>
                <td className="py-3 pr-3 font-semibold">{v.views}</td>
                <td className="py-3 pr-3"><a href={v.link.startsWith("http") ? v.link : `https://${v.link}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted hover:text-green"><span className="max-w-[140px] truncate">{v.link}</span><Icon d={I.external} className="h-3.5 w-3.5 shrink-0" /></a></td>
                <td className="py-3"><span className="inline-flex items-center gap-1 rounded-md bg-green/10 px-2 py-1 text-[11px] font-bold text-green"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Nashr qilingan</span></td>
                <td className="py-3"><button onClick={() => remove(v.id)} className="grid h-7 w-7 place-items-center rounded-lg text-red-400 hover:bg-red-50"><Icon d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Overview({ me, reload }: { me: User; reload: () => void }) {
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Bloger Dashboard</h1>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ProfileCard me={me} reload={reload} />
        <SocialsCard me={me} reload={reload} />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((s) => (
          <div key={s.t} className={card.replace("p-6", "p-5")}>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-soft text-green"><Icon d={s.icon} className="h-5 w-5" /></span>
            <div className="mt-3 text-xs text-muted">{s.t}</div>
            <div className="mt-1 font-display text-2xl font-extrabold">{s.v}</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-green"><Icon d="M5 15l7-7 7 7" className="h-3 w-3" /> {s.delta}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className={card}>
          <div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold">Video ko'rishlar statistikasi</h3><span className="rounded-lg border border-green/15 px-2.5 py-1 text-xs font-semibold text-muted">6 oy ▾</span></div>
          <div className="mt-4"><LineChart points={[520, 580, 720, 650, 820, 980]} labels={["Noy 2023", "Dek 2023", "Yan 2024", "Fev 2024", "Mar 2024", "Apr 2024"]} /></div>
        </div>
        <div className={card}>
          <h3 className="font-display text-lg font-bold">Platformalar bo'yicha taqsimot</h3>
          <div className="mt-4 flex items-center gap-5">
            <div className="relative grid shrink-0 place-items-center"><Donut segments={donutSegs} /><div className="absolute text-center"><div className="font-display text-lg font-extrabold">870K+</div><div className="text-[10px] text-muted">Jami ko'rishlar</div></div></div>
            <ul className="flex-1 space-y-1.5 text-sm">{donutSegs.map((s) => <li key={s.label} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span><span className="font-semibold">{s.value}%</span></li>)}</ul>
          </div>
        </div>
        <div className={card}>
          <h3 className="font-display text-lg font-bold">Auditoriya</h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div><div className="text-xs text-muted">Jins bo'yicha</div><div className="mt-2 space-y-2"><div className="flex items-center gap-2 text-sm"><Icon d={I.users} className="h-4 w-4 text-green" /> Erkaklar <span className="ml-auto font-bold">68%</span></div><div className="flex items-center gap-2 text-sm"><Icon d={I.users} className="h-4 w-4 text-pink-500" /> Ayollar <span className="ml-auto font-bold">32%</span></div></div></div>
            <div><div className="text-xs text-muted">Yosh oralig'i</div><div className="mt-2 space-y-1.5">{ageBars.map((a) => <div key={a.l} className="flex items-center gap-2 text-xs"><span className="w-9 text-muted">{a.l}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-green" style={{ width: `${a.v / 42 * 100}%` }} /></div><span className="w-8 text-right font-semibold">{a.v}%</span></div>)}</div></div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <VideosCard me={me} reload={reload} />
        <div className={card}>
          <h3 className="font-display text-lg font-bold">Tezkor amallar</h3>
          <div className="mt-4 space-y-2.5">{quickActions.map((a) => <button key={a.t} className="flex w-full items-center gap-3 rounded-xl border border-green/10 bg-[#fafdf7] px-4 py-3 text-sm font-semibold transition-colors hover:border-green/30 hover:bg-soft"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-green shadow-sm"><Icon d={a.icon} className="h-4 w-4" /></span>{a.t}<Icon d={I.chevRight} className="ml-auto h-4 w-4 text-muted" /></button>)}</div>
        </div>
      </div>
    </>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-soft text-green"><Icon d={I.gear} className="h-8 w-8" /></span><h2 className="mt-4 font-display text-xl font-bold">{title}</h2><p className="mt-2 text-muted">Bu bo'lim tez orada qo'shiladi.</p></div></div>
  )
}

export default function BloggerDashboard() {
  const [active, setActive] = useState("Dashboard")
  const [me, setMe] = useState<User | null>(null)
  const { user, logout } = useAuth()
  const nav2 = useNavigate()
  const reload = () => api<{ me: User }>("/me").then((d) => setMe(d.me)).catch(() => {})
  useEffect(() => { reload() }, [])
  const initials = (user?.name || "FE").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const doLogout = () => { logout(); nav2("/kirish") }
  return (
    <DashboardLayout nav={nav} active={active} onNav={setActive} onLogout={doLogout} user={{ name: user?.name || "Bloger", role: "Blogger", initials }}>
      {!me ? <div className="grid min-h-[60vh] place-items-center text-muted">Yuklanmoqda…</div>
        : active === "Dashboard" ? <Overview me={me} reload={reload} /> : <Placeholder title={active} />}
    </DashboardLayout>
  )
}
