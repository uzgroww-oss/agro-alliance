-- ============================================================================
-- XAVFSIZLIK QATTIQLASHTIRUVI
-- 1) Ichki jadvallarni anon/authenticated'dan to'liq yopish (faqat service_role)
-- 2) notifications teshigini yopish
-- 3) profiles.status / deleted_at ni oddiy foydalanuvchi o'zgartira olmasligi
-- 4) rate-limit funksiyasini anon'dan olish
-- Eslatma: frontend faqat "profiles" (o'zinikini) va auth_role() ni to'g'ridan-to'g'ri
-- ishlatadi; qolgan hamma narsa edge function (service_role) orqali ishlaydi.
-- ============================================================================

-- 1) Ichki jadvallar: RLS yoqish + anon/authenticated'dan barcha huquqni olish
do $$
declare t text;
begin
  foreach t in array array[
    'social_posts','social_jobs','failed_social_jobs','publish_history','publish_analytics',
    'ai_metrics','ai_dead_letter_jobs','ai_rate_limits','ai_costs','ai_job_logs',
    'ai_providers','ai_models','ai_prompt_templates',
    'social_statistics','social_statistics_history','social_accounts','social_account_tokens',
    'social_sync_jobs','social_sync_logs','social_platforms',
    'blogger_tasks','blogger_task_assignments','youtube_view_snapshots',
    'news_jobs','news_sources','news_ingestion_logs',
    'notifications','instagram_tokens','team_members','contact_messages','newsletter_subscribers',
    'partner_tasks','media_files','media_folders','media_jobs'
  ] loop
    if exists (select 1 from pg_tables where schemaname='public' and tablename=t) then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- 2) notifications: xavfli "hammaga ruxsat" policy'larini o'chirish
drop policy if exists "Service role can manage notifications" on public.notifications;
drop policy if exists "Service role can insert notifications" on public.notifications;

-- 3) profiles: status / deleted_at / created_by ni faqat service_role (admin edge fn) o'zgartira oladi
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
declare
  req_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
begin
  -- Oddiy foydalanuvchi (authenticated/anon) so'rovlari uchun himoyalangan maydonlarni bloklash.
  -- service_role (edge funksiyalar) va to'g'ridan-to'g'ri SQL (migratsiya) — ruxsat.
  if req_role in ('authenticated', 'anon') then
    if new.status is distinct from old.status
       or new.deleted_at is distinct from old.deleted_at
       or new.created_by is distinct from old.created_by then
      raise exception 'Himoyalangan maydonlarni o''zgartirishga ruxsat yo''q';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_columns on public.profiles;
create trigger trg_protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- 4) increment_rate_limit: anon/authenticated EXECUTE ni olib tashlash
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig from pg_proc
    where proname = 'increment_rate_limit' and pronamespace = 'public'::regnamespace
  loop
    execute format('revoke execute on function %s from anon, authenticated', r.sig);
  end loop;
end $$;
