-- ============================================================================
-- BLOGER SHARHLARI JADVALI
-- ============================================================================
-- Bu jadval ilgari migratsiyada emas, ildizdagi `SHARHLAR_JADVAL.sql`
-- faylida turardi va uni Supabase panelidan QO'LDA ishga tushirish kerak
-- edi. Natijada jadval ishlab turgan bazada bor edi, lekin migratsiyalar
-- tarixida yo'q — ya'ni yangi muhitni (test, zaxira nusxa, boshqa
-- server) migratsiyalardan tiklab bo'lmasdi va farq sezilmasdi ham.
--
-- `if not exists` — mavjud bazada hech narsani o'zgartirmaydi.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blogger_reviews (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  blogger_id   uuid         NOT NULL REFERENCES public.bloggers(id) ON DELETE CASCADE,
  author_name  varchar(120) NOT NULL,
  rating       smallint     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text,
  -- Sharh admin tasdig'idan o'tadi (spam va soxta baholarga qarshi).
  -- `blogger-reviews` funksiyasi yangi sharhni ATAYLAB `false` bilan
  -- yozadi — bu yerdagi standart qiymatga tayanmaydi.
  is_approved  boolean      NOT NULL DEFAULT false,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_blogger_reviews_blogger
  ON public.blogger_reviews (blogger_id) WHERE deleted_at IS NULL;

ALTER TABLE public.blogger_reviews ENABLE ROW LEVEL SECURITY;

-- Siyosat ATAYLAB yo'q: jadvalga faqat service_role (edge funksiyalar)
-- kiradi. RLS yoqilgan va siyosatsiz — anon va authenticated uchun
-- jadval butunlay yopiq.
