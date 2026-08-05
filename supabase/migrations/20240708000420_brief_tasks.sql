-- ============================================================================
-- TZ BANDLARI VA BAJARILISH DALILI
-- ============================================================================
-- MAQSAD: hamkor TZ da nima yozgan bo'lsa, hisobotda aynan shu bandlar
-- ko'rinsin — qaysi biri bajarildi, kim bajardi, qanday qilindi va
-- qaysi video bilan.
--
-- NEGA YANGI JADVAL EMAS: `partner_tasks` ALLAQACHON mavjud va aynan
-- shu ish uchun tuzilgan (title, status pending|progress|done,
-- sort_order). U hozir hamkor hisobotidagi "Jami ishlar" va
-- "Bajarilish %" ni beradi.
--
-- Agar bandlar uchun ALOHIDA jadval yaratilsa, bitta hisobot varag'ida
-- IKKITA boshqa-boshqa "bajarilish foizi" paydo bo'lardi — biri eski
-- ishlardan, ikkinchisi TZ bandlaridan. Ular hech qachon mos kelmaydi
-- va hamkor qaysi biriga ishonishni bilmaydi. Shuning uchun mavjud
-- jadval kengaytiriladi.
-- ============================================================================

alter table public.partner_tasks
  -- Qaysi TZ so'rovidan kelib chiqqan. NULL — admin qo'lda kiritgan
  -- eski ish (ular ham hisobotda qoladi).
  add column if not exists brief_id uuid references public.partner_briefs(id) on delete set null,
  -- Kim bajardi va qachon
  add column if not exists done_by uuid references public.profiles(id) on delete set null,
  add column if not exists done_at timestamptz,
  -- "Qanday qilindi" — blogerning izohi. Hisobotda shu ko'rinadi.
  add column if not exists note text;

create index if not exists idx_partner_tasks_brief on public.partner_tasks (brief_id);

-- ============================================================================
-- BLOGER TZ UCHUN BIRIKTIRGAN VIDEOLAR
-- ============================================================================
-- MUAMMO 1: videolar alohida jadvalda emas — ular `profiles.metadata`
-- ichida JSON massiv sifatida yotadi. Bloger videosini o'chirsa yoki
-- profili tozalansa, hisobotdagi "bajarildi" bandi ortida hech narsa
-- qolmaydi va hamkor bosgan havola bo'shliqqa olib boradi.
--
-- MUAMMO 2: video `id` si global yagona EMAS va mijoz nazoratida
-- (bloger uni so'rov tanasida o'zi yuboradi). Ikki bloger bir xil
-- YouTube havolasini qo'shsa, ikkalasida ham bir xil id bo'ladi.
--
-- YECHIM: biriktirish paytida videoning NUSXASI (havola, nom, muqova
-- va o'sha lahzadagi raqamlar) shu yerga yoziladi. Dalil videodan
-- qat'i nazar saqlanib qoladi, va "hisobot tuzilgan paytda qancha
-- ko'rish bor edi?" degan savolga ham javob beradi.
--
-- NEGA JSONB MASSIV EMAS: `metadata` ni to'liq qayta yozish parallel
-- so'rovlarda ma'lumot yo'qotadi. Alohida QATORLAR bunday muammoga
-- umuman tushmaydi.
-- ============================================================================

create table if not exists public.blogger_task_videos (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.blogger_task_assignments(id) on delete cascade,
  blogger_id    uuid not null references public.profiles(id) on delete cascade,

  -- Manba video (profiles.metadata.videos ichidagi id) — tirik
  -- raqamlarni topish uchun. Yagona kalit sifatida ishlatilmaydi.
  video_id        text not null,
  -- HAQIQIY identifikator: havola. Ikki bloger bir xil havolani
  -- qo'shishi mumkin, lekin bitta bloger ikki marta qo'sha olmaydi.
  video_link      text not null,
  video_name      text,
  video_thumbnail text,
  platform        text,

  -- Biriktirilgan LAHZADAGI raqamlar. Video o'chsa ham qoladi.
  views_at    integer not null default 0,
  likes_at    integer not null default 0,
  comments_at integer not null default 0,

  added_at timestamptz not null default now()
);

create unique index if not exists uq_task_video_link
  on public.blogger_task_videos (assignment_id, video_link);
create index if not exists idx_task_videos_blogger
  on public.blogger_task_videos (blogger_id);
create index if not exists idx_task_videos_assignment
  on public.blogger_task_videos (assignment_id);

-- ============================================================================
-- BITTA TZ SO'ROVI — BITTA TOPSHIRIQ
-- ============================================================================
-- Ilgari `partner_briefs.task_id` da faqat oddiy indeks bor edi.
-- Admin bir so'rovni ikki marta yuborsa, birinchi topshiriq bilan
-- bog'lam JIMGINA o'chib, hamkor panelidagi "bajarilish" ikkinchi
-- topshiriqning raqamlarini ko'rsata boshlardi.
-- ============================================================================
create unique index if not exists uq_partner_briefs_task
  on public.partner_briefs (task_id)
  where task_id is not null and deleted_at is null;

-- ============================================================================
-- Xavfsizlik: loyihadagi boshqa jadvallar bilan bir xil naqsh
-- (qarang 20240708000280_security_hardening.sql) — faqat service_role.
-- ============================================================================
alter table public.blogger_task_videos enable row level security;
revoke all on public.blogger_task_videos from anon, authenticated;
