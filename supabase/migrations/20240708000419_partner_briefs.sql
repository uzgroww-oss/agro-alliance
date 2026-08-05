-- ============================================================================
-- HAMKOR TZ SO'ROVLARI (partner -> admin -> bloger)
-- ============================================================================
-- HOZIRGI HOLAT: admin blogerlarga TZ yubora oladi (blogger_tasks +
-- blogger_task_assignments). Lekin TZ ning O'ZI qayerdan kelishi
-- hech qayerda yozilmagan edi — hamkor kompaniya "menga shunaqa
-- reklama kerak" deb telefon yoki Telegram orqali aytardi va u
-- tizimda iz qoldirmasdi.
--
-- ENDI: hamkor TZ ni PANELDAN yozadi, admin ko'radi va aynan shu
-- TZ dan blogerlarga topshiriq yaratadi. Hamkor esa o'z so'rovi
-- qaysi bosqichda ekanini ko'rib turadi.
--
-- Zanjir: partner_briefs -> blogger_tasks -> blogger_task_assignments
-- ============================================================================

create table if not exists public.partner_briefs (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partners(id) on delete cascade,
  -- TZ ni yozgan foydalanuvchi (hamkor hisobi)
  created_by  uuid references public.profiles(id) on delete set null,

  title       varchar(255) not null,
  description text,
  priority    varchar(20) not null default 'normal',   -- low | normal | high
  deadline    date,
  -- Havola: mahsulot sahifasi, brief fayli va h.k.
  file_url    text,
  file_name   text,

  -- new       — hamkor yubordi, admin hali ko'rmagan
  -- seen      — admin ko'rib chiqmoqda
  -- sent      — blogerlarga topshiriq sifatida yuborildi
  -- rejected  — qabul qilinmadi (sababi admin_note da)
  status      varchar(20) not null default 'new',
  -- Adminning hamkorga javobi: nega rad etildi yoki qanday o'zgartirildi
  admin_note  text,

  -- Blogerlarga yuborilgach yaratilgan topshiriq. Hamkor shu orqali
  -- ishning qay darajada bajarilganini ko'radi.
  task_id     uuid references public.blogger_tasks(id) on delete set null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_partner_briefs_partner
  on public.partner_briefs (partner_id, created_at desc);
create index if not exists idx_partner_briefs_status
  on public.partner_briefs (status) where deleted_at is null;
create index if not exists idx_partner_briefs_task
  on public.partner_briefs (task_id);

create trigger trg_partner_briefs_updated_at
  before update on public.partner_briefs
  for each row execute function public.handle_updated_at();

alter table public.partner_briefs enable row level security;
-- Siyosat ataylab yo'q: hamkor ham, admin ham edge funksiya orqali
-- kiradi (service_role). Hamkorning qaysi kompaniyaga tegishli ekani
-- funksiya ichida tekshiriladi — brauzerdan to'g'ridan-to'g'ri
-- so'rovda boshqa kompaniyaning TZ sini ko'rish imkoni bo'lmasin.
