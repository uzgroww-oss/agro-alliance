-- ============================================================
-- AGRO ALLIANCE — Xavfsizlik tuzatishlari + AI yangilik cron
-- Supabase Dashboard → SQL Editor da bu faylni ishga tushiring
-- ============================================================

-- 1) KRITIK: delete_auth_user_by_email RPC ni himoyalash
--    (hozir istalgan login qilgan foydalanuvchi istalganini o'chira oladi!)
--    Faqat service_role (edge funksiyalar) chaqira olsin:
revoke execute on function public.delete_auth_user_by_email(text) from public;
revoke execute on function public.delete_auth_user_by_email(text) from anon;
revoke execute on function public.delete_auth_user_by_email(text) from authenticated;

-- 2) AI YANGILIK CRON: har kuni ertalab soat 6:00 da 5 ta agro yangilik
--    pg_cron + pg_net kengaytmalari kerak:
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Avvalgi jadval bo'lsa o'chirish (qayta ishga tushirish uchun xavfsiz)
select cron.unschedule('agro-news-daily') where exists (select 1 from cron.job where jobname = 'agro-news-daily');

-- Har kuni 06:00 (UTC) da AI yangilik dvigatelini chaqirish
select cron.schedule(
  'agro-news-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/worker-ai-news-engine',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrZGdwcnhwcG10c2dyb2Z2a3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1Njk5NjQsImV4cCI6MjA5OTE0NTk2NH0.RaM3BmChOWLqsabe_mEP1e1ieDi-SdIrRk5Ssosf81M',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ESLATMA: yuqoridagi 'Bearer ...' ni loyihangizning haqiqiy ANON KEY bilan almashtiring
-- (.env faylidagi VITE_SUPABASE_ANON_KEY qiymati).

-- 3) Jadvalni tekshirish:
select jobname, schedule, active from cron.job where jobname = 'agro-news-daily';
