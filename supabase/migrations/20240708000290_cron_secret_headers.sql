-- ============================================================================
-- Cron funksiyalarga maxfiy kalit (X-Cron-Secret) qo'shish — auth'siz chaqirishni bloklash
-- ============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Oylik ko'rishlar cron'ini maxfiy kalit bilan qayta rejalash
select cron.unschedule('agro-monthly-views') where exists (select 1 from cron.job where jobname = 'agro-monthly-views');
select cron.schedule('agro-monthly-views', '0 2 1 * *', $$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/cron-monthly-views',
    headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrZGdwcnhwcG10c2dyb2Z2a3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1Njk5NjQsImV4cCI6MjA5OTE0NTk2NH0.RaM3BmChOWLqsabe_mEP1e1ieDi-SdIrRk5Ssosf81M','Content-Type','application/json','x-cron-secret','f2f776a58817dbc51cb810cb8a8064e5bb6efeb996e20ba0a7ca2df93d165277'),
    body := '{}'::jsonb
  );
$$);

-- Instagram token yangilash cron'ini maxfiy kalit bilan qayta rejalash
select cron.unschedule('agro-ig-token-refresh') where exists (select 1 from cron.job where jobname = 'agro-ig-token-refresh');
select cron.schedule('agro-ig-token-refresh', '0 3 * * 0', $$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/cron-instagram-token-refresh',
    headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrZGdwcnhwcG10c2dyb2Z2a3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1Njk5NjQsImV4cCI6MjA5OTE0NTk2NH0.RaM3BmChOWLqsabe_mEP1e1ieDi-SdIrRk5Ssosf81M','Content-Type','application/json','x-cron-secret','f2f776a58817dbc51cb810cb8a8064e5bb6efeb996e20ba0a7ca2df93d165277'),
    body := '{}'::jsonb
  );
$$);
