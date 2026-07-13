-- ============================================================
-- Bloger sharhlari jadvali — SQL Editor da ishga tushiring
-- ============================================================
create table if not exists public.blogger_reviews (
  id           uuid         primary key default gen_random_uuid(),
  blogger_id   uuid         not null references public.bloggers(id) on delete cascade,
  author_name  varchar(120) not null,
  rating       smallint     not null check (rating between 1 and 5),
  comment      text,
  is_approved  boolean      not null default true,
  created_at   timestamptz  not null default now(),
  deleted_at   timestamptz
);

create index if not exists idx_blogger_reviews_blogger
  on public.blogger_reviews (blogger_id) where deleted_at is null;

alter table public.blogger_reviews enable row level security;

-- Faqat service_role (edge funksiyalar) yozadi/o'qiydi — public to'g'ridan-to'g'ri kira olmaydi
-- (blogger-reviews funksiyasi supabaseAdmin bilan ishlaydi)

-- Tekshirish:
select 'blogger_reviews jadval tayyor' as natija;
