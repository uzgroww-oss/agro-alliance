-- ============================================================================
-- IZOHLARGA JAVOB — FAQAT YOUTUBE EMAS
-- ============================================================================
-- Birinchi versiya faqat YouTube uchun edi. Lekin izoh Instagram'da ham,
-- Facebook sahifasida ham, Telegram muhokama guruhida ham tushadi va
-- ularning hammasi javobsiz qolsa muammo o'sha-o'sha.
--
-- AI qismi platformaga BOG'LIQ EMAS edi — javob matnini yozish hamma
-- joyda bir xil. Platformaga bog'liq narsa faqat ikkitasi: izohlarni
-- qanday o'qish va javobni qanday yuborish. Shuning uchun jadval
-- umumiylashtiriladi, har tarmoq uchun alohida jadval yasalmaydi.
--
-- Jadval nomi ham o'zgaradi: `yt_izoh_javob` endi yolg'on nom bo'lardi.
-- Ma'lumot yo'qolmaydi — `alter table ... rename` qatorlarni saqlaydi.
-- ============================================================================

alter table if exists public.yt_izoh_javob rename to izoh_javob;

alter table public.izoh_javob
  add column if not exists platform varchar(20) not null default 'youtube';

-- Eski qatorlar YouTube'niki — `default` ularni allaqachon shunday
-- belgiladi, lekin aniq bo'lsin
update public.izoh_javob set platform = 'youtube' where platform is null or platform = '';

/*
  YAGONALIK ENDI JUFTLIK BO'YICHA.

  Izoh identifikatorlari har tarmoqda o'z formatida va nazariy jihatdan
  to'qnashishi mumkin (Telegram'da u oddiy son). Faqat `comment_id`
  bo'yicha yagonalik qoldirilsa, Telegram'dagi 12345-xabar YouTube'dagi
  boshqa izohni "allaqachon javob berilgan" deb ko'rsatishi mumkin edi.
*/
drop index if exists idx_yt_izoh_comment;
create unique index if not exists idx_izoh_platform_comment
  on public.izoh_javob (platform, comment_id);

drop index if exists idx_yt_izoh_video;
drop index if exists idx_yt_izoh_holat;
create index if not exists idx_izoh_post
  on public.izoh_javob (platform, video_id, created_at desc);
create index if not exists idx_izoh_holat
  on public.izoh_javob (holat, created_at desc);

alter trigger trg_yt_izoh_javob_updated_at on public.izoh_javob
  rename to trg_izoh_javob_updated_at;

-- ============================================================================
-- SOZLAMALAR
-- ============================================================================
-- Ohang, til va uzunlik — UMUMIY: kanal bitta, ovozi ham bitta bo'lishi
-- kerak. Instagram'da boshqacha, YouTube'da boshqacha gapiradigan brend
-- g'alati ko'rinadi.
--
-- Avtomatik rejim esa HAR TARMOQ UCHUN ALOHIDA. Sabab amaliy: YouTube'da
-- javoblar ishonchli chiqayotgan bo'lishi mumkin, Instagram'da esa
-- auditoriya boshqacha va avval qo'lda ko'rib chiqish kerak bo'ladi.
-- Bitta umumiy kalit bo'lsa, tahririyat "hammasini yoqaman yoki
-- hech qaysisini" degan tanlovga qolardi.
-- ============================================================================

-- Umumiy kalitlar: eski `yt_` prefiksi endi noto'g'ri
update public.public_settings set key = 'izoh_ohang'   where key = 'yt_izoh_ohang';
update public.public_settings set key = 'izoh_til'     where key = 'yt_izoh_til';
update public.public_settings set key = 'izoh_limit'   where key = 'yt_izoh_limit';
update public.public_settings set key = 'izoh_uzunlik' where key = 'yt_izoh_uzunlik';

-- YouTube uchun tanlangan qiymat SAQLANADI: nomi o'zgargani uchun
-- yoqilgan rejim jimgina o'chib qolmasligi kerak
update public.public_settings set key = 'izoh_avto_youtube' where key = 'yt_izoh_avto';

insert into public.public_settings (key, value, type, description, is_public) values
  ('izoh_avto_youtube',   'false', 'boolean', 'YouTube izohlariga avtomatik javob', false),
  ('izoh_avto_instagram', 'false', 'boolean', 'Instagram izohlariga avtomatik javob', false),
  ('izoh_avto_facebook',  'false', 'boolean', 'Facebook sahifa izohlariga avtomatik javob', false),
  ('izoh_avto_telegram',  'false', 'boolean', 'Telegram muhokama guruhidagi izohlarga avtomatik javob', false),
  ('izoh_ohang',   '',      'text',   'AI ga qo''shimcha ko''rsatma: ohang va taqiqlar', false),
  ('izoh_til',     'auto',  'string', 'Javob tili: auto | uz | ru | en', false),
  ('izoh_limit',   '20',    'string', 'Bitta avtomatik yurishda har tarmoqda ko''pi bilan nechta javob', false),
  ('izoh_uzunlik', '200',   'string', 'Javobning eng ko''p belgilar soni', false)
on conflict (key) where deleted_at is null do nothing;
