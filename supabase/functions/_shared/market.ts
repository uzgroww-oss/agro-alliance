import { supabaseAdmin } from "./supabase.ts";

/**
 * Bozor ma'lumotlarini yig'ish: raqobatchilar va veb tendensiyalari.
 *
 * MUHIM CHEKLOV — ochiq aytilsin:
 * "Butun internetni tahlil qilish" imkonsiz. Amalda ikki manba bor:
 *   1) Instagram business_discovery — RASMIY API, boshqa Business/
 *      Creator hisoblarining ochiq ko'rsatkichlarini beradi. Ishonchli.
 *   2) Veb qidiruv — qidiruv API kaliti bo'lsagina. Kalitsiz bu qism
 *      shunchaki tushib qoladi, tahlil raqobatchilar asosida davom etadi.
 * O'ylab topilgan "internet tahlili" berilmaydi.
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

export type WebHit = { title: string; snippet: string; url: string };

/**
 * Veb qidiruv. Kalit sozlanmagan bo'lsa BO'SH ro'yxat qaytaradi —
 * xato emas. Tahlil raqobatchilar asosida davom etadi.
 *
 * Ikki provayder qo'llab-quvvatlanadi, qaysi biri sozlangan bo'lsa
 * o'sha ishlatiladi.
 */
export async function webTrends(query: string): Promise<WebHit[]> {
  const brave = Deno.env.get("BRAVE_API_KEY");
  const tavily = Deno.env.get("TAVILY_API_KEY");

  try {
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

    if (tavily) {
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
  } catch {
    // Qidiruv yiqilsa tahlil to'xtamasin
    return [];
  }
  return [];
}
