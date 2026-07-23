-- ============================================================================
-- SMM postlari — AI yaratadi, ODAM tasdiqlaydi, keyin tarmoqlarga joylanadi
--
-- Nega yangi jadval (mavjud social_posts emas):
--   social_posts news_articles ga bog'langan (article_id) — u yangiliklar
--   uchun qurilgan. SMM postlari maqolaga bog'liq emas, mustaqil kontent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.smm_posts (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  title        varchar(255),
  content      text         NOT NULL,              -- post matni
  hashtags     text,                               -- "#agro #fermer"
  image_url    text,                               -- Storage'dagi rasm (ixtiyoriy)
  -- Qaysi tarmoqlarga: ['telegram','facebook','instagram','linkedin','youtube']
  platforms    text[]       NOT NULL DEFAULT '{}',
  -- draft: AI yaratdi/qoralama · pending_approval: tasdiq kutmoqda
  -- approved: tasdiqlandi, joylashga tayyor · published: joylandi · failed: xato
  status       varchar(20)  NOT NULL DEFAULT 'draft',
  ai_generated boolean      NOT NULL DEFAULT false,
  scheduled_at timestamptz,                        -- kelajakka rejalashtirilgan
  published_at timestamptz,
  created_by   uuid         REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by  uuid         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_smm_posts_status     ON public.smm_posts (status);
CREATE INDEX IF NOT EXISTS idx_smm_posts_created_at ON public.smm_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smm_posts_deleted_at ON public.smm_posts (deleted_at);

-- Har bir tarmoqqa joylash natijasi (bittasi ishlab, boshqasi xato bo'lishi mumkin)
CREATE TABLE IF NOT EXISTS public.smm_post_results (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid         NOT NULL REFERENCES public.smm_posts(id) ON DELETE CASCADE,
  platform     varchar(20)  NOT NULL,
  success      boolean      NOT NULL DEFAULT false,
  external_id  text,                               -- tarmoqdagi post id
  error        text,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smm_results_post ON public.smm_post_results (post_id);

-- ---------------------------------------------------------------------------
-- RLS: bu jadvallarga faqat service_role (edge funksiyalar) kiradi.
-- Frontend to'g'ridan-to'g'ri o'qimaydi — hamma narsa funksiya orqali.
-- ---------------------------------------------------------------------------
ALTER TABLE public.smm_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smm_post_results ENABLE ROW LEVEL SECURITY;

-- Anon/authenticated uchun hech qanday policy YO'Q => kirish yopiq.
-- service_role RLS ni chetlab o'tadi, shuning uchun funksiyalar ishlaydi.

REVOKE ALL ON public.smm_posts        FROM anon, authenticated;
REVOKE ALL ON public.smm_post_results FROM anon, authenticated;
