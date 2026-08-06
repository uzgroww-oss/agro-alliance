-- ============================================================================
-- HAMKOR SHIKOYATLARI (E'TIROZLAR)
-- ============================================================================
-- MUAMMO: bloger TZ ni noto'g'ri bajarsa yoki video hamkorga yoqmasa,
-- hamkorning ayta oladigan joyi yo'q edi. U telefon qilardi, admin
-- blogerga og'zaki yetkazardi va bularning hech biri tizimda iz
-- qoldirmasdi. Natijada:
--   - bloger aynan NIMA noto'g'ri ekanini bilmasdi
--   - bir xil xato qayta-qayta takrorlanardi
--   - admin qaysi bloger qancha e'tiroz olganini ko'ra olmasdi
--
-- YECHIM: hamkor aniq sabab, izoh va RASM (ekran surati) bilan
-- e'tiroz yozadi. Bloger uni o'z panelida ko'radi, admin esa
-- hammasini kuzatadi.
--
-- Rasm SHART emas, lekin muhim: "video sifati past" degan gapdan
-- ko'ra ekran surati aniqroq va bahsni qisqartiradi.
-- ============================================================================

create table if not exists public.shikoyatlar (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partners(id) on delete cascade,
  -- Kimga qarshi. Bloger o'chirilsa e'tiroz ham ketadi — u boshqa
  -- hech kimga tegishli emas.
  blogger_id  uuid not null references public.profiles(id) on delete cascade,

  -- Qaysi topshiriq va qaysi video haqida (ikkalasi ham ixtiyoriy:
  -- e'tiroz umumiy ish sifatiga ham bo'lishi mumkin)
  task_id     uuid references public.blogger_tasks(id) on delete set null,
  video_link  text,

  -- tz_bajarilmagan | sifat | notogri_malumot | brend | muddat | boshqa
  sabab       varchar(30) not null default 'boshqa',
  matn        text not null,
  -- Ekran suratlari — Storage dagi havolalar
  rasmlar     jsonb not null default '[]'::jsonb,

  -- yangi | korildi | tuzatildi | rad_etildi
  status      varchar(20) not null default 'yangi',
  -- Blogerning javobi
  bloger_javobi text,
  -- Adminning qarori
  admin_izohi   text,

  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_shikoyat_blogger
  on public.shikoyatlar (blogger_id, created_at desc) where deleted_at is null;
create index if not exists idx_shikoyat_partner
  on public.shikoyatlar (partner_id, created_at desc) where deleted_at is null;
create index if not exists idx_shikoyat_status
  on public.shikoyatlar (status) where deleted_at is null;

create trigger trg_shikoyatlar_updated_at
  before update on public.shikoyatlar
  for each row execute function public.handle_updated_at();

-- Loyihadagi boshqa jadvallar bilan bir xil naqsh: faqat service_role.
-- Hamkor, bloger va admin edge funksiya orqali kiradi va har biri
-- FAQAT o'ziga tegishlisini ko'radi (tekshiruv funksiya ichida).
alter table public.shikoyatlar enable row level security;
revoke all on public.shikoyatlar from anon, authenticated;
