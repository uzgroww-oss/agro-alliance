import { supabaseAdmin } from "./supabase.ts";

/**
 * Facebook sahifa tokenini olish.
 *
 * MUAMMO: qo'lda kiritilgan Page Access Token qisqa muddatli bo'ladi
 * (Graph Explorer 1-2 soatlik beradi) va tez orada
 * "Session has expired" bilan yiqiladi.
 *
 * YECHIM: Instagram OAuth'da olingan UZOQ MUDDATLI foydalanuvchi
 * tokenidan sahifa tokeni chiqariladi. Uzoq muddatli foydalanuvchi
 * tokenidan olingan sahifa tokenlari MUDDATSIZ bo'ladi — Meta shunday
 * ishlaydi. Ya'ni bir marta Instagram ulansa, Facebook o'z-o'zidan
 * ishlaydi va qo'lda token kiritish kerak emas.
 */

export type FbPage = { id: string; name: string; token: string };

/** Qisqa muddatli tokenni uzoq muddatliga almashtirish (60 kun) */
export async function exchangeForLongLived(token: string): Promise<string | null> {
  const appId = Deno.env.get("FACEBOOK_APP_ID");
  const secret = Deno.env.get("FACEBOOK_APP_SECRET");
  if (!appId || !secret) return null;
  try {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${appId}` +
      `&client_secret=${secret}&fb_exchange_token=${encodeURIComponent(token)}`,
    );
    const d = await r.json().catch(() => ({}));
    return d.access_token || null;
  } catch {
    return null;
  }
}

/** Foydalanuvchi tokenidan sahifa ro'yxatini olish */
async function pagesFromUserToken(userToken: string): Promise<FbPage[]> {
  try {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`,
    );
    const d = await r.json().catch(() => ({}));
    if (d.error) return [];
    return ((d.data || []) as { id?: string; name?: string; access_token?: string }[])
      .filter((p) => p.id && p.access_token)
      .map((p) => ({ id: p.id!, name: p.name || p.id!, token: p.access_token! }));
  } catch {
    return [];
  }
}

/** Saqlangan sozlama (qo'lda kiritilgan yoki avval chiqarilgan) */
async function savedConfig(): Promise<{ page_id?: string; page_token?: string }> {
  const { data } = await supabaseAdmin
    .from("smm_connections").select("config").eq("platform", "facebook").maybeSingle();
  return (data?.config || {}) as { page_id?: string; page_token?: string };
}

/** Chiqarilgan tokenni saqlab qo'yamiz — har safar qayta so'ralmasin */
async function cachePage(page: FbPage) {
  await supabaseAdmin.from("smm_connections").upsert({
    platform: "facebook",
    config: { page_id: page.id, page_token: page.token },
    display_name: page.name,
    updated_at: new Date().toISOString(),
  }, { onConflict: "platform" });
}

/** Token hali amal qiladimi? */
async function tokenWorks(pageId: string, token: string): Promise<boolean> {
  try {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/${pageId}?fields=id&access_token=${encodeURIComponent(token)}`,
    );
    const d = await r.json().catch(() => ({}));
    return Boolean(d.id);
  } catch {
    return false;
  }
}

/**
 * Ishlaydigan sahifa tokenini qaytaradi.
 *
 * Tartib:
 *   1) saqlangan token — amal qilsa o'shani ishlatamiz
 *   2) Instagram OAuth tokenidan chiqaramiz (muddatsiz bo'ladi)
 *   3) env dagi eski sozlama
 * Topilmasa null.
 */
export async function getFacebookPage(): Promise<FbPage | null> {
  const cfg = await savedConfig();

  if (cfg.page_id && cfg.page_token && (await tokenWorks(cfg.page_id, cfg.page_token))) {
    const { data } = await supabaseAdmin
      .from("smm_connections").select("display_name").eq("platform", "facebook").maybeSingle();
    return { id: cfg.page_id, name: data?.display_name || cfg.page_id, token: cfg.page_token };
  }

  // Saqlangan token yiqildi — Instagram tokenidan qayta chiqaramiz
  const { data: igTok } = await supabaseAdmin
    .from("instagram_tokens")
    .select("access_token")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (igTok?.access_token) {
    const pages = await pagesFromUserToken(igTok.access_token);
    if (pages.length) {
      // Ilgari tanlangan sahifa bo'lsa o'shani saqlaymiz
      const picked = pages.find((p) => p.id === cfg.page_id) || pages[0];
      await cachePage(picked);
      return picked;
    }
  }

  // Eski usul: env secret
  const envId = Deno.env.get("FACEBOOK_PAGE_ID");
  const envToken = Deno.env.get("FACEBOOK_PAGE_TOKEN");
  if (envId && envToken && (await tokenWorks(envId, envToken))) {
    return { id: envId, name: envId, token: envToken };
  }

  return null;
}
