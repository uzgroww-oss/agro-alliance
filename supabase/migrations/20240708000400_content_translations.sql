-- ============================================================================
-- KONTENT TARJIMALARI: ru / en / zh
--
-- Nega alohida ustun emas (title_ru, title_en, title_zh...):
--   har yangi til uchun har jadvalga N ta ustun qo'shish kerak bo'lardi.
--   JSONB bitta ustunda saqlaydi va yangi til qo'shish migratsiyasiz o'tadi.
--
-- Shakl:
--   {
--     "ru": { "title": "...", "excerpt": "...", "content": "..." },
--     "en": { ... },
--     "zh": { ... }
--   }
--
-- Tarjima YO'Q bo'lsa — o'zbekcha matn ko'rsatiladi. Ya'ni sayt hech
-- qachon bo'sh chiqmaydi va tarjima kechikishi hech narsani buzmaydi.
-- ============================================================================

alter table public.news_articles     add column if not exists translations jsonb not null default '{}'::jsonb;
alter table public.homepage_sections add column if not exists translations jsonb not null default '{}'::jsonb;
-- DIQQAT: jadval nomi `homepage_items` EMAS — `homepage_section_items`
alter table public.homepage_section_items add column if not exists translations jsonb not null default '{}'::jsonb;
alter table public.homepage_stats         add column if not exists translations jsonb not null default '{}'::jsonb;
alter table public.partners          add column if not exists translations jsonb not null default '{}'::jsonb;
alter table public.news_categories   add column if not exists translations jsonb not null default '{}'::jsonb;
alter table public.team_members      add column if not exists translations jsonb not null default '{}'::jsonb;
alter table public.bloggers          add column if not exists translations jsonb not null default '{}'::jsonb;

-- Tarjimasi yo'q yozuvlarni tez topish uchun (fon tarjimasi navbati).
-- Faqat BO'SH tarjimalar indekslanadi — indeks kichik qoladi.
create index if not exists idx_news_articles_untranslated
  on public.news_articles (created_at desc)
  where translations = '{}'::jsonb and deleted_at is null;

comment on column public.news_articles.translations is
  'Til kodi -> maydon nomi -> tarjima. Bo''sh bo''lsa o''zbekcha ko''rsatiladi.';
