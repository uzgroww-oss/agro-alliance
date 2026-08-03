import { handleCors } from "../_shared/cors.ts"
import { verifyAuth } from "../_shared/auth.ts"
import { paginatedResponse, jsonResponse, errorResponse } from "../_shared/response.ts"
import { supabaseAdmin } from "../_shared/supabase.ts"
import { parsePaginationParams } from "../_shared/validation.ts"
import { slugify } from "../_shared/helpers.ts"
import { now } from "../_shared/time.ts"
import { translateFields } from "../_shared/translate.ts"

/**
 * Yangiliklar boshqaruvi: ro'yxat, bitta yangilik, yaratish va tahrirlash.
 *
 *   GET    ?              -> ro'yxat (sahifalangan)
 *   GET    ?id=...        -> bitta yangilik (tahrirlash oynasi uchun)
 *   POST                  -> yangi yangilik
 *   PATCH  ?id=...        -> tahrirlash
 *
 * NEGA BITTA FUNKSIYADA: `admin-news-create`, `-update`, `-detail` alohida
 * yozilgan edi, lekin ULARDAN HECH BIRI DEPLOY QILINMAGAN. Natijada
 * muharrir yangilik yoza olmasdi — bu uning ASOSIY ishi. Edge funksiya
 * limiti (~100, hozir 97) uchta yangi slotga imkon bermaydi, shuning
 * uchun allaqachon deploy qilingan shu funksiyaga birlashtirildi.
 */

/** O'zbek kirill harflarini lotinga o'giradi — slug bo'sh chiqib qolmasin */
const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "o", қ: "q", ғ: "g", ҳ: "h",
}

function toLatin(text: string): string {
  return text.toLowerCase().split("").map((ch) => (ch in CYR ? CYR[ch] : ch)).join("")
}

/**
 * Sarlavhadan band bo'lmagan slug yasaydi.
 * `excludeId` — tahrirlashda o'z yozuvi bilan to'qnashmasin.
 */
async function buildSlug(title: string, excludeId?: string): Promise<string> {
  let base = slugify(toLatin(title))
  if (!base) base = "yangilik"

  let candidate = base
  for (let i = 0; i < 5; i++) {
    let q = supabaseAdmin
      .from("news_articles")
      .select("id")
      .eq("slug", candidate)
      .is("deleted_at", null)
    if (excludeId) q = q.neq("id", excludeId)
    const { data } = await q.maybeSingle()
    if (!data) return candidate
    candidate = `${base}-${i + 2}`
  }
  return `${base}-${Date.now()}`
}

/** Matn hajmidan taxminiy o'qish vaqti (daqiqa). Ommaviy sahifada ko'rsatiladi. */
function readingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 180))
}

/** Faqat shu maydonlarni mijoz yozishi mumkin — view_count, author_id va h.k. himoyalangan */
const WRITABLE = [
  "title", "content", "excerpt", "category_id", "language", "cover_image",
  "status", "is_featured", "is_breaking", "source_name", "source_url",
  "seo_title", "seo_description", "meta_keywords", "allow_comments",
] as const

function pickWritable(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of WRITABLE) {
    if (body[f] !== undefined) out[f] = body[f]
  }
  return out
}

const DETAIL_COLUMNS = `
  id, title, slug, excerpt, content, status, language, category_id,
  cover_image, source_name, source_url, is_featured, is_breaking,
  published_at, seo_title, seo_description, meta_keywords, allow_comments,
  reading_time, view_count, created_at, updated_at
`

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = await verifyAuth(req)
    if (auth.response) return auth.response
    if (auth.user.role !== "super_admin" && auth.user.role !== "admin" && auth.user.role !== "editor") {
      return errorResponse("Ruxsat yo'q", 403, "FORBIDDEN")
    }

    const url = new URL(req.url)
    const id = url.searchParams.get("id")

    /* ---------- Tarjima ----------
     * ALOHIDA chaqiruv: saqlash TEZ qolishi kerak. Muharrir "Chop etish"
     * bosganda AI tarjimasini kutib o'tirmaydi — maqola darhol saqlanadi,
     * frontend esa shu amalni ORQADAN chaqiradi.
     * Tarjima yiqilsa hech narsa buzilmaydi: kontent o'zbekcha qoladi.
     */
    if (req.method === "POST" && url.searchParams.get("action") === "translate") {
      if (!id) return errorResponse("ID kerak", 400)

      const { data: art } = await supabaseAdmin
        .from("news_articles")
        .select("id, title, excerpt, content")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle()
      if (!art) return errorResponse("Yangilik topilmadi", 404)

      const translations = await translateFields({
        title: art.title,
        excerpt: art.excerpt,
        content: art.content,
      })

      if (Object.keys(translations).length === 0) {
        return jsonResponse({ success: false, tillar: [], izoh: "Tarjima olinmadi" })
      }

      const { error } = await supabaseAdmin
        .from("news_articles")
        .update({ translations })
        .eq("id", id)
      if (error) {
        console.error("admin-news translate saqlash:", error.message)
        return errorResponse("Tarjimani saqlab bo'lmadi", 500)
      }
      return jsonResponse({ success: true, tillar: Object.keys(translations) })
    }

    /* ---------- Bitta yangilik (tahrirlash oynasi uchun) ---------- */
    if (req.method === "GET" && id) {
      const { data, error } = await supabaseAdmin
        .from("news_articles")
        .select(DETAIL_COLUMNS)
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle()

      if (error) {
        console.error("admin-news detail:", error.message)
        return errorResponse("Yangilikni yuklab bo'lmadi", 500)
      }
      if (!data) return errorResponse("Yangilik topilmadi", 404)
      return jsonResponse({ article: data })
    }

    /* ---------- Ro'yxat ---------- */
    if (req.method === "GET") {
      const { page, per_page } = parsePaginationParams(url)
      const status = url.searchParams.get("status") || ""
      const search = url.searchParams.get("search") || ""

      let query = supabaseAdmin
        .from("news_articles")
        .select(`
          id, title, slug, status, language, is_featured, is_breaking,
          published_at, view_count, created_at,
          category:news_categories!category_id(id, name_uz, key),
          author:profiles!author_id(id, name)
        `, { count: "exact" })
        .is("deleted_at", null)

      if (status) query = query.eq("status", status)
      if (search) {
        // PostgREST filtr metabelgilarini olib tashlash — filtr injeksiyasi oldini olish
        const s = search.replace(/[,.():*%"'\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
        if (s) query = query.ilike("title", `%${s}%`)
      }

      query = query.order("created_at", { ascending: false })
      const from = (page - 1) * per_page
      query = query.range(from, from + per_page - 1)

      const { data, error, count } = await query
      if (error) {
        console.error("admin-news list:", error.message)
        return errorResponse("Yangiliklarni yuklab bo'lmadi", 500)
      }

      const articles = (data || []).map((a: Record<string, unknown>) => {
        const cat = (a.category || {}) as Record<string, unknown>
        return {
          id: a.id,
          title: a.title,
          slug: a.slug,
          category: cat.id ? { id: cat.id, key: cat.key, label: cat.name_uz } : null,
          author: (a.author as Record<string, unknown>) || null,
          status: a.status,
          language: a.language,
          is_featured: a.is_featured,
          is_breaking: a.is_breaking,
          published_at: a.published_at,
          view_count: a.view_count,
          created_at: a.created_at,
        }
      })

      return paginatedResponse(articles, page, per_page, count || 0)
    }

    /* ---------- Yaratish ---------- */
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>
      const title = typeof body.title === "string" ? body.title.trim() : ""
      const content = typeof body.content === "string" ? body.content.trim() : ""
      if (!title) return errorResponse("Sarlavha majburiy", 400)
      if (!content) return errorResponse("Matn majburiy", 400)

      const fields = pickWritable(body)
      const status = (fields.status as string) || "draft"
      const stamp = now()

      const { data, error } = await supabaseAdmin
        .from("news_articles")
        .insert({
          ...fields,
          title,
          content,
          status,
          slug: await buildSlug(title),
          language: fields.language || "uz",
          reading_time: readingTime(content),
          // MUHIM: status "published" bo'lsa-yu published_at bo'sh qolsa,
          // ommaviy ro'yxat `published_at <= now` filtri tufayli maqolani
          // KO'RSATMAYDI — muharrir chop etdim deb o'ylab qoladi.
          published_at: status === "published" ? stamp : null,
          author_id: auth.user.id,
          created_by: auth.user.id,
        })
        .select("id, title, slug, status")
        .single()

      if (error) {
        console.error("admin-news create:", error.message)
        return errorResponse("Yangilikni saqlab bo'lmadi", 500)
      }
      return jsonResponse({ success: true, article: data }, 201)
    }

    /* ---------- Tahrirlash ---------- */
    if (req.method === "PATCH" || req.method === "PUT") {
      if (!id) return errorResponse("ID kerak", 400)

      const { data: existing } = await supabaseAdmin
        .from("news_articles")
        .select("id, title, status, published_at")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle()
      if (!existing) return errorResponse("Yangilik topilmadi", 404)

      const body = await req.json().catch(() => ({})) as Record<string, unknown>
      const updates = pickWritable(body)
      if (Object.keys(updates).length === 0) {
        return errorResponse("O'zgartirish uchun maydon yo'q", 400)
      }

      if (typeof updates.title === "string") {
        const t = updates.title.trim()
        if (!t) return errorResponse("Sarlavha bo'sh bo'lmasin", 400)
        updates.title = t
        if (t !== existing.title) updates.slug = await buildSlug(t, id)
      }

      if (typeof updates.content === "string") {
        const c = updates.content.trim()
        if (!c) return errorResponse("Matn bo'sh bo'lmasin", 400)
        updates.content = c
        updates.reading_time = readingTime(c)
      }

      // Chop etishga o'tkazilganda sana bir marta qo'yiladi; qoralamaga
      // qaytarilsa tozalanadi.
      if (updates.status === "published" && !existing.published_at) {
        updates.published_at = now()
      } else if (updates.status === "draft") {
        updates.published_at = null
      }

      // Tarjima qilinadigan maydon o'zgargan bo'lsa, ESKI TARJIMA
      // ESKIRDI — uni tozalaymiz, aks holda sayt yangi o'zbekcha matnni
      // eski ruscha tarjima bilan ko'rsatib turadi.
      if (["title", "excerpt", "content"].some((f) => updates[f] !== undefined)) {
        updates.translations = {}
      }

      updates.editor_id = auth.user.id
      updates.updated_by = auth.user.id
      updates.updated_at = now()

      const { data, error } = await supabaseAdmin
        .from("news_articles")
        .update(updates)
        .eq("id", id)
        .select("id, title, slug, status")
        .single()

      if (error) {
        console.error("admin-news update:", error.message)
        return errorResponse("Yangilikni saqlab bo'lmadi", 500)
      }
      return jsonResponse({ success: true, article: data })
    }

    return errorResponse("Method not allowed", 405)
  } catch (err) {
    console.error("admin-news:", err instanceof Error ? err.message : err)
    return errorResponse("Xatolik yuz berdi", 500)
  }
})
