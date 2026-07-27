-- ============================================================================
-- CRON_SECRET ni migratsiya matnidan OLIB TASHLASH
--
-- MUAMMO: 20240708000290_cron_secret_headers.sql ichida maxfiy kalit ochiq
-- yozilgan edi. Repozitoriya ommaviy (github.com/uzgroww-oss/agro-alliance),
-- ya'ni kalit internetdan login'siz o'qilar edi. U bilan har kim ikkala
-- cron funksiyani ishga tushira olardi: blogerlarning oylik ko'rish
-- statistikasini buzish va YouTube/Instagram API kvotasini yondirish.
--
-- YECHIM: kalit endi migratsiyada YO'Q. Cron ishi uni Supabase Vault'dan
-- o'qiydi, ya'ni git tarixiga hech qachon tushmaydi.
--
-- ⚠️  BU MIGRATSIYADAN OLDIN kalit Vault'ga qo'yilishi SHART:
--
--     select vault.create_secret(
--       encode(gen_random_bytes(32), 'hex'),   -- yangi tasodifiy kalit
--       'cron_secret'
--     );
--
--     -- keyin uni edge funksiyalar uchun ham o'rnatish kerak:
--     select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret';
--     -- chiqqan qiymat bilan terminalda:
--     --   supabase secrets set CRON_SECRET=<qiymat>
--
-- Kalit Vault'da bo'lmasa cron ishi sarlavhasiz so'rov yuboradi va funksiya
-- 403 qaytaradi — ya'ni jimgina himoyasiz qolmaydi, shunchaki ishlamaydi.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

-- ---------------------------------------------------------------------------
-- Kalitni Vault'dan o'qiydigan yordamchi.
--
-- security definer — cron ishi kalitni o'qiy olishi uchun. Faqat postgres
-- chaqira oladi: pastda boshqa hamma rollardan huquq qaytarib olinadi.
-- ---------------------------------------------------------------------------
create or replace function public.cron_secret()
returns text
language sql
security definer
set search_path = vault, public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
$$;

revoke all on function public.cron_secret() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ikkala cron ishini kalitsiz matn bilan qayta rejalash.
-- Authorization'dagi anon kalit ATAYLAB ochiq: u frontend bundle'ida ham bor
-- va o'zi hech qanday huquq bermaydi — himoya x-cron-secret zimmasida.
-- ---------------------------------------------------------------------------

select cron.unschedule('agro-monthly-views')
where exists (select 1 from cron.job where jobname = 'agro-monthly-views');

select cron.schedule('agro-monthly-views', '0 2 1 * *', $job$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/cron-monthly-views',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrZGdwcnhwcG10c2dyb2Z2a3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1Njk5NjQsImV4cCI6MjA5OTE0NTk2NH0.RaM3BmChOWLqsabe_mEP1e1ieDi-SdIrRk5Ssosf81M',
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret()
    ),
    body := '{}'::jsonb
  );
$job$);

select cron.unschedule('agro-ig-token-refresh')
where exists (select 1 from cron.job where jobname = 'agro-ig-token-refresh');

select cron.schedule('agro-ig-token-refresh', '0 3 * * 0', $job$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/cron-instagram-token-refresh',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrZGdwcnhwcG10c2dyb2Z2a3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1Njk5NjQsImV4cCI6MjA5OTE0NTk2NH0.RaM3BmChOWLqsabe_mEP1e1ieDi-SdIrRk5Ssosf81M',
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret()
    ),
    body := '{}'::jsonb
  );
$job$);
