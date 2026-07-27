-- ============================================================================
-- Marketing manbalari
--
-- NEGA ALOHIDA JADVAL: news_sources mavjud, lekin u YANGILIKLAR
-- dvigatelini oziqlantiradi — u yerga qo'shilgan har sayt maqola
-- sifatida saytga chiqib ketadi. Marketing tahlili uchun esa boshqa
-- manbalar kerak bo'lishi mumkin (raqobatchi bloglar, soha hisobotlari)
-- va ular saytda e'lon qilinmasligi kerak.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.smm_sources (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(160) NOT NULL,
  url         varchar(500) NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  -- Oxirgi o'qishda xato bo'lsa — panelда ko'rsatamiz
  last_error  text,
  last_read_at timestamptz,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (url)
);

CREATE INDEX IF NOT EXISTS idx_smm_sources_active
  ON public.smm_sources (is_active) WHERE is_active;

-- RLS: faqat service_role (edge funksiyalar). Frontend to'g'ridan-to'g'ri
-- o'qimaydi — boshqa smm_* jadvallardek.
ALTER TABLE public.smm_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.smm_sources FROM anon, authenticated;
