-- ============================================================================
-- YOUTUBE IZOHLARIGA AVTOMATIK JAVOB
-- ============================================================================
-- MUAMMO: kanalga kuniga o'nlab izoh tushadi. Ularning ko'pchiligi bir
-- xil ("zo'r video", "rahmat", "narxi qancha?"), lekin javobsiz qolsa
-- ikki narsa yo'qoladi:
--   - tomoshabin qaytmaydi: javob olmagan odam ikkinchi marta yozmaydi
--   - YouTube kanalni pastroq ko'rsatadi — izoh ostidagi faollik
--     tavsiya algoritmiga kiradi
-- Tahririyat esa har biriga qo'lda javob yozishga ulgurmaydi.
--
-- YECHIM: AI javob matnini tayyorlaydi, tahririyat esa yo tasdiqlaydi,
-- yo avtomatik rejimni yoqib qo'yadi va javoblar o'zi ketaveradi.
--
-- NEGA HAR BIR JAVOB SHU JADVALGA YOZILADI
--   1. TAKROR JAVOB BO'LMASIN. YouTube API "bu izohga javob berdikmi"
--      degan savolga arzon javob bermaydi — har safar butun ipni
--      o'qish kerak bo'lardi. Bu yerda `comment_id` YAGONA, ya'ni
--      ikkinchi javob fizik jihatdan yozilmaydi.
--   2. IZ QOLSIN. Avtomatik rejimda kanal nomidan matn chiqadi. Kim,
--      qachon, nima yozganini keyin ko'rib bo'lmasa — bu boshqarib
--      bo'lmaydigan tizim.
--   3. O'TKAZIB YUBORILGANLAR ham yoziladi (`otkazildi`): aks holda
--      har ishga tushganda AI o'sha spam izohni qayta-qayta ko'rib,
--      bekorga token sarflardi.
-- ============================================================================

create table if not exists public.yt_izoh_javob (
  id uuid primary key default gen_random_uuid(),

  -- YouTube ning yuqori darajadagi izoh identifikatori. YAGONA:
  -- takror javobga qarshi asosiy himoya shu yerda.
  comment_id  text not null,
  video_id    text not null,
  -- Sarlavha o'zgarishi mumkin, lekin ro'yxatda ko'rsatish uchun
  -- nusxa saqlaymiz: aks holda har qator uchun YouTube'ga so'rov
  -- yuborish kerak bo'lardi.
  video_title text,

  muallif     text,
  izoh        text not null,
  javob       text,

  -- qoralama | yuborildi | otkazildi | xato
  holat       varchar(20) not null default 'qoralama',
  -- Nega o'tkazib yuborildi yoki nega yiqildi
  sabab       text,

  -- Avtomatik rejim yozganmi yoki tahririyat qo'lda bosganmi
  avto        boolean not null default false,
  -- Qaysi provayder yozgan (AI hisobini solishtirish uchun)
  provayder   varchar(30),

  -- Izohning YouTube'dagi vaqti — tartiblash uchun (bizga kelgan
  -- vaqt emas: eski izoh keyinroq topilishi mumkin)
  izoh_vaqti  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  yuborilgan_at timestamptz
);

-- Takror javobga qarshi asosiy himoya
create unique index if not exists idx_yt_izoh_comment
  on public.yt_izoh_javob (comment_id);

create index if not exists idx_yt_izoh_video
  on public.yt_izoh_javob (video_id, created_at desc);
create index if not exists idx_yt_izoh_holat
  on public.yt_izoh_javob (holat, created_at desc);

create trigger trg_yt_izoh_javob_updated_at
  before update on public.yt_izoh_javob
  for each row execute function public.handle_updated_at();

-- Loyihadagi boshqa jadvallar bilan bir xil naqsh: faqat service_role.
-- Tahririyat edge funksiya orqali kiradi, ruxsat o'sha yerda
-- tekshiriladi.
alter table public.yt_izoh_javob enable row level security;
revoke all on public.yt_izoh_javob from anon, authenticated;

-- ============================================================================
-- SOZLAMALAR
-- ============================================================================
-- `public_settings` da turadi: alohida jadval yasashning ma'nosi yo'q,
-- bularning hammasi bitta qiymatli kalitlar. `is_public = false` —
-- saytga chiqmaydi, faqat panel o'qiydi.
--
-- ⚠️ `yt_izoh_avto` ODDIY HOLATDA O'CHIQ. Yoqilgan zahoti kanal
-- nomidan ommaviy javoblar ketadi, ya'ni buni faqat odam ataylab
-- yoqishi kerak.
-- ============================================================================

insert into public.public_settings (key, value, type, description, is_public) values
  ('yt_izoh_avto',     'false', 'boolean',
   'YouTube izohlariga avtomatik javob yozilsinmi (yoqilsa javoblar odam ko''rmasdan chiqadi)', false),
  ('yt_izoh_ohang',    '', 'text',
   'AI ga qo''shimcha ko''rsatma: qanday ohangda javob yozsin, nimalarni aytmasin', false),
  ('yt_izoh_til',      'auto', 'string',
   'Javob tili: auto (izoh tilida) | uz | ru | en', false),
  ('yt_izoh_limit',    '20', 'string',
   'Bitta avtomatik yurishda ko''pi bilan nechta javob yuborilsin', false),
  ('yt_izoh_uzunlik',  '200', 'string',
   'Javobning eng ko''p belgilar soni', false)
-- Yagona indeks QISMAN (`where deleted_at is null`), shuning uchun
-- `on conflict` da ham o'sha shart takrorlanishi shart — busiz
-- Postgres mos indeks topa olmay xato beradi.
on conflict (key) where deleted_at is null do nothing;
