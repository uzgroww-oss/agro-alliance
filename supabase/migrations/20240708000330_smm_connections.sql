-- ============================================================================
-- SMM ulanishlari — admin panel orqali tarmoqlarni ulash
--
-- Nega baza (Supabase secrets emas):
--   Secrets faqat CLI/dashboard orqali qo'yiladi — admin panelidan bo'lmaydi.
--   Bu jadval orqali admin o'zi ulaydi. Publisherlar avval shu yerdan
--   o'qiydi, topilmasa env secret'ga qaytadi (eski sozlama buzilmasin).
--
-- XAVFSIZLIK: bu yerda tokenlar saqlanadi. RLS to'liq yopiq —
--   faqat service_role (edge funksiyalar) kiradi. Frontend hech qachon
--   token qiymatini olmaydi, faqat "ulangan/ulanmagan" holatini ko'radi.
--   (Loyihada shunga o'xshash instagram_tokens jadvali allaqachon bor.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.smm_connections (
  platform     varchar(20)  PRIMARY KEY,   -- telegram | facebook | instagram | linkedin | youtube
  config       jsonb        NOT NULL DEFAULT '{}'::jsonb,
  -- Frontend'ga ko'rsatish uchun xavfsiz nom (masalan kanal nomi yoki sahifa nomi)
  display_name varchar(255),
  connected_by uuid         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.smm_connections ENABLE ROW LEVEL SECURITY;

-- Hech qanday policy yo'q => anon/authenticated uchun yopiq.
-- service_role RLS ni chetlab o'tadi.
REVOKE ALL ON public.smm_connections FROM anon, authenticated;
