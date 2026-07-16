-- ============================================================================
-- Instagram token'ni har hafta avtomatik yangilash
-- Facebook uzoq muddatli token 60 kun yashaydi; haftalik yangilash tokenni
-- doim 60 kunga uzaytiradi -> token hech qachon tugamaydi.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('agro-ig-token-refresh') where exists (select 1 from cron.job where jobname = 'agro-ig-token-refresh');

-- Har yakshanba 03:00 (UTC) da tokenni yangilash
select cron.schedule(
  'agro-ig-token-refresh',
  '0 3 * * 0',
  $$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/cron-instagram-token-refresh',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrZGdwcnhwcG10c2dyb2Z2a3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1Njk5NjQsImV4cCI6MjA5OTE0NTk2NH0.RaM3BmChOWLqsabe_mEP1e1ieDi-SdIrRk5Ssosf81M',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
