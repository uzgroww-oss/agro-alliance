-- ============================================================================
-- TAYYOR JAVOBLAR (SHABLONLAR)
-- ============================================================================
-- MUAMMO: izohlarning katta qismi bir xil savol — "narxi qancha",
-- "qayerdasiz", "hamkorlik qilasizmi", "yetkazib berasizmi". Ularning
-- har biriga AI dan javob so'rash uch tomondan noto'g'ri:
--
--   1. JAVOB HAR SAFAR BOSHQACHA CHIQADI. Bir xil savolga bir kuni
--      "Albatta, bog'laning" desa, ertasiga boshqacha yozadi. Kanal
--      nomidan chiqadigan matn uchun bu yomon: tomoshabin izchillikni
--      sezadi, tahririyat esa nima chiqishini oldindan bilmaydi.
--   2. AI BU SAVOLLARGA JAVOB BERA OLMAYDI. Narx, manzil, yetkazib
--      berish — prompt ularni ataylab taqiqlaydi (bilmaydi va noto'g'ri
--      aytsa kanal javob beradi), ya'ni AI baribir SKIP qaytaradi va
--      izoh javobsiz qoladi.
--   3. KVOTA. Har savol Gemini so'rovi, zaxira provayder esa yo'q.
--
-- YECHIM: tahririyat javobni BIR MARTA o'zi yozadi. Izohda o'sha savol
-- uchrasa — aynan o'sha matn ketadi. AI umuman chaqirilmaydi: javob
-- bir zumda, tekin va har safar bir xil.
--
-- IKKITA MAYDON, boshqa hech narsa:
--   savol — izohda nima yozilsa
--   javob — nima javob berish
--
-- PLATFORM: `null` — hamma tarmoqda ishlaydi (ko'p savol tarmoqqa
-- bog'liq emas). Aniq tarmoq yozilsa faqat o'sha yerda ishlaydi va
-- umumiy shablondan USTUN turadi — ohang tarmoqqa qarab farq qilishi
-- mumkin (Telegram'da erkinroq, YouTube'da rasmiyroq).
-- ============================================================================

create table if not exists public.izoh_shablon (
  id uuid primary key default gen_random_uuid(),

  -- Izohda qidiriladigan matn. Aynan tenglik SHART EMAS: moslashtirish
  -- so'z bo'yicha ishlaydi ("narx qancha" -> "Salom, narxi qancha
  -- turadi?"). Mantiq: _shared/izohShablonMatn.ts
  savol text not null,
  -- Kanal nomidan ketadigan matn. AI unga TEGMAYDI — nima yozilsa
  -- o'sha ketadi.
  javob text not null,

  -- null = hamma tarmoq. Aks holda: youtube | instagram | facebook | telegram
  platform varchar(20),

  -- O'chirmasdan vaqtincha to'xtatish uchun
  faol boolean not null default true,

  -- Qaysi shablon haqiqatan ishlayotganini ko'rish uchun. Foydasizini
  -- topib tashlash yoki savol matnini aniqlashtirish shu raqamga qarab
  -- qilinadi.
  ishlatilgan integer not null default 0,
  oxirgi_ishlatilgan timestamptz,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Har izoh uchun mos shablon qidiriladi, ya'ni bu so'rov TEZ-TEZ
-- ketadi. Faqat tirik va faol qatorlar kerak.
create index if not exists izoh_shablon_faol_idx
  on public.izoh_shablon (platform, faol)
  where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Faqat edge funksiyalar (service role) o'qiydi va yozadi.
-- Brauzer bu jadvalga to'g'ridan-to'g'ri tegmaydi: hamma amal
-- `izohlar` funksiyasi orqali, u yerda rol tekshiruvi bor.
-- ----------------------------------------------------------------------------
alter table public.izoh_shablon enable row level security;
revoke all on public.izoh_shablon from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Ishlatilganini sanash.
--
-- ATOMIK bo'lishi kerak: to'rt tarmoq PARALLEL yuradi va bir vaqtda
-- bir xil shablonni ishlatishi mumkin. Avval o'qib, keyin yozadigan
-- kod bunday paytda hisobni yo'qotardi.
--
-- security definer — jadval `authenticated` dan yopiq, funksiya esa
-- faqat bitta sonni oshiradi. Huquq faqat service_role da: uni
-- brauzerdan chaqirib hisobni shishirib bo'lmasin.
-- ----------------------------------------------------------------------------
create or replace function public.izoh_shablon_ishlatildi(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.izoh_shablon
     set ishlatilgan = ishlatilgan + 1,
         oxirgi_ishlatilgan = now()
   where id = p_id and deleted_at is null;
$$;

revoke execute on function public.izoh_shablon_ishlatildi(uuid) from public, anon, authenticated;
grant execute on function public.izoh_shablon_ishlatildi(uuid) to service_role;
