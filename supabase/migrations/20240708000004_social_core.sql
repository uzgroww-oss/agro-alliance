-- ============================================================================
-- Social Integration Core
-- Tables: social_platforms, social_accounts, social_account_tokens,
--         social_statistics, social_statistics_history,
--         social_sync_jobs, social_sync_logs
--
-- Phase 1.5 — Social synchronization foundation
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Social Platforms (master list)
-- --------------------------------------------------------------------------

create table if not exists public.social_platforms (
  id         uuid         primary key default gen_random_uuid(),
  key        varchar(50)  not null,
  name       varchar(100) not null,
  icon       varchar(50),
  color      varchar(20),
  base_url   varchar(255),
  is_active  boolean      not null default true,
  sort_order integer      not null default 0,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  deleted_at timestamptz,
  created_by uuid         references public.profiles(id) on delete set null,
  updated_by uuid         references public.profiles(id) on delete set null,
  deleted_by uuid         references public.profiles(id) on delete set null
);

create unique index idx_social_platforms_key on public.social_platforms (key);

create index idx_social_platforms_is_active on public.social_platforms (is_active) where is_active = true;
create index idx_social_platforms_sort_order on public.social_platforms (sort_order);
create index idx_social_platforms_deleted_at on public.social_platforms (deleted_at);

create trigger trg_social_platforms_updated_at
  before update on public.social_platforms
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 2. Social Accounts (one blogger, many platforms)
-- --------------------------------------------------------------------------

create table if not exists public.social_accounts (
  id             uuid         primary key default gen_random_uuid(),
  blogger_id     uuid         not null references public.bloggers(id) on delete cascade,
  platform_id    uuid         not null references public.social_platforms(id) on delete restrict,
  account_name   varchar(255) not null,
  account_id     varchar(255),
  avatar_url     varchar(500),
  profile_url    varchar(500),
  is_verified    boolean      not null default false,
  is_active      boolean      not null default true,
  connected_at   timestamptz,
  last_synced_at timestamptz,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now(),
  deleted_at     timestamptz,
  created_by     uuid         references public.profiles(id) on delete set null,
  updated_by     uuid         references public.profiles(id) on delete set null,
  deleted_by     uuid         references public.profiles(id) on delete set null
);

create unique index idx_social_accounts_blogger_platform
  on public.social_accounts (blogger_id, platform_id) where deleted_at is null;

create index idx_social_accounts_blogger_id on public.social_accounts (blogger_id);
create index idx_social_accounts_platform_id on public.social_accounts (platform_id);
create index idx_social_accounts_is_active on public.social_accounts (is_active) where is_active = true;
create index idx_social_accounts_last_synced on public.social_accounts (last_synced_at) where last_synced_at is not null;
create index idx_social_accounts_deleted_at on public.social_accounts (deleted_at);

create trigger trg_social_accounts_updated_at
  before update on public.social_accounts
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 3. Social Account Tokens (encrypted OAuth credentials)
-- --------------------------------------------------------------------------

create table if not exists public.social_account_tokens (
  id            uuid         primary key default gen_random_uuid(),
  account_id    uuid         not null references public.social_accounts(id) on delete cascade,
  access_token  text         not null,
  refresh_token text,
  token_type    varchar(50)  not null default 'Bearer',
  expires_at    timestamptz,
  scopes        varchar(500),
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  deleted_at    timestamptz,
  created_by    uuid         references public.profiles(id) on delete set null,
  updated_by    uuid         references public.profiles(id) on delete set null,
  deleted_by    uuid         references public.profiles(id) on delete set null
);

create unique index idx_social_account_tokens_account
  on public.social_account_tokens (account_id) where deleted_at is null;

create index idx_social_account_tokens_expires on public.social_account_tokens (expires_at) where expires_at is not null;
create index idx_social_account_tokens_deleted_at on public.social_account_tokens (deleted_at);

create trigger trg_social_account_tokens_updated_at
  before update on public.social_account_tokens
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 4. Social Statistics (latest snapshot per account)
-- --------------------------------------------------------------------------

create table if not exists public.social_statistics (
  id                uuid          primary key default gen_random_uuid(),
  account_id        uuid          not null references public.social_accounts(id) on delete cascade,
  subscribers_count bigint        not null default 0,
  views_count       bigint        not null default 0,
  likes_count       bigint        not null default 0,
  comments_count    bigint        not null default 0,
  shares_count      bigint        not null default 0,
  engagement_rate   decimal(5,2),
  videos_count      integer       not null default 0,
  snapshot_date     date          not null default current_date,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  deleted_at        timestamptz,
  created_by        uuid          references public.profiles(id) on delete set null,
  updated_by        uuid          references public.profiles(id) on delete set null,
  deleted_by        uuid          references public.profiles(id) on delete set null
);

create unique index idx_social_statistics_account_date
  on public.social_statistics (account_id, snapshot_date) where deleted_at is null;

create index idx_social_statistics_account_id on public.social_statistics (account_id);
create index idx_social_statistics_snapshot on public.social_statistics (snapshot_date desc);
create index idx_social_statistics_subscribers on public.social_statistics (subscribers_count desc);
create index idx_social_statistics_deleted_at on public.social_statistics (deleted_at);

alter table public.social_statistics add constraint chk_social_statistics_subscribers
  check (subscribers_count >= 0);
alter table public.social_statistics add constraint chk_social_statistics_views
  check (views_count >= 0);
alter table public.social_statistics add constraint chk_social_statistics_likes
  check (likes_count >= 0);
alter table public.social_statistics add constraint chk_social_statistics_comments
  check (comments_count >= 0);
alter table public.social_statistics add constraint chk_social_statistics_shares
  check (shares_count >= 0);
alter table public.social_statistics add constraint chk_social_statistics_engagement
  check (engagement_rate >= 0);
alter table public.social_statistics add constraint chk_social_statistics_videos
  check (videos_count >= 0);

create trigger trg_social_statistics_updated_at
  before update on public.social_statistics
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 5. Social Statistics History (time-series for charts)
-- --------------------------------------------------------------------------

create table if not exists public.social_statistics_history (
  id                uuid          primary key default gen_random_uuid(),
  account_id        uuid          not null references public.social_accounts(id) on delete cascade,
  subscribers_count bigint        not null default 0,
  views_count       bigint        not null default 0,
  likes_count       bigint        not null default 0,
  comments_count    bigint        not null default 0,
  shares_count      bigint        not null default 0,
  engagement_rate   decimal(5,2),
  videos_count      integer       not null default 0,
  snapshot_date     date          not null,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  deleted_at        timestamptz,
  created_by        uuid          references public.profiles(id) on delete set null,
  updated_by        uuid          references public.profiles(id) on delete set null,
  deleted_by        uuid          references public.profiles(id) on delete set null
);

create index idx_social_stats_history_account on public.social_statistics_history (account_id, snapshot_date desc);
create index idx_social_stats_history_account_id on public.social_statistics_history (account_id);
create index idx_social_stats_history_snapshot on public.social_statistics_history (snapshot_date desc);
create index idx_social_stats_history_deleted_at on public.social_statistics_history (deleted_at);

alter table public.social_statistics_history add constraint chk_stats_history_subscribers
  check (subscribers_count >= 0);
alter table public.social_statistics_history add constraint chk_stats_history_views
  check (views_count >= 0);
alter table public.social_statistics_history add constraint chk_stats_history_likes
  check (likes_count >= 0);
alter table public.social_statistics_history add constraint chk_stats_history_comments
  check (comments_count >= 0);
alter table public.social_statistics_history add constraint chk_stats_history_shares
  check (shares_count >= 0);
alter table public.social_statistics_history add constraint chk_stats_history_engagement
  check (engagement_rate >= 0);
alter table public.social_statistics_history add constraint chk_stats_history_videos
  check (videos_count >= 0);

create trigger trg_social_statistics_history_updated_at
  before update on public.social_statistics_history
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 6. Social Sync Jobs (scheduled synchronizations)
-- --------------------------------------------------------------------------

create table if not exists public.social_sync_jobs (
  id             uuid         primary key default gen_random_uuid(),
  account_id     uuid         not null references public.social_accounts(id) on delete cascade,
  status         varchar(50)  not null default 'pending',
  job_type       varchar(50)  not null default 'full',
  scheduled_at   timestamptz,
  started_at     timestamptz,
  completed_at   timestamptz,
  error_message  text,
  retry_count    integer      not null default 0,
  max_retries    integer      not null default 3,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now(),
  deleted_at     timestamptz,
  created_by     uuid         references public.profiles(id) on delete set null,
  updated_by     uuid         references public.profiles(id) on delete set null,
  deleted_by     uuid         references public.profiles(id) on delete set null
);

create index idx_social_sync_jobs_account on public.social_sync_jobs (account_id, status);
create index idx_social_sync_jobs_status on public.social_sync_jobs (status) where status = 'pending';
create index idx_social_sync_jobs_scheduled on public.social_sync_jobs (scheduled_at) where scheduled_at is not null;
create index idx_social_sync_jobs_deleted_at on public.social_sync_jobs (deleted_at);

alter table public.social_sync_jobs add constraint chk_sync_jobs_status
  check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled'));
alter table public.social_sync_jobs add constraint chk_sync_jobs_type
  check (job_type in ('full', 'incremental'));
alter table public.social_sync_jobs add constraint chk_sync_jobs_retry_count
  check (retry_count >= 0);
alter table public.social_sync_jobs add constraint chk_sync_jobs_max_retries
  check (max_retries >= 1);

create trigger trg_social_sync_jobs_updated_at
  before update on public.social_sync_jobs
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 7. Social Sync Logs (execution history)
-- --------------------------------------------------------------------------

create table if not exists public.social_sync_logs (
  id         uuid         primary key default gen_random_uuid(),
  job_id     uuid         not null references public.social_sync_jobs(id) on delete cascade,
  event_type varchar(50)  not null,
  message    text,
  metadata   jsonb,
  logged_at  timestamptz  not null default now(),
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  deleted_at timestamptz,
  created_by uuid         references public.profiles(id) on delete set null,
  updated_by uuid         references public.profiles(id) on delete set null,
  deleted_by uuid         references public.profiles(id) on delete set null
);

create index idx_social_sync_logs_job on public.social_sync_logs (job_id, logged_at desc);
create index idx_social_sync_logs_event on public.social_sync_logs (event_type);
create index idx_social_sync_logs_logged on public.social_sync_logs (logged_at desc);
create index idx_social_sync_logs_deleted_at on public.social_sync_logs (deleted_at);

alter table public.social_sync_logs add constraint chk_sync_logs_event
  check (event_type in ('started', 'progress', 'completed', 'failed', 'retry', 'cancelled'));

create trigger trg_social_sync_logs_updated_at
  before update on public.social_sync_logs
  for each row
  execute function public.handle_updated_at();

-- ============================================================================
-- 8. Row-Level Security (RLS)
-- ============================================================================

-- 8.1 Social Platforms
alter table public.social_platforms enable row level security;

create policy "Public can read active platforms"
  on public.social_platforms for select
  using (is_active = true and deleted_at is null);

create policy "Editor can manage platforms"
  on public.social_platforms for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update platforms"
  on public.social_platforms for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete platforms"
  on public.social_platforms for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 8.2 Social Accounts
alter table public.social_accounts enable row level security;

create policy "Public can read social accounts of active bloggers"
  on public.social_accounts for select
  using (
    is_active = true
    and deleted_at is null
    and blogger_id in (
      select b.id from public.bloggers b
      join public.profiles p on p.id = b.id
      where b.is_verified = true and p.status = 'active' and b.deleted_at is null
    )
  );

create policy "Blogger can read own accounts"
  on public.social_accounts for select
  using (blogger_id = auth.uid());

create policy "Blogger can create own accounts"
  on public.social_accounts for insert
  with check (blogger_id = auth.uid());

create policy "Blogger can update own accounts"
  on public.social_accounts for update
  using (blogger_id = auth.uid());

create policy "Blogger can delete own accounts"
  on public.social_accounts for delete
  using (blogger_id = auth.uid());

create policy "Editor can read all accounts"
  on public.social_accounts for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can create accounts"
  on public.social_accounts for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update accounts"
  on public.social_accounts for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete accounts"
  on public.social_accounts for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 8.3 Social Account Tokens (most restricted — no public access)
alter table public.social_account_tokens enable row level security;

create policy "Blogger can read own tokens"
  on public.social_account_tokens for select
  using (
    account_id in (
      select sa.id from public.social_accounts sa
      where sa.blogger_id = auth.uid() and sa.deleted_at is null
    )
  );

create policy "Blogger can update own tokens"
  on public.social_account_tokens for update
  using (
    account_id in (
      select sa.id from public.social_accounts sa
      where sa.blogger_id = auth.uid() and sa.deleted_at is null
    )
  );

create policy "Super admin can manage tokens"
  on public.social_account_tokens for all
  using (auth_role() = 'super_admin');

-- 8.4 Social Statistics
alter table public.social_statistics enable row level security;

create policy "Public can read statistics"
  on public.social_statistics for select
  using (deleted_at is null);

create policy "Blogger can read own statistics"
  on public.social_statistics for select
  using (
    account_id in (
      select sa.id from public.social_accounts sa
      where sa.blogger_id = auth.uid() and sa.deleted_at is null
    )
  );

create policy "Editor can read all statistics"
  on public.social_statistics for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can manage statistics"
  on public.social_statistics for insert
  with check (auth_role() in ('super_admin', 'admin'));

create policy "Admin can update statistics"
  on public.social_statistics for update
  using (auth_role() in ('super_admin', 'admin'));

create policy "Admin can soft-delete statistics"
  on public.social_statistics for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 8.5 Social Statistics History
alter table public.social_statistics_history enable row level security;

create policy "Public can read statistics history"
  on public.social_statistics_history for select
  using (deleted_at is null);

create policy "Blogger can read own statistics history"
  on public.social_statistics_history for select
  using (
    account_id in (
      select sa.id from public.social_accounts sa
      where sa.blogger_id = auth.uid() and sa.deleted_at is null
    )
  );

create policy "Editor can read all statistics history"
  on public.social_statistics_history for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can manage statistics history"
  on public.social_statistics_history for insert
  with check (auth_role() in ('super_admin', 'admin'));

create policy "Admin can update statistics history"
  on public.social_statistics_history for update
  using (auth_role() in ('super_admin', 'admin'));

create policy "Admin can soft-delete statistics history"
  on public.social_statistics_history for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 8.6 Social Sync Jobs
alter table public.social_sync_jobs enable row level security;

create policy "Blogger can read own sync jobs"
  on public.social_sync_jobs for select
  using (
    account_id in (
      select sa.id from public.social_accounts sa
      where sa.blogger_id = auth.uid() and sa.deleted_at is null
    )
  );

create policy "Editor can read all sync jobs"
  on public.social_sync_jobs for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can manage sync jobs"
  on public.social_sync_jobs for insert
  with check (auth_role() in ('super_admin', 'admin'));

create policy "Admin can update sync jobs"
  on public.social_sync_jobs for update
  using (auth_role() in ('super_admin', 'admin'));

create policy "Admin can soft-delete sync jobs"
  on public.social_sync_jobs for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 8.7 Social Sync Logs
alter table public.social_sync_logs enable row level security;

create policy "Blogger can read own sync logs"
  on public.social_sync_logs for select
  using (
    job_id in (
      select sj.id from public.social_sync_jobs sj
      join public.social_accounts sa on sa.id = sj.account_id
      where sa.blogger_id = auth.uid() and sj.deleted_at is null
    )
  );

create policy "Editor can read all sync logs"
  on public.social_sync_logs for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can manage sync logs"
  on public.social_sync_logs for insert
  with check (auth_role() in ('super_admin', 'admin'));

create policy "Admin can update sync logs"
  on public.social_sync_logs for update
  using (auth_role() in ('super_admin', 'admin'));

create policy "Admin can soft-delete sync logs"
  on public.social_sync_logs for delete
  using (auth_role() in ('super_admin', 'admin'));

-- ============================================================================
-- 9. Views
-- ============================================================================

-- 9.1 Blogger Social Summary — aggregated social presence per blogger
create or replace view public.blogger_social_summary as
select
  b.id as blogger_id,
  p.name as blogger_name,
  b.slug as blogger_slug,
  b.rating,
  count(sa.id) filter (where sa.deleted_at is null and sa.is_active = true) as active_platforms,
  coalesce(sum(ss.subscribers_count) filter (where ss.deleted_at is null), 0) as total_subscribers,
  coalesce(sum(ss.views_count) filter (where ss.deleted_at is null), 0) as total_views,
  coalesce(avg(ss.engagement_rate) filter (where ss.deleted_at is null), 0) as avg_engagement_rate,
  coalesce(sum(ss.videos_count) filter (where ss.deleted_at is null), 0) as total_videos
from public.bloggers b
join public.profiles p on p.id = b.id
left join public.social_accounts sa on sa.blogger_id = b.id and sa.deleted_at is null
left join public.social_statistics ss on ss.account_id = sa.id and ss.deleted_at is null
  and ss.snapshot_date = (select max(ss2.snapshot_date) from public.social_statistics ss2 where ss2.account_id = sa.id and ss2.deleted_at is null)
where b.deleted_at is null
  and p.status = 'active'
  and p.deleted_at is null
group by b.id, p.id, b.slug, p.name, b.rating
order by total_subscribers desc;

-- 9.2 Top Social Bloggers — ranked by aggregated reach
create or replace view public.top_social_bloggers as
select
  b.id as blogger_id,
  p.name as blogger_name,
  b.slug as blogger_slug,
  b.rating,
  b.is_verified,
  coalesce(sum(ss.subscribers_count) filter (where ss.deleted_at is null), 0) as total_subscribers,
  coalesce(sum(ss.views_count) filter (where ss.deleted_at is null), 0) as total_views,
  coalesce(avg(ss.engagement_rate) filter (where ss.deleted_at is null), 0) as avg_engagement_rate,
  count(sa.id) filter (where sa.deleted_at is null and sa.is_active = true) as active_platforms
from public.bloggers b
join public.profiles p on p.id = b.id
left join public.social_accounts sa on sa.blogger_id = b.id and sa.deleted_at is null
left join public.social_statistics ss on ss.account_id = sa.id and ss.deleted_at is null
  and ss.snapshot_date = (select max(ss2.snapshot_date) from public.social_statistics ss2 where ss2.account_id = sa.id and ss2.deleted_at is null)
where b.deleted_at is null
  and p.status = 'active'
  and p.deleted_at is null
group by b.id, p.id, b.slug, p.name, b.rating, b.is_verified
order by total_subscribers desc
limit 50;

-- 9.3 Social Statistics Summary — platform-wide aggregate
create or replace view public.social_statistics_summary as
select
  count(distinct sa.blogger_id) as total_bloggers_with_accounts,
  count(distinct sa.id) filter (where sa.deleted_at is null and sa.is_active = true) as total_active_accounts,
  coalesce(sum(ss.subscribers_count) filter (where ss.deleted_at is null), 0) as total_subscribers,
  coalesce(sum(ss.views_count) filter (where ss.deleted_at is null), 0) as total_views,
  coalesce(avg(ss.engagement_rate) filter (where ss.deleted_at is null), 0) as avg_engagement_rate,
  coalesce(sum(ss.videos_count) filter (where ss.deleted_at is null), 0) as total_videos
from public.social_accounts sa
left join public.social_statistics ss on ss.account_id = sa.id and ss.deleted_at is null
  and ss.snapshot_date = (select max(ss2.snapshot_date) from public.social_statistics ss2 where ss2.account_id = sa.id and ss2.deleted_at is null)
where sa.deleted_at is null;

-- ============================================================================
-- 10. Seed Data
-- ============================================================================

-- 10.1 Default Social Platforms
-- Matches the platform icon map in src/lib/ui.tsx and src/pages/dashboard/BloggerDashboard.tsx
insert into public.social_platforms (key, name, icon, color, base_url, is_active, sort_order)
values
  ('youtube',   'YouTube',   'youtube',   '#FF0000',   'https://youtube.com/@',     true, 1),
  ('instagram', 'Instagram', 'instagram', '#E1306C',   'https://instagram.com/',    true, 2),
  ('telegram',  'Telegram',  'telegram',  '#229ED9',   'https://t.me/',             true, 3),
  ('tiktok',    'TikTok',    'tiktok',    '#000000',   'https://tiktok.com/@',      true, 4),
  ('facebook',  'Facebook',  'facebook',  '#1877F2',   'https://facebook.com/',     true, 5),
  ('x',         'X',         'x',         '#000000',   'https://x.com/',            true, 6),
  ('linkedin',  'LinkedIn',  'linkedin',  '#0A66C2',   'https://linkedin.com/in/',  true, 7)
on conflict (key) do nothing;

-- 10.2 Demo Social Accounts + Statistics
-- Matches the 9 demo bloggers from seed_new_blogger and frontend mock data
do $$
declare
  v_platform record;
  v_blogger uuid;
  v_blogger_id uuid;
  v_youtube_id uuid;
  v_instagram_id uuid;
  v_telegram_id uuid;
  v_tiktok_id uuid;
  v_facebook_id uuid;
  v_account_id uuid;
  v_history_date date;
begin
  -- Cache platform IDs
  select id into v_youtube_id from public.social_platforms where key = 'youtube';
  select id into v_instagram_id from public.social_platforms where key = 'instagram';
  select id into v_telegram_id from public.social_platforms where key = 'telegram';
  select id into v_tiktok_id from public.social_platforms where key = 'tiktok';
  select id into v_facebook_id from public.social_platforms where key = 'facebook';

  -- ======================================================
  -- Fermer Elyor (slug: elyor) — 1.2M+ total subs
  -- Frontend mock: subs 1.2M+, eng 8.7%, rating 4.9
  -- ======================================================
  select b.id into v_blogger from public.bloggers b where b.slug = 'elyor';

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_youtube_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_youtube_id, 'Fermer Elyor', 'UCelyor', 'https://youtube.com/@fermerelyor', null, true, true, '2024-01-15', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 720000, 18500000, 890000, 45000, 28000, 8.7, 180, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_instagram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_instagram_id, 'fermer_elyor', 'ig_elyor', 'https://instagram.com/fermer_elyor', null, true, true, '2024-02-10', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 320000, 9200000, 480000, 22000, 15000, 6.3, 95, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_telegram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_telegram_id, 'Fermer Elyor Kanal', 'fermer_elyor', 'https://t.me/fermer_elyor', null, false, true, '2024-03-05', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 160000, 3800000, 125000, 8000, 5000, 4.2, 0, current_date);
  end if;

  -- ======================================================
  -- Bog'bon Aziz (slug: aziz) — 820K+ total subs
  -- Frontend mock: subs 820K+, eng 7.2%, rating 4.8
  -- ======================================================
  select b.id into v_blogger from public.bloggers b where b.slug = 'aziz';

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_youtube_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_youtube_id, 'Bog''bon Aziz', 'UCaziz', 'https://youtube.com/@bogbonaziz', null, true, true, '2024-01-20', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 480000, 12100000, 580000, 32000, 18000, 7.2, 140, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_instagram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_instagram_id, 'bogbon_aziz', 'ig_aziz', 'https://instagram.com/bogbon_aziz', null, false, true, '2024-02-15', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 220000, 5800000, 310000, 15000, 9000, 5.8, 70, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_telegram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_telegram_id, 'Bog''dorchilik Aziz', 'bogbon_aziz', 'https://t.me/bogbon_aziz', null, false, true, '2024-03-10', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 120000, 2800000, 95000, 6000, 4000, 3.9, 0, current_date);
  end if;

  -- ======================================================
  -- Chorva House (slug: chorva) — 650K+ total subs
  -- Frontend mock: subs 650K+, eng 6.1%, rating 4.7
  -- ======================================================
  select b.id into v_blogger from public.bloggers b where b.slug = 'chorva';

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_youtube_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_youtube_id, 'Chorva House', 'UCchorva', 'https://youtube.com/@chorvahouse', null, true, true, '2024-01-10', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 380000, 9800000, 450000, 28000, 16000, 6.1, 110, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_instagram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_instagram_id, 'chorva_house', 'ig_chorva', 'https://instagram.com/chorva_house', null, false, true, '2024-02-20', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 170000, 4200000, 210000, 12000, 7000, 5.2, 55, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_facebook_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_facebook_id, 'Chorva House', 'fb_chorva', 'https://facebook.com/chorvahouse', null, false, true, '2024-03-01', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 100000, 1800000, 85000, 5000, 3000, 4.0, 30, current_date);
  end if;

  -- ======================================================
  -- Agro Tech UZ (slug: agrotech) — 560K+ total subs
  -- Frontend mock: subs 560K+, eng 9.3%, rating 4.9
  -- ======================================================
  select b.id into v_blogger from public.bloggers b where b.slug = 'agrotech';

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_youtube_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_youtube_id, 'Agro Tech UZ', 'UCagrotech', 'https://youtube.com/@agrotechuz', null, true, true, '2024-01-25', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 310000, 15200000, 720000, 38000, 22000, 9.3, 95, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_instagram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_instagram_id, 'agrotech_uz', 'ig_agrotech', 'https://instagram.com/agrotech_uz', null, false, true, '2024-02-18', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 150000, 4800000, 280000, 14000, 9000, 6.8, 45, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_telegram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_telegram_id, 'Agro Texnologiya', 'agrotech_uz', 'https://t.me/agrotech_uz', null, false, true, '2024-03-12', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 100000, 2200000, 85000, 5000, 3500, 4.5, 0, current_date);
  end if;

  -- ======================================================
  -- Eco Fermer (slug: ecofermer) — 480K+ total subs
  -- Frontend mock: subs 480K+, eng 7.8%, rating 4.6
  -- ======================================================
  select b.id into v_blogger from public.bloggers b where b.slug = 'ecofermer';

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_youtube_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_youtube_id, 'Eco Fermer', 'UCeco', 'https://youtube.com/@ecofermer', null, true, true, '2024-01-30', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 250000, 7800000, 380000, 20000, 12000, 7.8, 85, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_instagram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_instagram_id, 'eco_fermer', 'ig_eco', 'https://instagram.com/eco_fermer', null, false, true, '2024-02-25', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 130000, 3200000, 180000, 9000, 5500, 5.5, 40, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_telegram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_telegram_id, 'Eko Dehqonchilik', 'eco_fermer', 'https://t.me/eco_fermer', null, false, true, '2024-03-15', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 100000, 1500000, 65000, 4000, 2500, 3.8, 0, current_date);
  end if;

  -- ======================================================
  -- Agro Biznes (slug: agrobiznes) — 430K+ total subs
  -- Frontend mock: subs 430K+, eng 6.5%, rating 4.5
  -- ======================================================
  select b.id into v_blogger from public.bloggers b where b.slug = 'agrobiznes';

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_youtube_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_youtube_id, 'Agro Biznes', 'UCagrobiz', 'https://youtube.com/@agrobiznes', null, true, true, '2024-02-05', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 230000, 6200000, 340000, 18000, 11000, 6.5, 75, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_instagram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_instagram_id, 'agro_biznes', 'ig_agrobiz', 'https://instagram.com/agro_biznes', null, false, true, '2024-02-28', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 120000, 2800000, 150000, 8000, 5000, 4.8, 35, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_telegram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_telegram_id, 'Agro Biznes Tahlil', 'agrobiz_tv', 'https://t.me/agrobiz_tv', null, false, true, '2024-03-20', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 80000, 1800000, 55000, 3500, 2000, 3.5, 0, current_date);
  end if;

  -- ======================================================
  -- Issiqxona Pro (slug: issiqxona) — 390K+ total subs
  -- Frontend mock: subs 390K+, eng 7.0%, rating 4.7
  -- ======================================================
  select b.id into v_blogger from public.bloggers b where b.slug = 'issiqxona';

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_youtube_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_youtube_id, 'Issiqxona Pro', 'UCissiq', 'https://youtube.com/@issiqxona', null, true, true, '2024-01-12', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 210000, 5500000, 290000, 16000, 9500, 7.0, 65, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_instagram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_instagram_id, 'issiqxona_pro', 'ig_issiq', 'https://instagram.com/issiqxona_pro', null, false, true, '2024-02-22', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 110000, 2500000, 145000, 7000, 4500, 5.2, 30, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_telegram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_telegram_id, 'Issiqxona Sirlari', 'issiqxona_uz', 'https://t.me/issiqxona_uz', null, false, true, '2024-03-08', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 70000, 1200000, 48000, 3000, 2000, 3.2, 0, current_date);
  end if;

  -- ======================================================
  -- Dehqon Bobo (slug: dehqon) — 350K+ total subs
  -- Frontend mock: subs 350K+, eng 6.8%, rating 4.6
  -- ======================================================
  select b.id into v_blogger from public.bloggers b where b.slug = 'dehqon';

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_youtube_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_youtube_id, 'Dehqon Bobo', 'UCdehqon', 'https://youtube.com/@dehqonbobo', null, true, true, '2024-01-08', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 190000, 4800000, 260000, 15000, 9000, 6.8, 60, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_instagram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_instagram_id, 'dehqon_bobo', 'ig_dehqon', 'https://instagram.com/dehqon_bobo', null, false, true, '2024-02-12', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 100000, 2100000, 120000, 6000, 3500, 4.9, 25, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_telegram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_telegram_id, 'Dehqonchilik Maktabi', 'dehqon_tv', 'https://t.me/dehqon_tv', null, false, true, '2024-03-18', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 60000, 900000, 38000, 2500, 1500, 2.9, 0, current_date);
  end if;

  -- ======================================================
  -- Smart Agro (slug: smartagro) — 300K+ total subs
  -- Frontend mock: subs 300K+, eng 8.1%, rating 4.8
  -- ======================================================
  select b.id into v_blogger from public.bloggers b where b.slug = 'smartagro';

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_youtube_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_youtube_id, 'Smart Agro', 'UCsmart', 'https://youtube.com/@smartagro', null, true, true, '2024-02-01', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 160000, 8500000, 380000, 22000, 14000, 8.1, 55, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_instagram_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_instagram_id, 'smart_agro', 'ig_smart', 'https://instagram.com/smart_agro', null, false, true, '2024-02-28', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 90000, 2800000, 160000, 8000, 5000, 5.8, 30, current_date);
  end if;

  if not exists (select 1 from public.social_accounts where blogger_id = v_blogger and platform_id = v_tiktok_id and deleted_at is null) then
    insert into public.social_accounts (id, blogger_id, platform_id, account_name, account_id, profile_url, avatar_url, is_verified, is_active, connected_at, last_synced_at)
    values (gen_random_uuid(), v_blogger, v_tiktok_id, 'smartagro', 'tk_smart', 'https://tiktok.com/@smartagro', null, false, true, '2024-03-01', now())
    returning id into v_account_id;

    insert into public.social_statistics (account_id, subscribers_count, views_count, likes_count, comments_count, shares_count, engagement_rate, videos_count, snapshot_date)
    values (v_account_id, 50000, 3500000, 210000, 12000, 8000, 7.2, 40, current_date);
  end if;

  -- ======================================================
  -- Historical Data (6 months of monthly snapshots)
  -- Only for top 3 bloggers to keep seed manageable
  -- ======================================================
end;
$$;
