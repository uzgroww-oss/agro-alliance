-- ============================================================================
-- Xavfsizlik tuzatishi + Oylik ko'rishlar cron
-- ============================================================================

-- 1) KRITIK: delete_auth_user_by_email RPC ni himoyalash
--    (aks holda istalgan login qilgan foydalanuvchi istalganini o'chira oladi)
revoke execute on function public.delete_auth_user_by_email(text) from public;
revoke execute on function public.delete_auth_user_by_email(text) from anon;
revoke execute on function public.delete_auth_user_by_email(text) from authenticated;

-- 2) pg_cron + pg_net
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Eskirgan AI yangilik cron'i bo'lsa — o'chirish (AI dvigateli olib tashlangan)
select cron.unschedule('agro-news-daily') where exists (select 1 from cron.job where jobname = 'agro-news-daily');

-- 3) OYLIK KO'RISHLAR: har oyning 1-sanasi 02:00 (UTC) da hisoblash
select cron.unschedule('agro-monthly-views') where exists (select 1 from cron.job where jobname = 'agro-monthly-views');
select cron.schedule(
  'agro-monthly-views',
  '0 2 1 * *',
  $$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/cron-monthly-views',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrZGdwcnhwcG10c2dyb2Z2a3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1Njk5NjQsImV4cCI6MjA5OTE0NTk2NH0.RaM3BmChOWLqsabe_mEP1e1ieDi-SdIrRk5Ssosf81M',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
