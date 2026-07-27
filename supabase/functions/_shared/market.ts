import { supabaseAdmin } from "./supabase.ts";

/**
 * Bozor ma'lumotlarini yig'ish: raqobatchilar va veb tendensiyalari.
 *
 * Ikki manba, ikkalasi ham KALITSIZ ishlaydi:
 *   1) Instagram business_discovery — rasmiy API, boshqa Business/
 *      Creator hisoblarining ochiq ko'rsatkichlari.
 *   2) Google News RSS — uch tilda kunlik yangiliklar.
 *
 * Foydalanuvchidan hech qanday sozlash so'ralmaydi. O'ylab topilgan
 * "internet tahlili" ham berilmaydi — har bir fakt shu ikki manbadan.
 */

export type Competitor = {
  username: string;
  label: string | null;
  followers: number | null;
  posts: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  recent: { text: string; likes: number | null; comments: number | null }[];
  error?: string;
};

/**
 * Instagram business_discovery.
 * Faqat Business/Creator hisoblarni ko'radi — oddiy shaxsiy hisob
 * so'ralsa Graph "(#110) Invalid user id" qaytaradi.
 */
export async function fetchCompetitor(
  igUserId: string,
  token: string,
  username: string,
  label: string | null,
): Promise<Competitor> {
  const base: Competitor = {
    username, label,
    followers: null, posts: null, avgLikes: null, avgComments: null, recent: [],
  };
  try {
    const fields =
      `business_discovery.username(${username})` +
      `{followers_count,media_count,media.limit(12){caption,like_count,comments_count,timestamp}}`;
    const r = await fetch(
      `https://graph.facebook.com/v22.0/${igUserId}?fields=${encodeURIComponent(fields)}&access_token=${token}`,
    );
    const d = await r.json().catch(() => ({}));

    if (d.error) {
      const msg = String(d.error.message || "").toLowerCase();
      if (d.error.code === 110 || msg.includes("invalid user id")) {
        return { ...base, error: "Business/Creator hisob emas yoki topilmadi" };
      }
      return { ...base, error: d.error.message || "Olib bo'lmadi" };
    }

    const bd = d.business_discovery;
    if (!bd) return { ...base, error: "Ma'lumot qaytmadi" };

    base.followers = bd.followers_count ?? null;
    base.posts = bd.media_count ?? null;

    const items = (bd.media?.data || []) as {
      caption?: string; like_count?: number; comments_count?: number;
    }[];
    base.recent = items.slice(0, 8).map((it) => ({
      text: (it.caption || "(matnsiz)").slice(0, 100),
      likes: it.like_count ?? null,
      comments: it.comments_count ?? null,
    }));
    const withLikes = items.filter((i) => typeof i.like_count === "number");
    if (withLikes.length) {
      base.avgLikes = Math.round(withLikes.reduce((a, i) => a + (i.like_count || 0), 0) / withLikes.length);
      base.avgComments = Math.round(withLikes.reduce((a, i) => a + (i.comments_count || 0), 0) / withLikes.length);
    }
    return base;
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Tarmoq xatosi" };
  }
}

/** Kuzatiladigan raqobatchilarni yig'ish va keshni yangilash */
export async function gatherCompetitors(): Promise<Competitor[]> {
  const { data: rows } = await supabaseAdmin
    .from("smm_competitors")
    .select("id, username, label")
    .eq("platform", "instagram")
    .limit(10);
  if (!rows?.length) return [];

  const { data: tok } = await supabaseAdmin
    .from("instagram_tokens")
    .select("access_token, instagram_account_id")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!tok?.access_token || !tok?.instagram_account_id) {
    return (rows as { username: string; label: string | null }[]).map((r) => ({
      username: r.username, label: r.label,
      followers: null, posts: null, avgLikes: null, avgComments: null, recent: [],
      error: "Instagram ulanmagan",
    }));
  }

  const out: Competitor[] = [];
  for (const r of rows as { id: string; username: string; label: string | null }[]) {
    const c = await fetchCompetitor(tok.instagram_account_id, tok.access_token, r.username, r.label);
    out.push(c);
    // Keshga yozamiz — panel qayta so'ramasdan ham ko'rsata olsin
    await supabaseAdmin.from("smm_competitors").update({
      followers: c.followers, posts: c.posts, avg_likes: c.avgLikes,
      last_error: c.error || null, checked_at: new Date().toISOString(),
    }).eq("id", r.id);
  }
  return out;
}

/* ---------------- Veb tendensiyalari ---------------- */

export type WebHit = { title: string; snippet: string; url: string; source?: string; date?: string };

/**
 * TARTIB MUHIM: RSS ning description maydonida teglar BELGILANGAN
 * holda keladi (&lt;a href…&gt;). Avval teglarni o'chirsak ular
 * qolib ketadi va matnda "<a href=…" ko'rinadi.
 * Shuning uchun: belgilarni ochamiz -> teglarni o'chiramiz ->
 * oxirida &amp; ni ochamiz (aks holda ikki marta ochilib ketadi).
 */
function stripTags(html: string): string {
  return html
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    // Ikki marta belgilanganlari (&amp;nbsp;) endi &nbsp; bo'lib qoldi —
    // oxirgi tozalash
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * RSS so'rovi — vaqtinchalik rad javobida QAYTA URINADI.
 *
 * NEGA: Google News server (ma'lumot markazi) IP'laridan kelgan
 * so'rovga ba'zan 503 yoki 429 qaytaradi. Bu o'tkinchi holat —
 * bir-ikki soniyadan keyin ishlaydi. Ilgari birinchi urinishdayoq
 * taslim bo'lardik va foydalanuvchi "manbani o'qib bo'lmadi" ko'rardi.
 *
 * Chegara qisqa (8 s): manba tekshiruvi tez bo'lishi kerak.
 */
async function fetchRss(url: string, timeoutMs = 8_000): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200));
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Faqat o'tkinchi xatolarda qayta urinamiz. 404 yoki 403 da
    // qayta urinish behuda vaqt yeydi.
    if (r.status !== 503 && r.status !== 429) return r;
    last = r;
  }
  return last!;
}

/**
 * Google News RSS — KALITSIZ ishlaydi va haqiqiy, kunlik yangiliklarni
 * beradi. Shu sababli asosiy manba sifatida tanlandi: foydalanuvchidan
 * hech qanday sozlash so'ramaymiz.
 */
async function googleNews(query: string, locale: string): Promise<WebHit[]> {
  const [hl, gl] = locale.split("|");
  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
    `&hl=${hl}&gl=${gl}&ceid=${gl}:${hl.split("-")[0]}`;

  const r = await fetchRss(url);
  if (!r.ok) return [];
  const xml = await r.text();

  const out: WebHit[] = [];
  // RSS bitta qatorda keladi — qator bo'yicha emas, teg bo'yicha ajratamiz
  const items = xml.split("<item>").slice(1);
  for (const it of items.slice(0, 10)) {
    const pick = (tag: string) => {
      // [\s\S] EMAS, "s" bayrog'i ishlatilyapti: shablon satri ichida
      // teskari chiziqni to'g'ri yozish chalkash va oson buziladi
      // (bitta qolsa regexga [sS] tushib, hech narsa topilmaydi).
      // "s" bayrog'i bilan nuqta yangi qatorni ham qamrab oladi.
      const m = it.match(new RegExp("<" + tag + ">(.*?)</" + tag + ">", "s"));
      return m ? stripTags(m[1]) : "";
    };
    const rawTitle = pick("title");
    if (!rawTitle) continue;
    // Google sarlavha oxiriga " - Manba" qo'shadi
    const dash = rawTitle.lastIndexOf(" - ");
    const title = dash > 20 ? rawTitle.slice(0, dash) : rawTitle;
    const source = dash > 20 ? rawTitle.slice(dash + 3) : "";

    out.push({
      title,
      snippet: pick("description").slice(0, 220),
      url: pick("link"),
      source,
      date: pick("pubDate").slice(0, 16),
    });
  }
  return out;
}

/**
 * BUTUN DUNYO agro sohasi — global tendensiyalar.
 *
 * NEGA KERAK: webTrends faqat O'zbekiston haqidagi yangiliklarni
 * beradi. Reja esa jahon bozorida nima bo'layotganiga ham tayanishi
 * kerak: narxlar, texnologiya, iqlim, eksport. Bu foydalanuvchidan
 * hech narsa so'ramaydi — backendда doim ishlaydi.
 *
 * So'rovlar haqiqiy natija berishi tekshirilgan (har biri 70-100 ta):
 * umumiy tendensiya, texnologiya, narxlar, issiqxona, iqlim.
 */
export async function globalAgro(): Promise<WebHit[]> {
  // ASOSIY manba — soha saytlarining O'Z RSS'lari. Google News
  // ma'lumot markazi IP'laridan kelgan so'rovga tez-tez 503 beradi va
  // global tahlil bo'sh qolardi. Bu saytlar bunday cheklov qo'ymaydi.
  // Har biri haqiqiy so'rov bilan tekshirilgan (yozuvlar soni):
  //   agfundernews 50, freshplaza 90, farmprogress 50,
  //   hortidaily 28, modernfarmer 10
  const feeds: [string, string][] = [
    ["AgFunder News", "https://agfundernews.com/feed"],
    ["FreshPlaza", "https://www.freshplaza.com/rss.xml"],
    ["Farm Progress", "https://www.farmprogress.com/rss.xml"],
    ["HortiDaily", "https://www.hortidaily.com/rss.xml"],
    ["Modern Farmer", "https://modernfarmer.com/feed/"],
  ];

  const direct = await Promise.all(
    feeds.map(([name, url]) => fetchFeed(url, name).catch(() => [] as WebHit[])),
  );

  const out: WebHit[] = [];
  const seen = new Set<string>();
  // Har manbadan 3 tadan — bittasi butun ro'yxatni bosib ketmasin
  for (const list of direct) {
    for (const h of list.slice(0, 3)) {
      const key = h.title.toLowerCase().slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
    }
  }

  // Google — QO'SHIMCHA manba. Ishlasa yaxshi, ishlamasa yuqoridagilar
  // yetadi. Shu sababli global tahlil endi Google'ga bog'liq emas.
  if (out.length < 12) {
    const extra = await googleNews("global agriculture trends", "en-US|US").catch(() => [] as WebHit[]);
    for (const h of extra.slice(0, 5)) {
      const key = h.title.toLowerCase().slice(0, 60);
      if (!seen.has(key)) { seen.add(key); out.push(h); }
    }
  }

  return out.slice(0, 15);
}

/**
 * FOYDALANUVCHI QO'SHGAN manbadan (RSS/Atom) o'qish.
 *
 * "Manbalar" bo'limida kiritilgan saytlar shu yerda o'qiladi va
 * marketing tahliliga qo'shiladi — AI aynan siz ishonadigan
 * manbalardan o'rganadi, faqat Google News'дан emas.
 *
 * Google'nikidan farqi: sarlavhadan " - Manba" ajratilmaydi (u faqat
 * Google formatida bo'ladi) va Atom (<entry>) ham qo'llanadi.
 */
export async function fetchFeed(url: string, name = ""): Promise<WebHit[]> {
  // 503/429 da qayta urinadi — Google server IP'lariga vaqti-vaqti
  // bilan shunday javob beradi va manba xato deb belgilanardi.
  const r = await fetchRss(url);
  // XATO SABABINI aytamiz. Ilgari jimgina [] qaytarardi va
  // "yozuv topilmadi" degan chalg'ituvchi xabar chiqardi — aslida
  // sayt 403 yoki 404 bergan bo'lishi mumkin edi.
  if (!r.ok) {
    // 503/429 — o'tkinchi. Foydalanuvchiga nima qilishni aytamiz,
    // "sayt javobi 503" o'zi hech narsa tushuntirmaydi.
    if (r.status === 503 || r.status === 429) {
      throw new Error("manba hozir band — 10-20 soniyadan keyin qayta urining");
    }
    if (r.status === 404) throw new Error("bunday havola yo'q (404)");
    if (r.status === 403) throw new Error("sayt kirishni rad etdi (403)");
    throw new Error(`sayt javobi ${r.status}`);
  }
  const xml = await r.text();
  if (!xml.trim()) throw new Error("sayt bo'sh javob qaytardi");
  // RSS/Atom emasligini aniq aytamiz (masalan HTML sahifa kelgan)
  if (!/<item|<entry/i.test(xml)) {
    const isHtml = /^\s*<!doctype html|<html/i.test(xml);
    throw new Error(isHtml ? "bu RSS emas, oddiy sahifa" : "RSS yozuvlari topilmadi");
  }

  // RSS <item> yoki Atom <entry>
  const isAtom = !xml.includes("<item") && xml.includes("<entry");
  const parts = xml.split(isAtom ? "<entry" : "<item").slice(1);

  const out: WebHit[] = [];
  // 12 ta yozuv: tahlil bir necha manbadan yetarli material olsin
  for (const it of parts.slice(0, 12)) {
    const pick = (tag: string) => {
      const m = it.match(new RegExp("<" + tag + "[^>]*>(.*?)</" + tag + ">", "s"));
      return m ? stripTags(m[1]) : "";
    };
    const title = pick("title");
    if (!title) continue;
    // Atom'да havola atributда bo'ladi: <link href="…"/>
    let link = pick("link");
    if (!link) {
      const m = it.match(/<link[^>]*href="([^"]+)"/);
      link = m ? m[1] : "";
    }
    out.push({
      title,
      snippet: (pick("description") || pick("summary") || pick("content")).slice(0, 220),
      url: link,
      source: name,
      date: (pick("pubDate") || pick("updated") || pick("published")).slice(0, 16),
    });
  }
  return out;
}

/**
 * Veb tendensiyalari.
 *
 * Standart holatda Google News RSS ishlatiladi — kalit KERAK EMAS.
 * BRAVE_API_KEY yoki TAVILY_API_KEY sozlangan bo'lsa, ular qo'shimcha
 * manba sifatida ishlatiladi (kengroq qamrov beradi).
 */
export async function webTrends(_query: string): Promise<WebHit[]> {
  // Uch tilda qidiramiz: o'zbek manbalari kam, rus va ingliz tilida
  // O'zbekiston haqidagi agro yangiliklar ancha ko'p.
  // O'zbekcha so'rov QISQA bo'lishi shart. Haqiqiy so'rov bilan
  // o'lchandi (natijalar soni):
  //   "O'zbekiston qishloq xo'jaligi fermer" -> 5
  //   "qishloq xo'jaligi"                    -> 46
  //   "agro"                                 -> 100
  //   "hosildorlik" / "bug'doy"              -> 0 va 2
  // Ko'p so'z qo'shilsa Google o'zbek tilida deyarli hech narsa
  // topmaydi va bu manba amalda bo'sh qolardi. Rus va ingliz tilida
  // uzunroq so'rov ham yaxshi ishlaydi (76 va 74 ta natija).
  const queries: [string, string][] = [
    ["qishloq xo'jaligi", "uz|UZ"],
    ["agro", "uz|UZ"],
    ["Узбекистан сельское хозяйство урожай экспорт", "ru|RU"],
    ["Uzbekistan agriculture farming export", "en-US|US"],
  ];

  const results = await Promise.all(
    queries.map(([q, loc]) => googleNews(q, loc).catch(() => [] as WebHit[])),
  );

  // Har manbadan 4 tadan olamiz — bittasi hammasini bosib ketmasin
  const merged: WebHit[] = [];
  const seen = new Set<string>();
  for (const list of results) {
    for (const h of list.slice(0, 4)) {
      const key = h.title.toLowerCase().slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(h);
    }
  }

  // Qidiruv API kaliti bo'lsa qo'shimcha natijalar
  const extra = await searchApi(_query).catch(() => [] as WebHit[]);
  for (const h of extra) {
    const key = h.title.toLowerCase().slice(0, 60);
    if (!seen.has(key)) { seen.add(key); merged.push(h); }
  }

  return merged.slice(0, 14);
}

/** Ixtiyoriy: kalit sozlangan bo'lsa qo'shimcha qidiruv */
async function searchApi(query: string): Promise<WebHit[]> {
  const brave = Deno.env.get("BRAVE_API_KEY");
  const tavily = Deno.env.get("TAVILY_API_KEY");
  if (!brave && !tavily) return [];

  if (brave) {
    const r = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`,
      { headers: { Accept: "application/json", "X-Subscription-Token": brave } },
    );
    const d = await r.json().catch(() => ({}));
    return ((d.web?.results || []) as { title?: string; description?: string; url?: string }[])
      .slice(0, 8)
      .map((x) => ({ title: x.title || "", snippet: x.description || "", url: x.url || "" }));
  }

  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: tavily, query, max_results: 8, search_depth: "basic" }),
  });
  const d = await r.json().catch(() => ({}));
  return ((d.results || []) as { title?: string; content?: string; url?: string }[])
    .slice(0, 8)
    .map((x) => ({ title: x.title || "", snippet: (x.content || "").slice(0, 250), url: x.url || "" }));
}
