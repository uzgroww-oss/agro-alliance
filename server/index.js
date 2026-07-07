import express from "express"
import cors from "cors"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import path from "node:path"
import { fileURLToPath } from "node:url"
import fs from "node:fs"
import { load, save, db, nextId } from "./db.js"
import { fetchChannelMeta, fetchVideoMeta } from "./metadata.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || "agro-alliance-dev-secret-change-in-prod"

load()
seed()
migrate()
seedPartners()
seedStats()

const app = express()
app.use(cors())
app.use(express.json({ limit: "8mb" }))

/* ---------- Helpers ---------- */
const sign = (u) => jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: "7d" })
const publicUser = (u) => {
  const { passwordHash, ...rest } = u
  return rest
}
function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}
function uniqueSlug(base) {
  base = base || "bloger"
  let s = base, i = 1
  while (db.users.some((u) => u.slug === s)) s = `${base}-${++i}`
  return s
}
// public profile (no email/hash)
const publicProfile = (u) => ({ slug: u.slug, name: u.name, status: u.status, profile: u.profile, socials: u.socials, videos: u.videos })

function auth(req, res, next) {
  const h = req.headers.authorization || ""
  const token = h.startsWith("Bearer ") ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi" })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = db.findUserById(payload.id)
    if (!user) return res.status(401).json({ error: "Foydalanuvchi topilmadi" })
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: "Token yaroqsiz" })
  }
}

const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: "Ruxsat yo'q" })

/* ---------- Auth ---------- */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {}
  const user = db.findUserByEmail(email)
  if (!user) return res.status(401).json({ error: "Email yoki parol noto'g'ri" })
  const ok = await bcrypt.compare(String(password), user.passwordHash)
  if (!ok) return res.status(401).json({ error: "Email yoki parol noto'g'ri" })
  res.json({ token: sign(user), user: publicUser(user) })
})

app.get("/api/auth/me", auth, (req, res) => res.json({ user: publicUser(req.user) }))

/* ---------- Admin: manage bloggers ---------- */
app.get("/api/bloggers", auth, requireRole("superadmin"), (req, res) => {
  const list = db.users
    .filter((u) => u.role === "blogger")
    .map((u) => ({
      id: u.id, name: u.name, email: u.email, status: u.status,
      cat: u.profile?.niche || "", region: u.profile?.region || "",
    }))
  res.json({ bloggers: list })
})

app.post("/api/bloggers", auth, requireRole("superadmin"), async (req, res) => {
  const { name, email, password, region, niche } = req.body || {}
  if (!name || !email || !password) return res.status(400).json({ error: "Ism, email va parol majburiy" })
  if (db.findUserByEmail(email)) return res.status(409).json({ error: "Bu email allaqachon mavjud" })
  const user = {
    id: nextId(),
    slug: uniqueSlug(slugify(email.split("@")[0]) || slugify(name)),
    name, email,
    passwordHash: await bcrypt.hash(String(password), 10),
    role: "blogger",
    status: "pending",
    profile: { age: "", gender: "", region: region || "", language: "O'zbek", niche: niche || "fermerlik", photo: "", tag: niche || "", bio: "" },
    socials: [],
    videos: [],
  }
  db.addUser(user)
  res.status(201).json({ blogger: publicUser(user) })
})

app.delete("/api/bloggers/:id", auth, requireRole("superadmin"), (req, res) => {
  const target = db.findUserById(req.params.id)
  if (target && target.role === "superadmin") return res.status(403).json({ error: "Adminni o'chirib bo'lmaydi" })
  db.removeUser(req.params.id)
  res.json({ ok: true })
})

app.patch("/api/bloggers/:id/status", auth, requireRole("superadmin"), (req, res) => {
  const u = db.findUserById(req.params.id)
  if (!u) return res.status(404).json({ error: "Topilmadi" })
  u.status = req.body?.status === "active" ? "active" : "pending"
  save()
  res.json({ blogger: publicUser(u) })
})

/* ---------- Admin: partners (hamkorlar) ---------- */
const partnerClient = (pid) => db.users.find((u) => u.role === "client" && u.partnerId === Number(pid))

app.get("/api/partners", auth, requireRole("superadmin"), (req, res) => {
  const partners = db.partners.map((p) => {
    const c = partnerClient(p.id)
    return { ...p, client: c ? { id: c.id, name: c.name, email: c.email } : null }
  })
  res.json({ partners })
})

app.post("/api/partners", auth, requireRole("superadmin"), (req, res) => {
  const { name, sphere, contractNo, amount, signedDate, status, tasks } = req.body || {}
  if (!name || !contractNo) return res.status(400).json({ error: "Tashkilot nomi va shartnoma raqami majburiy" })
  const partner = {
    id: nextId(),
    name,
    sphere: sphere || "",
    contractNo,
    amount: Number(amount) || 0,
    signedDate: signedDate || new Date().toISOString().slice(0, 10),
    status: ["active", "pending", "completed"].includes(status) ? status : "active",
    tasks: Array.isArray(tasks)
      ? tasks.filter((t) => t && t.title).map((t) => ({ id: nextId(), title: t.title, status: ["done", "progress", "pending"].includes(t.status) ? t.status : "pending" }))
      : [],
  }
  db.addPartner(partner)
  res.status(201).json({ partner })
})

app.delete("/api/partners/:id", auth, requireRole("superadmin"), (req, res) => {
  const c = partnerClient(req.params.id)
  if (c) db.removeUser(c.id) // cascade: remove linked client login
  db.removePartner(req.params.id)
  res.json({ ok: true })
})

// create a client (buyurtmachi tashkilot) login for a partner
app.post("/api/partners/:id/client", auth, requireRole("superadmin"), async (req, res) => {
  const p = db.findPartner(req.params.id)
  if (!p) return res.status(404).json({ error: "Hamkor topilmadi" })
  if (partnerClient(p.id)) return res.status(409).json({ error: "Bu hamkorda allaqachon mijoz logini bor" })
  const { name, email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: "Email va parol majburiy" })
  if (db.findUserByEmail(email)) return res.status(409).json({ error: "Bu email allaqachon mavjud" })
  const user = {
    id: nextId(),
    name: name || p.name,
    email,
    passwordHash: await bcrypt.hash(String(password), 10),
    role: "client",
    status: "active",
    partnerId: p.id,
  }
  db.addUser(user)
  res.status(201).json({ client: { id: user.id, name: user.name, email: user.email } })
})

// remove a partner's client login
app.delete("/api/partners/:id/client", auth, requireRole("superadmin"), (req, res) => {
  const c = partnerClient(req.params.id)
  if (c) db.removeUser(c.id)
  res.json({ ok: true })
})

// add a task to a partner
app.post("/api/partners/:id/tasks", auth, requireRole("superadmin"), (req, res) => {
  const p = db.findPartner(req.params.id)
  if (!p) return res.status(404).json({ error: "Hamkor topilmadi" })
  const { title } = req.body || {}
  if (!title) return res.status(400).json({ error: "Vazifa nomi majburiy" })
  const task = { id: nextId(), title, status: "pending" }
  p.tasks.push(task)
  save()
  res.status(201).json({ task })
})

// cycle a task status: pending → progress → done → pending
app.patch("/api/partners/:id/tasks/:taskId", auth, requireRole("superadmin"), (req, res) => {
  const p = db.findPartner(req.params.id)
  if (!p) return res.status(404).json({ error: "Hamkor topilmadi" })
  const t = p.tasks.find((x) => x.id === Number(req.params.taskId))
  if (!t) return res.status(404).json({ error: "Vazifa topilmadi" })
  if (req.body?.status && ["done", "progress", "pending"].includes(req.body.status)) {
    t.status = req.body.status
  } else {
    const order = { pending: "progress", progress: "done", done: "pending" }
    t.status = order[t.status] || "pending"
  }
  save()
  res.json({ task: t })
})

app.delete("/api/partners/:id/tasks/:taskId", auth, requireRole("superadmin"), (req, res) => {
  const p = db.findPartner(req.params.id)
  if (!p) return res.status(404).json({ error: "Hamkor topilmadi" })
  p.tasks = p.tasks.filter((x) => x.id !== Number(req.params.taskId))
  save()
  res.json({ ok: true })
})

/* ---------- Blogger: own profile ---------- */
app.get("/api/me", auth, (req, res) => res.json({ me: publicUser(req.user) }))

app.put("/api/me/profile", auth, requireRole("blogger"), (req, res) => {
  req.user.profile = { ...req.user.profile, ...(req.body || {}) }
  if (req.body?.name) req.user.name = req.body.name
  save()
  res.json({ me: publicUser(req.user) })
})

app.post("/api/me/socials", auth, requireRole("blogger"), async (req, res) => {
  const { link } = req.body || {}
  if (!link) return res.status(400).json({ error: "Link majburiy" })
  const meta = await fetchChannelMeta(link)
  const item = {
    id: nextId(),
    platform: meta.platform !== "Boshqa" ? meta.platform : (req.body.platform || "Boshqa"),
    link,
    name: meta.name || null,
    avatar: meta.avatar || null,
    subscribers: meta.subscribers || null,
    connected: true,
  }
  req.user.socials.push(item)
  save()
  res.status(201).json({ social: item })
})

app.delete("/api/me/socials/:id", auth, requireRole("blogger"), (req, res) => {
  req.user.socials = req.user.socials.filter((s) => s.id !== Number(req.params.id))
  save()
  res.json({ ok: true })
})

app.post("/api/me/videos", auth, requireRole("blogger"), async (req, res) => {
  const { name, link, views } = req.body || {}
  if (!link) return res.status(400).json({ error: "Link majburiy" })
  const meta = await fetchVideoMeta(link)
  const item = {
    id: nextId(),
    name: (name && name.trim()) || meta.title || "Video",
    link,
    views: (views && String(views).trim()) || meta.views || "—",
    thumbnail: meta.thumbnail || null,
    author: meta.author || null,
    plats: [meta.platform !== "Boshqa" ? meta.platform : "Boshqa"],
    date: meta.date || "Bugun",
    status: "published",
  }
  req.user.videos.unshift(item)
  save()
  res.status(201).json({ video: item })
})

app.delete("/api/me/videos/:id", auth, requireRole("blogger"), (req, res) => {
  req.user.videos = req.user.videos.filter((v) => v.id !== Number(req.params.id))
  save()
  res.json({ ok: true })
})

/* ---------- Client (buyurtmachi): view own project (read-only) ---------- */
app.get("/api/me/partner", auth, requireRole("client"), (req, res) => {
  const p = db.findPartner(req.user.partnerId)
  if (!p) return res.status(404).json({ error: "Sizga biriktirilgan loyiha topilmadi" })
  res.json({ partner: p })
})

/* ---------- Public (no auth) — for main website ---------- */
app.get("/api/public/bloggers", (req, res) => {
  const list = db.users
    .filter((u) => u.role === "blogger")
    .map((u) => ({ slug: u.slug, name: u.name, region: u.profile?.region || "", niche: u.profile?.niche || "", photo: u.profile?.photo || "", tag: u.profile?.tag || "", status: u.status, videos: (u.videos || []).length, socials: (u.socials || []).length }))
  res.json({ bloggers: list })
})

app.get("/api/public/bloggers/:slug", (req, res) => {
  const u = db.users.find((x) => x.role === "blogger" && x.slug === req.params.slug)
  if (!u) return res.status(404).json({ error: "Bloger topilmadi" })
  res.json({ blogger: publicProfile(u) })
})

// public site stats (counters bar on main pages)
app.get("/api/public/stats", (req, res) => res.json({ stats: db.stats }))

// admin: edit site stats
app.get("/api/stats", auth, requireRole("superadmin"), (req, res) => res.json({ stats: db.stats }))
app.put("/api/stats", auth, requireRole("superadmin"), (req, res) => {
  const incoming = Array.isArray(req.body?.stats) ? req.body.stats : null
  if (!incoming) return res.status(400).json({ error: "stats массиви majburiy" })
  const cleaned = incoming
    .filter((s) => s && s.key)
    .map((s) => ({ key: String(s.key), value: String(s.value ?? "").trim(), label: String(s.label ?? "").trim() }))
  db.setStats(cleaned)
  res.json({ stats: db.stats })
})

app.get("/api/health", (req, res) => res.json({ ok: true, users: db.users.length }))

/* ---------- Serve built frontend (production single-service) ---------- */
const distDir = path.join(__dirname, "..", "dist")
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  // SPA fallback: any non-/api route serves index.html
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(distDir, "index.html")))
  console.log("✓ Frontend (dist) serving enabled")
}

app.listen(PORT, () => console.log(`✓ Agro Alliance → http://localhost:${PORT}`))

/* ---------- Seed ---------- */
function seed() {
  if (db.users.length > 0) return
  const mk = (name, email, password, role, extra = {}) => ({
    id: nextId(), name, email,
    passwordHash: bcrypt.hashSync(password, 10),
    role, status: "active",
    profile: { age: "", gender: "", region: "", language: "O'zbek", niche: "fermerlik", photo: "", tag: "", bio: "" },
    socials: [], videos: [], ...extra,
  })
  db.users.push(mk("Bosh Admin", "admin@agroalliance.uz", "admin123", "superadmin"))
  db.users.push(
    mk("Fermer Elyor", "elyor@agroalliance.uz", "elyor123", "blogger", {
      slug: "elyor",
      profile: { age: "28", gender: "Erkak", region: "Toshkent viloyati, Zangiota", language: "O'zbek, Rus", niche: "issiqxona", photo: "", tag: "Issiqxona • Fermerlik", bio: "3 yildan beri issiqxona va fermerlik sohasida kontent yarataman." },
      socials: [
        { id: nextId(), platform: "YouTube", link: "youtube.com/@fermerelyor", connected: true },
        { id: nextId(), platform: "Instagram", link: "instagram.com/fermerelyor", connected: true },
        { id: nextId(), platform: "Telegram", link: "t.me/fermerelyor", connected: true },
      ],
      videos: [
        { id: nextId(), name: "Issiqxonada pomidor yetishtirish sirlari", link: "youtube.com/watch?v=abc123", views: "125K", plats: ["YouTube", "Instagram"], date: "22 Apr 2024", status: "published" },
        { id: nextId(), name: "Bodring hosildorligini oshirish usullari", link: "youtu.be/xyz456", views: "98K", plats: ["YouTube", "Telegram"], date: "18 Apr 2024", status: "published" },
      ],
    }),
  )
  save()
  console.log("✓ Seed: admin@agroalliance.uz / admin123  •  elyor@agroalliance.uz / elyor123")
}

/* ---------- Seed: demo partners ---------- */
function seedPartners() {
  if (db.partners.length > 0) return
  const mk = (name, sphere, contractNo, amount, signedDate, status, tasks) => ({
    id: nextId(), name, sphere, contractNo, amount, signedDate, status,
    tasks: tasks.map((t) => ({ id: nextId(), title: t[0], status: t[1] })),
  })
  db.partners.push(
    mk("UZ-GROW Greenhouses", "Issiqxona texnologiyalari", "SH-2024-001", 850000000, "2024-01-15", "active", [
      ["Issiqxona uskunalarini yetkazib berish", "done"],
      ["Montaj va sozlash ishlari", "progress"],
      ["Xodimlarni o'qitish", "pending"],
    ]),
    mk("Syngenta", "Urug' va himoya vositalari", "SH-2024-007", 1200000000, "2024-02-03", "active", [
      ["Urug'lik partiyasini yetkazish", "done"],
      ["Dala sinovlarini o'tkazish", "done"],
      ["Fermerlarga seminar tashkil etish", "progress"],
      ["Yillik hisobot tayyorlash", "pending"],
    ]),
    mk("John Deere", "Qishloq xo'jaligi texnikasi", "SH-2024-012", 3400000000, "2024-03-20", "active", [
      ["Traktorlarni yetkazib berish", "progress"],
      ["Servis markazini ochish", "pending"],
    ]),
    mk("YARA", "Mineral o'g'itlar", "SH-2024-019", 670000000, "2024-04-11", "pending", [
      ["Shartnoma shartlarini kelishish", "progress"],
      ["Birinchi partiyani yetkazish", "pending"],
    ]),
    mk("BASF", "Kimyoviy himoya vositalari", "SH-2023-044", 920000000, "2023-11-08", "completed", [
      ["Mahsulot yetkazib berish", "done"],
      ["To'lovni yakunlash", "done"],
      ["Yakuniy hisobot", "done"],
    ]),
  )
  save()
  console.log("✓ Seed: 5 ta demo hamkor qo'shildi")
}

/* ---------- Seed: site stats ---------- */
function seedStats() {
  if (db.stats && db.stats.length > 0) return
  db.setStats([
    { key: "bloggers", value: "120+", label: "Agro blogerlar" },
    { key: "views", value: "5M+", label: "Oylik ko'rishlar" },
    { key: "partners", value: "50+", label: "Hamkor kompaniyalar" },
    { key: "regions", value: "20+", label: "Hududlarda faoliyat" },
    { key: "contents", value: "1000+", label: "Yaratilgan kontentlar" },
  ])
  console.log("✓ Seed: sayt statistikasi qo'shildi")
}

/* ---------- Migration: ensure every blogger has a slug ---------- */
function migrate() {
  let changed = false
  for (const u of db.users) {
    if (u.role === "blogger" && !u.slug) {
      const base = slugify(u.email?.split("@")[0]) || slugify(u.name)
      u.slug = uniqueSlug(base)
      changed = true
    }
  }
  if (changed) {
    save()
    console.log("✓ Migration: bloggerlarga slug berildi")
  }
}
