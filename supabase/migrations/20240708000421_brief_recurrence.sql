-- ============================================================================
-- TAKRORLANUVCHI TZ VA KECHIKTIRILGAN BOSHLANISH
-- ============================================================================
-- MAQSAD: hamkor "har kuni", "har hafta" yoki "har oy" bajariladigan TZ
-- bera olsin, va u BERILGAN PAYTDAN emas, ko'rsatilgan vaqtdan keyin
-- ishga tushsin (masalan 2 soatdan keyin).
--
-- NEGA KECHIKISH KERAK: TZ yuborilgan zahoti bloger uni bajarishga
-- kirishardi. Hamkor esa ko'pincha "ertalab soat 9 dan boshlansin" yoki
-- "men tayyorgarlik ko'raman, 2 soatdan keyin" deydi. Vaqt yo'q bo'lsa
-- buni faqat og'zaki kelishuv bilan hal qilish mumkin edi.
-- ============================================================================

alter table public.partner_briefs
  -- bir_marta | kunlik | haftalik | oylik
  add column if not exists takrorlanish varchar(20) not null default 'bir_marta',
  -- Ish QACHONDAN boshlanadi. Yaratilgan vaqt + hamkor tanlagan kechikish.
  add column if not exists boshlanish timestamptz,
  -- Takrorlanish qachon to'xtaydi (ixtiyoriy)
  add column if not exists tugash date,
  -- Keyingi takror QACHON yaratilishi kerak. Rejalashtiruvchi shunga qaraydi.
  add column if not exists keyingi timestamptz;

alter table public.partner_briefs
  add constraint chk_partner_briefs_takrorlanish
  check (takrorlanish in ('bir_marta', 'kunlik', 'haftalik', 'oylik'));

-- Rejalashtiruvchi faqat muddati kelganlarini oladi
create index if not exists idx_partner_briefs_keyingi
  on public.partner_briefs (keyingi)
  where keyingi is not null and deleted_at is null;

-- ============================================================================
-- TOPSHIRIQ -> TZ SO'ROVI BOG'LAMI
-- ============================================================================
-- MUAMMO: ilgari bog'lam faqat `partner_briefs.task_id` orqali edi va
-- unga YAGONA indeks qo'yilgan. Takrorlanuvchi TZ esa BIR NECHTA
-- topshiriq tug'diradi — ikkinchi takror o'z so'roviga ulana olmasdi va
-- bandlarsiz qolardi.
--
-- Endi bog'lam TESKARI yo'nalishda ham bor: har topshiriq o'z so'rovini
-- biladi. `partner_briefs.task_id` esa BIRINCHI topshiriqni ko'rsatib
-- qoladi (qayta yuborishdan himoya sifatida yagona bo'lib qoladi).
-- ============================================================================

alter table public.blogger_tasks
  add column if not exists brief_id uuid references public.partner_briefs(id) on delete set null,
  -- Bu takror QACHON kuchga kiradi. Shu vaqtgacha bloger uni
  -- bajarilgan deb belgilay olmaydi.
  add column if not exists boshlanish timestamptz,
  -- Nechanchi takror (1, 2, 3…) — hisobotda davrlarni ajratish uchun
  add column if not exists takror_raqami integer not null default 1;

create index if not exists idx_blogger_tasks_brief
  on public.blogger_tasks (brief_id) where deleted_at is null;

-- ============================================================================
-- BAND QAYSI TAKRORGA TEGISHLI
-- ============================================================================
-- MUAMMO: bandlar `partner_tasks` da so'rovga bog'langan edi. Kunlik TZ
-- da bloger 1-kuni bandni "bajarildi" qilsa, u 2-kuni ham bajarilgan
-- bo'lib turaverardi — hisobot har kuni bir xil ko'rinardi va
-- takrorlanishning ma'nosi qolmasdi.
--
-- Endi har takror O'Z bandlar nusxasiga ega bo'ladi.
-- `task_id` bo'sh bandlar — hali yuborilmagan so'rovning namunasi.
-- ============================================================================

alter table public.partner_tasks
  add column if not exists task_id uuid references public.blogger_tasks(id) on delete cascade;

create index if not exists idx_partner_tasks_task
  on public.partner_tasks (task_id) where deleted_at is null;
