-- ============================================================================
-- Marketing tahlili: raqobatchilar va kontent reja
--
-- NEGA: SMM tahlili faqat O'Z hisoblarimizga qarardi. "Nima yozay,
-- qanday sotuvni oshiray" degan savolga javob berish uchun bozorni ham
-- ko'rish kerak — kim nima yozyapti, nimasi ishlayapti.
-- ============================================================================

-- Kuzatiladigan raqobatchilar
CREATE TABLE IF NOT EXISTS public.smm_competitors (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    varchar(20) NOT NULL DEFAULT 'instagram',
  username    varchar(120) NOT NULL,
  label       varchar(160),                      -- ko'rsatish uchun nom
  -- Oxirgi yig'ilgan ko'rsatkichlar (keshdan foydalanish uchun)
  followers   integer,
  posts       integer,
  avg_likes   integer,
  last_error  text,
  checked_at  timestamptz,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, username)
);

-- AI yaratgan kontent rejalar
CREATE TABLE IF NOT EXISTS public.smm_plans (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Butun tahlil: bozor holati, raqobat, sotuv yo'llari, kunlik reja
  data        jsonb       NOT NULL,
  days        integer     NOT NULL DEFAULT 7,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smm_plans_created ON public.smm_plans (created_at DESC);

-- RLS: faqat service_role (edge funksiyalar). Frontend to'g'ridan-to'g'ri
-- o'qimaydi — hamma narsa funksiya orqali, boshqa smm_* jadvallardek.
ALTER TABLE public.smm_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smm_plans       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.smm_competitors FROM anon, authenticated;
REVOKE ALL ON public.smm_plans       FROM anon, authenticated;
