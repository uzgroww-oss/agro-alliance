/**
 * Build'dan keyin ishlaydi (npm run build → postbuild).
 *
 * MUAMMO: bu sayt client-rendered SPA. Netlify har URL uchun bir xil
 * index.html qaytaradi, ya'ni Google, Yandex va Telegram HAMMA sahifani
 * bir xil sarlavha bilan ko'radi. Telegram/Facebook esa JS ni umuman
 * ishlatmaydi — havola ulashilganda oldindan ko'rish har doim bir xil.
 *
 * YECHIM: har marshrut uchun dist/<yo'l>/index.html yoziladi va ichiga
 * o'sha sahifaning <title>, meta description, Open Graph va JSON-LD
 * teglari joylanadi. Netlify statik faylni SPA fallback'dan OLDIN
 * beradi, shuning uchun bot to'g'ri meta'ni JS'siz oladi.
 * Foydalanuvchi uchun hech narsa o'zgarmaydi — React odatdagidek yuklanadi.
 *
 * Bloger/yangilik ro'yxati Supabase'dan build vaqtida olinadi.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const DIST = join(ROOT, "dist")

const seo = JSON.parse(readFileSync(join(ROOT, "src/lib/seo-data.json"), "utf-8"))
const SITE = seo.site.url.replace(/\/$/, "")

/**
 * Netlify'da o'zgaruvchilar process.env da bo'ladi. Lokal build'da esa
 * ular .env faylda — Vite ularni faqat klient bundle'ga qo'shadi, bu
 * Node skriptga yetib kelmaydi. Shuning uchun .env ni o'zimiz o'qiymiz.
 */
function loadEnv(name) {
  if (process.env[name]) return process.env[name]
  try {
    const raw = readFileSync(join(ROOT, ".env"), "utf-8")
    const line = raw.split("\n").find((l) => l.trim().startsWith(`${name}=`))
    return line ? line.slice(line.indexOf("=") + 1).trim() : undefined
  } catch {
    return undefined
  }
}

const SUPABASE_URL = loadEnv("VITE_SUPABASE_URL")
const SUPABASE_KEY = loadEnv("VITE_SUPABASE_ANON_KEY")

/* ---------------- yordamchilar ---------------- */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

/** Supabase edge funksiyasidan o'qish. Xato bo'lsa build TO'XTAMAYDI. */
async function fetchJson(fn, params = "") {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}${params}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

/** index.html <head> ichiga meta teglarni joylash */
function buildHtml(shell, { title, description, url, image, type = "website", noindex, jsonLd }) {
  const img = image || seo.site.image
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta name="robots" content="${noindex ? "noindex, nofollow" : "index, follow"}" />`,
    `<meta property="og:site_name" content="${esc(seo.site.name)}" />`,
    `<meta property="og:type" content="${esc(type)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:locale" content="uz_UZ" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
  ]
  if (jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`)

  // Shell'dagi eski title/description ni olib tashlaymiz (takrorlanmasin)
  let html = shell
    .replace(/<title>.*?<\/title>\s*/s, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/i, "")

  return html.replace("</head>", `  ${tags.join("\n  ")}\n</head>`)
}

function writeRoute(route, html) {
  const dir = route === "/" ? DIST : join(DIST, route)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "index.html"), html, "utf-8")
}

/* ---------------- asosiy ---------------- */

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    console.error("[seo] dist/index.html topilmadi — avval `vite build` ishga tushirilsin")
    process.exit(1)
  }
  const shell = readFileSync(join(DIST, "index.html"), "utf-8")
  const urls = [] // sitemap uchun

  /* --- 1. Statik sahifalar --- */
  for (const [route, data] of Object.entries(seo.routes)) {
    const url = `${SITE}${route === "/" ? "" : route}`
    const jsonLd =
      route === "/"
        ? {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: seo.site.name,
            url: SITE,
            logo: seo.site.image,
            description: data.description,
            areaServed: "UZ",
          }
        : null
    writeRoute(route, buildHtml(shell, { ...data, url, jsonLd }))
    if (!data.noindex) urls.push({ loc: url, priority: route === "/" ? "1.0" : "0.8" })
  }
  console.log(`[seo] statik sahifalar: ${Object.keys(seo.routes).length} ta`)

  /* --- 2. Bloger profillari --- */
  const bl = await fetchJson("public-bloggers-list", "?per_page=200")
  const bloggers = bl?.bloggers || []
  for (const b of bloggers) {
    if (!b.slug) continue
    const route = `/blogerlar/${b.slug}`
    const url = `${SITE}${route}`
    const region = b.region && b.region !== "Barchasi" ? b.region : ""
    const title = `${b.name} — agro bloger${region ? `, ${region}` : ""} | ${seo.site.name}`
    const description =
      `${b.name} — O'zbekistondagi agro bloger.` +
      (b.tag ? ` ${b.tag}.` : "") +
      (b.subs ? ` ${b.subs} obunachi.` : "") +
      ` Statistika, ijtimoiy tarmoqlar va hamkorlik uchun ma'lumot.`
    writeRoute(route, buildHtml(shell, {
      title, description, url, image: b.avatar, type: "profile",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        mainEntity: {
          "@type": "Person",
          name: b.name,
          jobTitle: "Agro bloger",
          image: b.avatar || undefined,
          address: region ? { "@type": "PostalAddress", addressRegion: region, addressCountry: "UZ" } : undefined,
        },
        url,
      },
    }))
    urls.push({ loc: url, priority: "0.7" })
  }
  console.log(`[seo] bloger profillari: ${bloggers.length} ta`)

  /* --- 3. Yangiliklar --- */
  const nw = await fetchJson("public-news-list", "?per_page=200")
  const news = nw?.news || nw?.data || []
  for (const n of news) {
    if (!n.slug) continue
    const route = `/yangiliklar/${n.slug}`
    const url = `${SITE}${route}`
    writeRoute(route, buildHtml(shell, {
      title: `${n.title} | ${seo.site.name}`,
      description: n.desc || n.excerpt || "Agro Alliance — qishloq xo'jaligi yangiliklari.",
      url,
      type: "article",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: n.title,
        datePublished: n.published_at || n.date || undefined,
        publisher: { "@type": "Organization", name: seo.site.name, logo: { "@type": "ImageObject", url: seo.site.image } },
        mainEntityOfPage: url,
      },
    }))
    urls.push({ loc: url, priority: "0.6" })
  }
  console.log(`[seo] yangiliklar: ${news.length} ta`)

  if (!bloggers.length && !news.length && (!SUPABASE_URL || !SUPABASE_KEY)) {
    console.warn("[seo] OGOHLANTIRISH: Supabase env o'zgaruvchilari yo'q — faqat statik sahifalar yozildi")
  }

  /* --- 4. sitemap.xml --- */
  const today = new Date().toISOString().slice(0, 10)
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`)
      .join("\n") +
    `\n</urlset>\n`
  writeFileSync(join(DIST, "sitemap.xml"), sitemap, "utf-8")

  /* --- 5. robots.txt --- */
  const robots = [
    "User-agent: *",
    "Allow: /",
    "",
    "# Shaxsiy kabinetlar qidiruvda chiqmasligi kerak",
    "Disallow: /admin",
    "Disallow: /dashboard",
    "Disallow: /hamkor",
    "Disallow: /kirish",
    "Disallow: /reset-password",
    "",
    `Sitemap: ${SITE}/sitemap.xml`,
    "",
  ].join("\n")
  writeFileSync(join(DIST, "robots.txt"), robots, "utf-8")

  console.log(`[seo] sitemap.xml: ${urls.length} ta havola`)
  console.log(`[seo] robots.txt yozildi`)

  /* --- 6. _headers — Content-Security-Policy --- */
  yozCsp()
}

/**
 * CSP NEGA SHU YERDA YOZILADI, netlify.toml da emas.
 *
 * index.html ichida inline skript bor (bosh sahifa ma'lumotini React'dan
 * oldin so'raydi). Uni CSP o'tkazishi uchun skriptning sha256 hash'i
 * ro'yxatda turishi kerak. Hash esa build'dan build'ga o'zgaradi —
 * skript ichida `%VITE_SUPABASE_URL%` kabi o'rinbosarlar build paytida
 * haqiqiy qiymatga almashadi. Ya'ni uni qo'lda yozib qo'yib bo'lmaydi:
 * bir marta env o'zgarsa CSP skriptni bloklaydi va sayt oq ekran bo'ladi.
 *
 * Shuning uchun hash tayyor HTML dan O'QIB olinadi va `dist/_headers`
 * fayliga yoziladi. Netlify shu faylni avtomatik o'qiydi.
 *
 * O'zgarmaydigan sarlavhalar (X-Frame-Options, HSTS va h.k.) ATAYLAB
 * netlify.toml da qoldirilgan: agar shu skript bir kun yiqilsa, sayt
 * baribir asosiy himoyasiz qolmaydi.
 */
function yozCsp() {
  const html = readFileSync(join(DIST, "index.html"), "utf-8")

  /* Faqat BAJARILADIGAN inline skriptlar. `src=` li tashqi skript va
     `type="application/ld+json"` ma'lumot bloki hisobga olinmaydi —
     brauzer ld+json ni bajarmaydi, script-src unga tegmaydi. */
  const hashlar = new Set()
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g
  let m
  while ((m = re.exec(html))) {
    if (/type\s*=\s*["'][^"']*json/i.test(m[1])) continue
    /**
     * ⚠️ SATR OXIRLARI LF GA KELTIRILADI.
     *
     * Brauzer hash'ni fayl BAYTLARIDAN emas, HTML parser chiqargan
     * matndan hisoblaydi. HTML spetsifikatsiyasi esa kirish oqimidagi
     * har bir CRLF va CR ni LF ga almashtiradi.
     *
     * Windows'da fayl CRLF bilan saqlanadi, ya'ni to'g'ridan-to'g'ri
     * hash qilinsa qiymat boshqa chiqadi va CSP o'z skriptimizni
     * bloklaydi. Bu aynan shunday bo'lgan — brauzerda tekshirilgan:
     *   CRLF bilan : cIWWeidFm7Uq...   (CSP bloklaydi)
     *   LF bilan   : Lwv49aP6oiQI...   (brauzer kutgan qiymat)
     *
     * Linux'da (Netlify build) CRLF bo'lmaydi, ya'ni bu qator u yerda
     * hech narsani o'zgartirmaydi — lekin lokal build bilan ishlab
     * chiqarish build'i bir xil natija berishi uchun shart.
     */
    const matn = m[2].replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    hashlar.add(`'sha256-${createHash("sha256").update(matn, "utf8").digest("base64")}'`)
  }

  const csp = [
    "default-src 'self'",
    // Inline skript faqat hash bo'yicha. 'unsafe-inline' YO'Q — aynan
    // shu CSP ning qiymati: XSS orqali kiritilgan skript ishlamaydi.
    `script-src 'self' ${[...hashlar].join(" ")}`,
    // Tailwind va React ikkalasi ham inline uslub yozadi — bunisiz
    // sayt uslubsiz qoladi. Uslub XSS uchun skriptchalik xavfli emas.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Rasm manbalari ko'p va oldindan bilib bo'lmaydi: bloger avatarlari
    // YouTube/Instagram CDN dan, muqovalar Supabase Storage dan keladi.
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    // Supabase — butun API. googleapis — YouTube'ga to'g'ridan-to'g'ri
    // video yuklash (brauzer -> Google, server orqali emas).
    "connect-src 'self' https://*.supabase.co https://*.googleapis.com https://www.youtube.com",
    // YouTube pleyer (bloger profili) va OpenStreetMap (aloqa sahifasi)
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.openstreetmap.org",
    // Saytni begona sahifa ichiga qo'yib bo'lmaydi (clickjacking)
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ")

  writeFileSync(
    join(DIST, "_headers"),
    ["/*", `  Content-Security-Policy: ${csp}`, ""].join("\n"),
    "utf-8",
  )
  console.log(`[seo] _headers: CSP yozildi (${hashlar.size} ta inline skript hash'i)`)
}

main().catch((e) => {
  console.error("[seo] xato:", e)
  process.exit(1)
})
