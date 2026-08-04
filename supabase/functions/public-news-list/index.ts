import { handleCors } from "../_shared/cors.ts"
import { cachedJsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { parsePaginationParams } from "../_shared/validation.ts"
import { formatNewsDate } from "../_shared/time.ts"
import { applyLang, langOf } from "../_shared/translate.ts"

/**
 * Kategoriya nomi tanlangan tilda.
 * name_ru / name_en ustunlari jadvalda ALLAQACHON bor edi — ular
 * ishlatiladi; xitoycha esa translations JSONB dan olinadi.
 */
function katNomi(c: Record<string, unknown>, lang: string | null): string {
  const uz = (c.name_uz as string) || (c.key as string)
  if (!lang || lang === "uz") return uz
  if (lang === "ru" && c.name_ru) return c.name_ru as string
  if (lang === "en" && c.name_en) return c.name_en as string
  const tr = (c.translations as Record<string, Record<string, string>> | undefined)?.[lang]
  return tr?.name_uz || tr?.name || uz
}

/** "Barcha yangiliklar" chipi — bu kategoriya emas, shuning uchun qo'lda */
const KAT_HAMMASI: Record<string, string> = {
  uz: "Barcha yangiliklar",
  ru: "Все новости",
  en: "All news",
  zh: "所有新闻",
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const { page, per_page } = parsePaginationParams(url)
    const lang = langOf(url)
/**
     * TARJIMA BU YERDA QILINMAYDI — ATAYLAB.
     *
     * Ilgari tarjimasi yo'q yozuvlar aynan shu so'rov ichida tarjima
     * qilinardi. Natijada AI kvotasi tugaganda har bir tashrifchi
     * 7-8 soniya kutardi va tarjima baribir chiqmasdi: kutish bor,
     * foyda yo'q. Kesh eskirgan sari bu takrorlanardi.
     *
     * Endi tarjima FAQAT ikki joyda bo'ladi: admin kontentni
     * saqlaganda va admin panelidagi "qayta tarjima" tugmasi
     * bosilganda. Ommaviy sahifa hech qachon AI ni kutmaydi.
     */
    const category = url.searchParams.get("category") || ""
    const search = url.searchParams.get("search") || ""

    let query = supabaseAdmin
      .from("news_articles")
      .select(`
        id, title, slug, excerpt, cover_image, view_count,
        published_at, is_featured, reading_time, translations,
        category:news_categories!category_id(key, name_uz, icon),
        author:profiles!author_id(name, avatar)
      `, { count: "exact" })
      .is("deleted_at", null)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())

    if (category && category !== "all") {
      query = query.eq("category.key", category)
    }

    if (search) {
      // XAVFSIZLIK: PostgREST filtr metabelgilarini olib tashlash — filtr injeksiyasi oldini olish
      const s = search.replace(/[,.():*%"'\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
      if (s) query = query.or(`title.ilike.%${s}%,excerpt.ilike.%${s}%`)
    }

    query = query.order("published_at", { ascending: false })

    const from = (page - 1) * per_page
    const to = from + per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) return errorResponse(error.message, 500)


    const news = (data || []).map((row: Record<string, unknown>) => {
      // Tanlangan tilda: tarjima bo'lsa u, bo'lmasa o'zbekcha
      const a = applyLang(row, lang, ["title", "excerpt"])
      const cat = a.category as Record<string, unknown> || {}
      const author = a.author as Record<string, unknown> || {}
      const publishedAt = a.published_at as string || ""
      return {
        slug: a.slug,
        title: a.title,
        cat: cat.key || "",
        desc: a.excerpt || "",
        date: formatNewsDate(publishedAt),
        views: (Number(a.view_count) || 0) > 1000
          ? `${Math.floor(Number(a.view_count) / 1000)}K+`
          : `${Number(a.view_count) || 0}`,
        seed: a.cover_image || "",
        top: a.is_featured || false,
        author: author.name as string || undefined,
        body: [] as string[],
      }
    })

    // Fetch categories
    const { data: categories } = await supabaseAdmin
      .from("news_categories")
      .select("id, key, name_uz, name_ru, name_en, icon, translations")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })

    // TEZLIK: ilgari bu yerda HAR KATEGORIYA uchun alohida `count: exact`
    // so'rovi KETMA-KET yuborilardi (10 kategoriya = 10 ta borish-kelish,
    // har biri to'liq skan). Endi bitta so'rov bilan barcha chop etilgan
    // maqolalarning category_id lari olinadi va sanoq JS'da qilinadi.
    const { data: idRows } = await supabaseAdmin
      .from("news_articles")
      .select("category_id")
      .eq("status", "published")
      .is("deleted_at", null)
      .lte("published_at", new Date().toISOString())

    const perCat = new Map<string, number>()
    for (const row of idRows || []) {
      const k = (row as { category_id: string | null }).category_id
      if (k) perCat.set(k, (perCat.get(k) || 0) + 1)
    }

    const cats = [
      { key: "all", label: KAT_HAMMASI[lang ?? "uz"], icon: "grid", count: count || 0 },
      ...(categories || []).map((cat) => ({
        key: cat.key,
        label: katNomi(cat, lang),
        icon: cat.icon || "grid",
        count: perCat.get(cat.id) || 0,
      })),
    ]

    return cachedJsonResponse({
      news,
      pagination: {
        page,
        per_page,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / per_page),
      },
      categories: cats,
    // 60 soniya: yangilik chop etilgach saytda ko'rinishi uchun eng ko'pi
    // bilan bir daqiqa. Buning evaziga takroriy tashriflarda so'rov
    // umuman ketmaydi (o'lchandi: keshsiz 1066ms -> keshlangan ~11ms).
    }, 60)
  } catch (err) {
    console.error("public-news-list:", err instanceof Error ? err.message : err)
    return errorResponse("Yangiliklarni yuklab bo'lmadi", 500)
  }
})
