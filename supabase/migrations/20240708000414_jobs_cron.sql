-- ============================================================================
-- FON ISHLARI UCHUN JADVAL (pg_cron)
-- ============================================================================
-- Ishlar `jobs` funksiyasiga birlashtirildi va `x-cron-secret` bilan
-- himoyalangan. Bu yerda ularning QAYSI BIRI va QANCHA VAQTDA
-- chaqirilishi belgilanadi.
--
-- HAMMASI EMAS — ATAYLAB. Yigirmata ishning hammasini jadvalga qo'yish
-- foyda bermaydi, ba'zilari esa zarar keltiradi:
--
--   AI zanjiri (ai-draft, ai-categorize, ai-seo, ai-summarize,
--   ai-translate, ai-validate) — Gemini kvotasi tugagan. Hozir
--   jadvalga qo'yilsa har chaqiruv bekorga yiqiladi, kvota tiklangach
--   esa hech kim so'ramagan holda AI ga pul sarflay boshlaydi.
--   Yangilik matnini AI yozishi — mahsulot qarori, texnik emas.
--
--   Ijtimoiy nashr (publish, facebook/instagram/telegram-publish,
--   social-publish-scheduler) — SMM paneli buni allaqachon qiladi va
--   ulanishlarni to'g'ri boshqaradi. Bu ishlar esa `FACEBOOK_PAGE_TOKEN`,
--   `INSTAGRAM_ACCESS_TOKEN` kabi sozlanmagan o'zgaruvchilarga tayanadi —
--   ya'ni har chaqiruvda yiqilardi.
--
--   media-upload — R2 saqlash uchun yozilgan, loyiha esa Supabase
--   saqlashidan foydalanadi.
--
-- Kalit Vault'da bo'lmasa cron so'rovi sarlavhasiz ketadi va funksiya
-- 401 qaytaradi — jimgina himoyasiz qolmaydi, shunchaki ishlamaydi.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- 1. Yangilik manbalarini navbatga qo'yish — har 30 daqiqada.
--    Har bir manbaning o'z `fetch_interval_minutes` qiymati bor, shuning
--    uchun bu chaqiruv faqat VAQTI KELGANLARINI oladi. Manzili xavfli
--    bo'lganlari (ichki tarmoq, file://) umuman o'tkazilmaydi.
-- ---------------------------------------------------------------------------
select cron.unschedule('agro-news-ingest')
where exists (select 1 from cron.job where jobname = 'agro-news-ingest');

select cron.schedule('agro-news-ingest', '*/30 * * * *', $job$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/jobs?job=news-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret()
    ),
    body := '{}'::jsonb
  );
$job$);

-- ---------------------------------------------------------------------------
-- 2. RSS navbatini qayta ishlash — har 10 daqiqada.
--    Bir chaqiruvda bitta ish oladi. Navbat bo'sh bo'lsa darhol
--    "idle" qaytaradi, ya'ni bo'sh turgan paytda arzon.
-- ---------------------------------------------------------------------------
select cron.unschedule('agro-rss-ingest')
where exists (select 1 from cron.job where jobname = 'agro-rss-ingest');

select cron.schedule('agro-rss-ingest', '*/10 * * * *', $job$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/jobs?job=rss-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret()
    ),
    body := '{}'::jsonb
  );
$job$);

-- ---------------------------------------------------------------------------
-- 3. Sayt sahifalarini yuklash navbati — har 15 daqiqada.
--    RSS bo'lmagan manbalar uchun (type = 'website').
-- ---------------------------------------------------------------------------
select cron.unschedule('agro-web-crawler')
where exists (select 1 from cron.job where jobname = 'agro-web-crawler');

select cron.schedule('agro-web-crawler', '*/15 * * * *', $job$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/jobs?job=web-crawler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret()
    ),
    body := '{}'::jsonb
  );
$job$);

-- ---------------------------------------------------------------------------
-- 4. O'chirilgan yozuvlarni tozalash — haftada bir marta, yakshanba 04:00.
--    Yumshoq o'chirilgan (deleted_at) yozuvlar vaqt o'tishi bilan
--    to'planib boradi. AI ga aloqasi yo'q, tashqi so'rov yubormaydi.
-- ---------------------------------------------------------------------------
select cron.unschedule('agro-cleanup-deleted')
where exists (select 1 from cron.job where jobname = 'agro-cleanup-deleted');

select cron.schedule('agro-cleanup-deleted', '0 4 * * 0', $job$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/jobs?job=cleanup-deleted',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret()
    ),
    body := '{}'::jsonb
  );
$job$);
