-- ============================================================================
-- News CMS Core
-- Tables: news_categories, news_tags, news_articles, news_article_tags,
--         news_comments, news_views, news_bookmarks, news_versions,
--         news_related_articles
--
-- Phase 1.6 — News content management foundation
-- ============================================================================

-- Ensure pgcrypto is available for seed helper functions
create extension if not exists pgcrypto schema public;

-- --------------------------------------------------------------------------
-- 1. News Categories (matching frontend cats[] in src/lib/news.ts)
-- --------------------------------------------------------------------------

create table if not exists public.news_categories (
  id         uuid         primary key default gen_random_uuid(),
  key        varchar(50)  not null,
  name_uz    varchar(255) not null,
  name_ru    varchar(255) not null,
  name_en    varchar(255) not null,
  icon       varchar(50),
  sort_order integer      not null default 0,
  is_active  boolean      not null default true,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  deleted_at timestamptz,
  created_by uuid         references public.profiles(id) on delete set null,
  updated_by uuid         references public.profiles(id) on delete set null,
  deleted_by uuid         references public.profiles(id) on delete set null
);

create unique index idx_news_categories_key on public.news_categories (key);

create index idx_news_categories_sort_order on public.news_categories (sort_order);
create index idx_news_categories_is_active on public.news_categories (is_active) where is_active = true;
create index idx_news_categories_deleted_at on public.news_categories (deleted_at);

create trigger trg_news_categories_updated_at
  before update on public.news_categories
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 2. News Tags (reusable)
-- --------------------------------------------------------------------------

create table if not exists public.news_tags (
  id         uuid         primary key default gen_random_uuid(),
  name       varchar(100) not null,
  slug       varchar(100) not null,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  deleted_at timestamptz,
  created_by uuid         references public.profiles(id) on delete set null,
  updated_by uuid         references public.profiles(id) on delete set null,
  deleted_by uuid         references public.profiles(id) on delete set null
);

create unique index idx_news_tags_slug on public.news_tags (slug) where deleted_at is null;

create index idx_news_tags_deleted_at on public.news_tags (deleted_at);

create trigger trg_news_tags_updated_at
  before update on public.news_tags
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 3. News Articles (main content table)
-- --------------------------------------------------------------------------

create table if not exists public.news_articles (
  id              uuid          primary key default gen_random_uuid(),
  category_id     uuid          references public.news_categories(id) on delete set null,
  author_id       uuid          references public.profiles(id) on delete set null,
  editor_id       uuid          references public.profiles(id) on delete set null,
  title           varchar(500)  not null,
  slug            varchar(500)  not null,
  excerpt         text,
  content         text,
  status          varchar(50)   not null default 'draft',
  language        varchar(10)   not null default 'uz',
  cover_image     varchar(500),
  source_name     varchar(255),
  source_url      varchar(500),
  published_at    timestamptz,
  featured_until  timestamptz,
  is_featured     boolean       not null default false,
  is_breaking     boolean       not null default false,
  reading_time    integer,
  seo_title       varchar(500),
  seo_description text,
  canonical_url   varchar(500),
  og_image        varchar(500),
  meta_keywords   text,
  allow_comments  boolean       not null default true,
  view_count      integer       not null default 0,
  bookmark_count  integer       not null default 0,
  share_count     integer       not null default 0,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  deleted_at      timestamptz,
  created_by      uuid          references public.profiles(id) on delete set null,
  updated_by      uuid          references public.profiles(id) on delete set null,
  deleted_by      uuid          references public.profiles(id) on delete set null
);

create unique index idx_news_articles_slug on public.news_articles (slug) where deleted_at is null;

create index idx_news_articles_category on public.news_articles (category_id);
create index idx_news_articles_author on public.news_articles (author_id);
create index idx_news_articles_editor on public.news_articles (editor_id);
create index idx_news_articles_status on public.news_articles (status);
create index idx_news_articles_published on public.news_articles (published_at desc) where status = 'published';
create index idx_news_articles_featured on public.news_articles (is_featured, published_at desc)
  where is_featured = true and status = 'published';
create index idx_news_articles_breaking on public.news_articles (is_breaking, published_at desc)
  where is_breaking = true and status = 'published';
create index idx_news_articles_language on public.news_articles (language);
create index idx_news_articles_views on public.news_articles (view_count desc) where status = 'published';
create index idx_news_articles_deleted_at on public.news_articles (deleted_at);

create index idx_news_articles_search
  on public.news_articles
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(excerpt, '')));

alter table public.news_articles add constraint chk_news_articles_status
  check (status in ('draft', 'review', 'scheduled', 'published', 'archived', 'deleted'));
alter table public.news_articles add constraint chk_news_articles_language
  check (language in ('uz', 'ru', 'en'));
alter table public.news_articles add constraint chk_news_articles_dates
  check (published_at is null or featured_until is null or featured_until >= published_at);
alter table public.news_articles add constraint chk_news_articles_view_count
  check (view_count >= 0);
alter table public.news_articles add constraint chk_news_articles_bookmark_count
  check (bookmark_count >= 0);
alter table public.news_articles add constraint chk_news_articles_share_count
  check (share_count >= 0);

create trigger trg_news_articles_updated_at
  before update on public.news_articles
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 4. News Article Tags (many-to-many)
-- --------------------------------------------------------------------------

create table if not exists public.news_article_tags (
  id         uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles(id) on delete cascade,
  tag_id     uuid not null references public.news_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_by uuid references public.profiles(id) on delete set null
);

create unique index idx_news_article_tags_unique
  on public.news_article_tags (article_id, tag_id) where deleted_at is null;

create index idx_news_article_tags_article on public.news_article_tags (article_id);
create index idx_news_article_tags_tag on public.news_article_tags (tag_id);
create index idx_news_article_tags_deleted_at on public.news_article_tags (deleted_at);

create trigger trg_news_article_tags_updated_at
  before update on public.news_article_tags
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 5. News Comments (future-ready)
-- --------------------------------------------------------------------------

create table if not exists public.news_comments (
  id          uuid         primary key default gen_random_uuid(),
  article_id  uuid         not null references public.news_articles(id) on delete cascade,
  parent_id   uuid         references public.news_comments(id) on delete cascade,
  profile_id  uuid         not null references public.profiles(id) on delete cascade,
  content     text         not null,
  is_approved boolean      not null default false,
  approved_at timestamptz,
  approved_by uuid         references public.profiles(id) on delete set null,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create index idx_news_comments_article on public.news_comments (article_id, is_approved, created_at desc);
create index idx_news_comments_parent on public.news_comments (parent_id);
create index idx_news_comments_profile on public.news_comments (profile_id);
create index idx_news_comments_deleted_at on public.news_comments (deleted_at);

alter table public.news_comments add constraint chk_news_comments_parent
  check (parent_id is null or parent_id != id);

create trigger trg_news_comments_updated_at
  before update on public.news_comments
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 6. News Views (tracking)
-- --------------------------------------------------------------------------

create table if not exists public.news_views (
  id         uuid         primary key default gen_random_uuid(),
  article_id uuid         not null references public.news_articles(id) on delete cascade,
  profile_id uuid         references public.profiles(id) on delete set null,
  ip_address varchar(45),
  user_agent text,
  viewed_at  timestamptz  not null default now(),
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  deleted_at timestamptz,
  created_by uuid         references public.profiles(id) on delete set null,
  updated_by uuid         references public.profiles(id) on delete set null,
  deleted_by uuid         references public.profiles(id) on delete set null
);

create index idx_news_views_article on public.news_views (article_id, viewed_at desc);
create index idx_news_views_profile on public.news_views (profile_id) where profile_id is not null;
create index idx_news_views_viewed on public.news_views (viewed_at desc);
create index idx_news_views_deleted_at on public.news_views (deleted_at);

create trigger trg_news_views_updated_at
  before update on public.news_views
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 7. News Bookmarks (saved articles)
-- --------------------------------------------------------------------------

create table if not exists public.news_bookmarks (
  id         uuid         primary key default gen_random_uuid(),
  article_id uuid         not null references public.news_articles(id) on delete cascade,
  profile_id uuid         not null references public.profiles(id) on delete cascade,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  deleted_at timestamptz,
  created_by uuid         references public.profiles(id) on delete set null,
  updated_by uuid         references public.profiles(id) on delete set null,
  deleted_by uuid         references public.profiles(id) on delete set null
);

create unique index idx_news_bookmarks_unique
  on public.news_bookmarks (article_id, profile_id) where deleted_at is null;

create index idx_news_bookmarks_article on public.news_bookmarks (article_id);
create index idx_news_bookmarks_profile on public.news_bookmarks (profile_id);
create index idx_news_bookmarks_deleted_at on public.news_bookmarks (deleted_at);

create trigger trg_news_bookmarks_updated_at
  before update on public.news_bookmarks
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 8. News Versions (revision history)
-- --------------------------------------------------------------------------

create table if not exists public.news_versions (
  id             uuid          primary key default gen_random_uuid(),
  article_id     uuid          not null references public.news_articles(id) on delete cascade,
  version_number integer       not null,
  title          varchar(500)  not null,
  slug           varchar(500)  not null,
  excerpt        text,
  content        text,
  status         varchar(50)   not null,
  cover_image    varchar(500),
  source_name    varchar(255),
  source_url     varchar(500),
  change_summary text,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),
  deleted_at     timestamptz,
  created_by     uuid          references public.profiles(id) on delete set null,
  updated_by     uuid          references public.profiles(id) on delete set null,
  deleted_by     uuid          references public.profiles(id) on delete set null
);

create unique index idx_news_versions_article_version
  on public.news_versions (article_id, version_number) where deleted_at is null;

create index idx_news_versions_article on public.news_versions (article_id, version_number desc);
create index idx_news_versions_deleted_at on public.news_versions (deleted_at);

alter table public.news_versions add constraint chk_news_versions_status
  check (status in ('draft', 'review', 'scheduled', 'published', 'archived', 'deleted'));
alter table public.news_versions add constraint chk_news_versions_number
  check (version_number >= 1);

create trigger trg_news_versions_updated_at
  before update on public.news_versions
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 9. News Related Articles (manual relations)
-- --------------------------------------------------------------------------

create table if not exists public.news_related_articles (
  id         uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles(id) on delete cascade,
  related_id uuid not null references public.news_articles(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_by uuid references public.profiles(id) on delete set null
);

create unique index idx_news_related_unique
  on public.news_related_articles (article_id, related_id) where deleted_at is null;

create index idx_news_related_article on public.news_related_articles (article_id, sort_order);
create index idx_news_related_related on public.news_related_articles (related_id);
create index idx_news_related_deleted_at on public.news_related_articles (deleted_at);

alter table public.news_related_articles add constraint chk_news_related_different
  check (article_id != related_id);

create trigger trg_news_related_articles_updated_at
  before update on public.news_related_articles
  for each row
  execute function public.handle_updated_at();

-- ============================================================================
-- 10. Version Creation Trigger
-- Auto-creates a version snapshot when an article is updated
-- ============================================================================

create or replace function public.handle_news_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
begin
  select coalesce(max(version_number), 0) + 1 into v_version
  from public.news_versions
  where article_id = new.id and deleted_at is null;

  insert into public.news_versions (
    article_id, version_number, title, slug, excerpt, content,
    status, cover_image, source_name, source_url, change_summary,
    created_by
  ) values (
    new.id, v_version, new.title, new.slug, new.excerpt, new.content,
    new.status, new.cover_image, new.source_name, new.source_url,
    'Auto-saved version',
    coalesce(auth.uid(), new.updated_by)
  );

  return new;
end;
$$;

create trigger trg_news_articles_version
  after update on public.news_articles
  for each row
  execute function public.handle_news_version();

-- ============================================================================
-- 11. Row-Level Security (RLS)
-- ============================================================================

-- 11.1 News Categories
alter table public.news_categories enable row level security;

create policy "Public can read active categories"
  on public.news_categories for select
  using (is_active = true and deleted_at is null);

create policy "Editor can manage categories"
  on public.news_categories for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update categories"
  on public.news_categories for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete categories"
  on public.news_categories for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 11.2 News Tags
alter table public.news_tags enable row level security;

create policy "Public can read tags"
  on public.news_tags for select
  using (deleted_at is null);

create policy "Editor can manage tags"
  on public.news_tags for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update tags"
  on public.news_tags for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete tags"
  on public.news_tags for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 11.3 News Articles
alter table public.news_articles enable row level security;

create policy "Public can read published articles"
  on public.news_articles for select
  using (
    status = 'published'
    and deleted_at is null
    and (published_at is null or published_at <= now())
  );

create policy "Editor can read all articles"
  on public.news_articles for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can create articles"
  on public.news_articles for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update articles"
  on public.news_articles for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete articles"
  on public.news_articles for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 11.4 News Article Tags
alter table public.news_article_tags enable row level security;

create policy "Public can read article tags"
  on public.news_article_tags for select
  using (
    deleted_at is null
    and article_id in (
      select na.id from public.news_articles na
      where na.status = 'published' and na.deleted_at is null
    )
  );

create policy "Editor can manage article tags"
  on public.news_article_tags for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update article tags"
  on public.news_article_tags for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete article tags"
  on public.news_article_tags for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 11.5 News Comments
alter table public.news_comments enable row level security;

create policy "Public can read approved comments"
  on public.news_comments for select
  using (is_approved = true and deleted_at is null);

create policy "Authenticated can create comments"
  on public.news_comments for insert
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.news_articles na
      where na.id = article_id and na.allow_comments = true
    )
  );

create policy "Users can update own comments"
  on public.news_comments for update
  using (profile_id = auth.uid());

create policy "Users can delete own comments"
  on public.news_comments for delete
  using (profile_id = auth.uid());

create policy "Editor can read all comments"
  on public.news_comments for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can moderate comments"
  on public.news_comments for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete comments"
  on public.news_comments for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 11.6 News Views
alter table public.news_views enable row level security;

create policy "Anyone can record a view"
  on public.news_views for insert
  with check (true);

create policy "Users can read own views"
  on public.news_views for select
  using (profile_id = auth.uid());

create policy "Editor can read all views"
  on public.news_views for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete views"
  on public.news_views for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 11.7 News Bookmarks
alter table public.news_bookmarks enable row level security;

create policy "Users can manage own bookmarks"
  on public.news_bookmarks for select
  using (profile_id = auth.uid());

create policy "Users can create own bookmarks"
  on public.news_bookmarks for insert
  with check (profile_id = auth.uid());

create policy "Users can delete own bookmarks"
  on public.news_bookmarks for delete
  using (profile_id = auth.uid());

create policy "Super admin can manage all bookmarks"
  on public.news_bookmarks for all
  using (auth_role() = 'super_admin');

-- 11.8 News Versions
alter table public.news_versions enable row level security;

create policy "Editor can read versions"
  on public.news_versions for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can manage versions"
  on public.news_versions for insert
  with check (auth_role() in ('super_admin', 'admin'));

create policy "Admin can update versions"
  on public.news_versions for update
  using (auth_role() in ('super_admin', 'admin'));

create policy "Admin can soft-delete versions"
  on public.news_versions for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 11.9 News Related Articles
alter table public.news_related_articles enable row level security;

create policy "Public can read related articles"
  on public.news_related_articles for select
  using (
    deleted_at is null
    and article_id in (
      select na.id from public.news_articles na
      where na.status = 'published' and na.deleted_at is null
    )
    and related_id in (
      select na.id from public.news_articles na
      where na.status = 'published' and na.deleted_at is null
    )
  );

create policy "Editor can manage related articles"
  on public.news_related_articles for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update related articles"
  on public.news_related_articles for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete related articles"
  on public.news_related_articles for delete
  using (auth_role() in ('super_admin', 'admin'));

-- ============================================================================
-- 12. Views
-- ============================================================================

-- 12.1 Latest News — ordered by publish date
create or replace view public.latest_news_view as
select
  na.id,
  na.slug,
  na.title,
  na.excerpt,
  na.cover_image,
  na.published_at,
  na.reading_time,
  na.view_count,
  na.is_featured,
  na.is_breaking,
  nc.key as category_key,
  nc.name_uz as category_name,
  nc.icon as category_icon,
  p.name as author_name,
  p.avatar as author_avatar
from public.news_articles na
left join public.news_categories nc on nc.id = na.category_id
left join public.profiles p on p.id = na.author_id
where na.status = 'published'
  and na.deleted_at is null
  and (na.published_at is null or na.published_at <= now())
order by na.published_at desc;

-- 12.2 Featured News — articles marked as featured
create or replace view public.featured_news_view as
select
  na.id,
  na.slug,
  na.title,
  na.excerpt,
  na.cover_image,
  na.published_at,
  na.reading_time,
  na.view_count,
  nc.key as category_key,
  nc.name_uz as category_name,
  nc.icon as category_icon,
  p.name as author_name,
  p.avatar as author_avatar
from public.news_articles na
left join public.news_categories nc on nc.id = na.category_id
left join public.profiles p on p.id = na.author_id
where na.status = 'published'
  and na.is_featured = true
  and na.deleted_at is null
  and (na.published_at is null or na.published_at <= now())
  and (na.featured_until is null or na.featured_until >= now())
order by na.published_at desc;

-- 12.3 Breaking News — urgent articles
create or replace view public.breaking_news_view as
select
  na.id,
  na.slug,
  na.title,
  na.excerpt,
  na.published_at,
  nc.key as category_key,
  nc.name_uz as category_name
from public.news_articles na
left join public.news_categories nc on nc.id = na.category_id
where na.status = 'published'
  and na.is_breaking = true
  and na.deleted_at is null
  and (na.published_at is null or na.published_at <= now())
order by na.published_at desc;

-- 12.4 Popular News — ranked by view count
create or replace view public.popular_news_view as
select
  na.id,
  na.slug,
  na.title,
  na.excerpt,
  na.cover_image,
  na.published_at,
  na.view_count,
  na.share_count,
  nc.key as category_key,
  nc.name_uz as category_name,
  p.name as author_name
from public.news_articles na
left join public.news_categories nc on nc.id = na.category_id
left join public.profiles p on p.id = na.author_id
where na.status = 'published'
  and na.deleted_at is null
  and (na.published_at is null or na.published_at <= now())
order by na.view_count desc
limit 10;

-- 12.5 Related News — manually curated relations
create or replace view public.related_news_view as
select
  nra.article_id,
  nra.sort_order,
  na.id,
  na.slug,
  na.title,
  na.excerpt,
  na.cover_image,
  na.published_at,
  na.view_count,
  nc.key as category_key,
  nc.name_uz as category_name,
  p.name as author_name
from public.news_related_articles nra
join public.news_articles na on na.id = nra.related_id
left join public.news_categories nc on nc.id = na.category_id
left join public.profiles p on p.id = na.author_id
where na.status = 'published'
  and na.deleted_at is null
  and nra.deleted_at is null
order by nra.article_id, nra.sort_order;

-- ============================================================================
-- 13. Seed Data
-- ============================================================================

-- 13.1 Seed News Categories
-- Matches the cats[] array in src/lib/news.ts exactly
insert into public.news_categories (key, name_uz, name_ru, name_en, icon, sort_order, is_active)
values
  ('texnologiya',  'Agro texnologiya',     'Агро технология',   'Agro Technology',    'cpu',    1, true),
  ('qishloq',      'Qishloq xo''jaligi',  'Сельское хозяйство', 'Agriculture',       'sprout', 2, true),
  ('bozor',        'Bozor va iqtisodiyot', 'Рынок и экономика', 'Market & Economy',  'chart',  3, true),
  ('davlat',       'Davlat dasturlari',    'Государственные программы', 'State Programs', 'doc', 4, true),
  ('innovatsiya',  'Innovatsiya',          'Инновация',          'Innovation',        'bolt',   5, true),
  ('ekologiya',    'Ekologiya',            'Экология',           'Ecology',           'leaf',   6, true),
  ('tadqiqotlar',  'Tadqiqotlar',          'Исследования',       'Research',          'flask',  7, true),
  ('xalqaro',      'Xalqaro yangiliklar',  'Международные новости', 'International News', 'globe', 8, true)
on conflict (key) do nothing;

-- 13.2 Seed News Tags
insert into public.news_tags (name, slug)
values
  ('Sug''orish', 'sugorish'),
  ('Texnika', 'texnika'),
  ('Eksport', 'eksport'),
  ('Subsisiya', 'subsidiya'),
  ('Iqlim', 'iqlim'),
  ('Dron', 'dron'),
  ('Sun''iy intellekt', 'suniy-intellekt'),
  ('Organik', 'organik'),
  ('Hosildorlik', 'hosildorlik'),
  ('Investitsiya', 'investitsiya'),
  ('Fermer', 'fermer'),
  ('Qayta ishlash', 'qayta-ishlash'),
  ('Transport', 'transport'),
  ('Kredit', 'kredit'),
  ('Digital', 'digital'),
  ('Oziq-ovqat xavfsizligi', 'oziq-ovqat-xavfsizligi')
on conflict (slug) where deleted_at is null do nothing;

-- 13.3 Seed Helper: Create/lookup an editor profile for news
create or replace function public.seed_news_editor()
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_role_id uuid;
begin
  select p.id into v_user_id
  from public.profiles p
  join public.user_roles ur on ur.profile_id = p.id
  join public.roles r on r.id = ur.role_id
  where r.name = 'editor' and p.email = 'news@agroalliance.uz'
  limit 1;

  if v_user_id is not null then
    return v_user_id;
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
  values (
    v_user_id, 'news@agroalliance.uz',
    crypt('newsadmin123', gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('name', 'Agro Alliance News')
  );

  select id into v_role_id from public.roles where name = 'editor';

  update public.profiles
  set name = 'Agro Alliance News', status = 'active'
  where id = v_user_id;

  insert into public.user_roles (profile_id, role_id)
  values (v_user_id, v_role_id);

  return v_user_id;
end;
$$;

-- 13.4 Seed Demo Articles + Related Data
do $$
declare
  v_timestamp   timestamptz;
  v_cat_id      uuid;
  v_tag_id      uuid;
  v_author_id   uuid;
  v_article_id  uuid;
  v_article2_id uuid;
  v_article3_id uuid;
  v_article_ids uuid[];
begin
  -- Look up the editor/author profile
  v_author_id := public.seed_news_editor();

  -- Cache article IDs for later reference
  v_article_ids := '{}'::uuid[];

  -- Helper function to create a news article
  -- Uses nested block to avoid function overhead
  for v_idx in 1..22 loop
    case v_idx
      when 1 then
        select id into v_cat_id from public.news_categories where key = 'texnologiya';
        v_timestamp := '2024-05-22 09:00:00+05';
      when 2 then
        select id into v_cat_id from public.news_categories where key = 'qishloq';
        v_timestamp := '2024-05-21 09:00:00+05';
      when 3 then
        select id into v_cat_id from public.news_categories where key = 'innovatsiya';
        v_timestamp := '2024-05-19 10:00:00+05';
      when 4 then
        select id into v_cat_id from public.news_categories where key = 'bozor';
        v_timestamp := '2024-05-18 11:00:00+05';
      when 5 then
        select id into v_cat_id from public.news_categories where key = 'davlat';
        v_timestamp := '2024-05-17 09:30:00+05';
      when 6 then
        select id into v_cat_id from public.news_categories where key = 'texnologiya';
        v_timestamp := '2024-05-16 10:00:00+05';
      when 7 then
        select id into v_cat_id from public.news_categories where key = 'xalqaro';
        v_timestamp := '2024-05-15 14:00:00+05';
      when 8 then
        select id into v_cat_id from public.news_categories where key = 'ekologiya';
        v_timestamp := '2024-05-14 09:00:00+05';
      when 9 then
        select id into v_cat_id from public.news_categories where key = 'tadqiqotlar';
        v_timestamp := '2024-05-13 10:00:00+05';
      when 10 then
        select id into v_cat_id from public.news_categories where key = 'texnologiya';
        v_timestamp := '2024-05-11 11:00:00+05';
      when 11 then
        select id into v_cat_id from public.news_categories where key = 'qishloq';
        v_timestamp := '2024-05-09 09:00:00+05';
      when 12 then
        select id into v_cat_id from public.news_categories where key = 'bozor';
        v_timestamp := '2024-05-07 10:30:00+05';
      when 13 then
        select id into v_cat_id from public.news_categories where key = 'innovatsiya';
        v_timestamp := '2024-05-05 14:00:00+05';
      when 14 then
        select id into v_cat_id from public.news_categories where key = 'ekologiya';
        v_timestamp := '2024-05-03 09:00:00+05';
      when 15 then
        select id into v_cat_id from public.news_categories where key = 'davlat';
        v_timestamp := '2024-05-01 11:00:00+05';
      when 16 then
        select id into v_cat_id from public.news_categories where key = 'xalqaro';
        v_timestamp := '2024-04-28 10:00:00+05';
      when 17 then
        select id into v_cat_id from public.news_categories where key = 'tadqiqotlar';
        v_timestamp := '2024-04-25 09:30:00+05';
      when 18 then
        select id into v_cat_id from public.news_categories where key = 'texnologiya';
        v_timestamp := '2024-04-22 14:00:00+05';
      when 19 then
        select id into v_cat_id from public.news_categories where key = 'qishloq';
        v_timestamp := '2024-04-19 09:00:00+05';
      when 20 then
        select id into v_cat_id from public.news_categories where key = 'bozor';
        v_timestamp := '2024-04-16 11:00:00+05';
      when 21 then
        select id into v_cat_id from public.news_categories where key = 'ekologiya';
        v_timestamp := '2024-04-13 10:00:00+05';
      when 22 then
        select id into v_cat_id from public.news_categories where key = 'innovatsiya';
        v_timestamp := '2024-04-10 09:00:00+05';
    end case;

    -- Insert the article
    insert into public.news_articles (
      category_id, author_id, editor_id,
      title, slug, excerpt, content,
      status, language, cover_image,
      published_at, is_featured, is_breaking,
      reading_time, allow_comments,
      view_count, bookmark_count, share_count
    )
    values (
      v_cat_id, v_author_id, v_author_id,
      case v_idx
        when 1 then 'Dronlar yordamida ekinlarni kuzatish yangi bosqichga chiqmoqda'
        when 2 then 'Tomchilatib sug''orish tizimlarining yangi avlodi joriy etilmoqda'
        when 3 then 'O''zbekistonda bioo''g''it ishlab chiqarish loyihalari kengaymoqda'
        when 4 then '2024-yil hosil mavsumida don narxlari qanday bo''ladi?'
        when 5 then 'Yangi davlat dasturi doirasida fermerlarga imtiyozli kreditlar beriladi'
        when 6 then 'Avtomatlashtirilgan traktorlar: kelajak bugundan boshlanadi'
        when 7 then 'O''zbekiston agrar mahsulotlari eksporti hajmi oshmoqda'
        when 8 then 'Qishloq xo''jaligida quyosh energiyasi ishlatish bo''yicha loyiha ishga tushdi'
        when 9 then 'Mahalliy olimlar tuzga chidamli bug''doy navi yaratdi'
        when 10 then 'Raqamlashtirilgan sug''orish tizimlari tajribadan o''tkazilmoqda'
        when 11 then 'Organik dehqonchilik — kelajak talabi'
        when 12 then 'Fermer mahsulotlari narxlari barqarorlashmoqda'
        when 13 then 'Agro sohada sun''iy intellekt yechimlari'
        when 14 then 'Tuproq unumdorligini oshirishning zamonaviy usullari'
        when 15 then 'Fermer xo''jaliklariga yangi soliq imtiyozlari berildi'
        when 16 then 'O''zbekiston qishloq xo''jaligi mahsulotlari Yevropa bozoriga chiqmoqda'
        when 17 then 'Mahalliy agrostartaplar xalqaro grantlarni qo''lga kiritmoqda'
        when 18 then 'Yangi agro texnika yarmarkasi o''tkazildi'
        when 19 then 'O''zbekistonda paxta hosildorligi oshishi kutilmoqda'
        when 20 then 'Qishloq xo''jaligida narx monitoringi tizimi joriy etiladi'
        when 21 then 'Suv resurslarini tejash bo''yicha yangi dastur ishlab chiqildi'
        when 22 then 'Biogaz qurilmalari fermerlar orasida ommalashmoqda'
      end,
      case v_idx
        when 1 then 'dronlar-ekin-kuzatish'
        when 2 then 'tomchilatib-sugorish'
        when 3 then 'bioogit-loyihalari'
        when 4 then 'don-narxlari-2024'
        when 5 then 'imtiyozli-kreditlar'
        when 6 then 'avtomatik-traktorlar'
        when 7 then 'agrar-eksport-oshmoqda'
        when 8 then 'quyosh-energiyasi-loyiha'
        when 9 then 'tuzga-chidamli-bugdoy'
        when 10 then 'raqamli-sugorish'
        when 11 then 'organik-dehqonchilik'
        when 12 then 'narxlar-bargaror'
        when 13 then 'suniy-intellekt-agro'
        when 14 then 'tuproq-unumdorligi'
        when 15 then 'soliq-imtiyozlari'
        when 16 then 'yevropa-bozori'
        when 17 then 'agro-startaplar'
        when 18 then 'texnika-yarmarkasi'
        when 19 then 'paxta-hosildorligi'
        when 20 then 'narx-monitoringi'
        when 21 then 'suv-tejash-dasturi'
        when 22 then 'biogaz-qurilmalari'
      end,
      case v_idx
        when 1 then 'Dron texnologiyalari dehqonlarga ekin holatini real vaqt rejimida kuzatish va hosildorlikni oshirishda yordam bermoqda.'
        when 2 then 'Suv tejovchi zamonaviy sug''orish tizimlari hosildorlikni oshirib, xarajatlarni kamaytirmoqda.'
        when 3 then 'Ekologik toza bioo''g''itlar mahalliy ishlab chiqarish quvvatlari sezilarli oshmoqda.'
        when 4 then 'Mutaxassislar don bozorida barqarorlik saqlanishini prognoz qilmoqda.'
        when 5 then 'Dastur doirasida 2 trln so''mdan ortiq mablag'' ajratilishi rejalashtirilgan.'
        when 6 then 'Yangi avlod traktorlar yonilg''i tejamkor va yuqori samaradorlikka ega.'
        when 7 then '2024-yilning birinchi choragida eksport hajmi 17% ga oshdi.'
        when 8 then 'Loyiha doirasida 10 ta viloyatda sinov ishlari boshlandi.'
        when 9 then 'Yangi nav sho''rlangan yerlarda yuqori hosil berishi bilan ajralib turadi.'
        when 10 then 'Aqlli sug''orish tizimlari suv sarfini 40% gacha kamaytirmoqda.'
        when 11 then 'Organik mahsulotlarga talab yildan-yilga ortib bormoqda.'
        when 12 then 'Mahalliy bozorlarda fermer mahsulotlari narxlari tushish tendensiyasi kuzatilmoqda.'
        when 13 then 'AI yechimlari ekin kasalliklarini erta aniqlashda yordam bermoqda.'
        when 14 then 'Yangi bio texnologiyalar tuproq unumdorligini tiklashda samarali natija ko''rsatmoqda.'
        when 15 then 'Imtiyozli soliq rejimi fermer xo''jaliklarining rivojlanishiga turtki bo''ladi.'
        when 16 then 'Yevropa Ittifoqi bozoriga mahsulot yetkazib berish hajmi ikki barobarga oshdi.'
        when 17 then 'O''zbekistonlik agrostartaplar jami 5 mln dollar grant mablag''ini qo''lga kiritdi.'
        when 18 then 'Xalqaro ko''rgazmada eng so''nggi qishloq xo''jaligi texnikalari namoyish etildi.'
        when 19 then 'Joriy mavsumda paxta hosildorligi gektaridan 35 sentnerni tashkil etishi kutilmoqda.'
        when 20 then 'Yangi tizim mahsulot narxlari haqida real vaqt ma''lumotlarini beradi.'
        when 21 then 'Suv resurslarini tejash dasturi 2025-yilgacha 30% tejashni maqsad qilgan.'
        when 22 then 'Biogaz qurilmalari organik chiqindilarni energiyaga aylantirish imkonini beradi.'
      end,
      case v_idx
        when 1 then 'Dron texnologiyalari dehqonlarga ekin holatini real vaqt rejimida kuzatish va hosildorlikni oshirishda yordam bermoqda.\n\nMutaxassislarning fikricha, ushbu yo''nalishdagi rivojlanish qishloq xo''jaligi samaradorligini sezilarli oshiradi va fermerlarning daromadini ko''paytiradi. So''nggi yillarda sohaga zamonaviy texnologiyalar va innovatsion yechimlar tobora keng joriy etilmoqda.\n\nLoyiha doirasida mahalliy mutaxassislar va xalqaro hamkorlar birgalikda ish olib bormoqda. Bu nafaqat hosildorlikni oshiradi, balki resurslarni tejash va ekologik muvozanatni saqlashga ham xizmat qiladi.\n\nAgro Alliance platformasi ushbu yangilik va imkoniyatlarni fermerlar, bloglerlar va kompaniyalarga yetkazib, sohani raqamlashtirishga o''z hissasini qo''shmoqda. Kelgusida bu yo''nalishda yanada kengroq qamrovli dasturlar amalga oshirilishi rejalashtirilgan.'
        when 2 then 'Suv tejovchi zamonaviy sug''orish tizimlari hosildorlikni oshirib, xarajatlarni kamaytirmoqda.\n\nMutaxassislarning fikricha, ushbu yo''nalishdagi rivojlanish qishloq xo''jaligi samaradorligini sezilarli oshiradi va fermerlarning daromadini ko''paytiradi. So''nggi yillarda sohaga zamonaviy texnologiyalar va innovatsion yechimlar tobora keng joriy etilmoqda.\n\nLoyiha doirasida mahalliy mutaxassislar va xalqaro hamkorlar birgalikda ish olib bormoqda. Bu nafaqat hosildorlikni oshiradi, balki resurslarni tejash va ekologik muvozanatni saqlashga ham xizmat qiladi.\n\nAgro Alliance platformasi ushbu yangilik va imkoniyatlarni fermerlar, bloglerlar va kompaniyalarga yetkazib, sohani raqamlashtirishga o''z hissasini qo''shmoqda. Kelgusida bu yo''nalishda yanada kengroq qamrovli dasturlar amalga oshirilishi rejalashtirilgan.'
        when 3 then 'Ekologik toza bioo''g''itlar mahalliy ishlab chiqarish quvvatlari sezilarli oshmoqda.\n\nMutaxassislarning fikricha, ushbu yo''nalishdagi rivojlanish qishloq xo''jaligi samaradorligini sezilarli oshiradi va fermerlarning daromadini ko''paytiradi. So''nggi yillarda sohaga zamonaviy texnologiyalar va innovatsion yechimlar tobora keng joriy etilmoqda.\n\nLoyiha doirasida mahalliy mutaxassislar va xalqaro hamkorlar birgalikda ish olib bormoqda. Bu nafaqat hosildorlikni oshiradi, balki resurslarni tejash va ekologik muvozanatni saqlashga ham xizmat qiladi.\n\nAgro Alliance platformasi ushbu yangilik va imkoniyatlarni fermerlar, bloglerlar va kompaniyalarga yetkazib, sohani raqamlashtirishga o''z hissasini qo''shmoqda. Kelgusida bu yo''nalishda yanada kengroq qamrovli dasturlar amalga oshirilishi rejalashtirilgan.'
        when 4 then 'Mutaxassislar don bozorida barqarorlik saqlanishini prognoz qilmoqda.\n\nMutaxassislarning fikricha, ushbu yo''nalishdagi rivojlanish qishloq xo''jaligi samaradorligini sezilarli oshiradi va fermerlarning daromadini ko''paytiradi. So''nggi yillarda sohaga zamonaviy texnologiyalar va innovatsion yechimlar tobora keng joriy etilmoqda.\n\nLoyiha doirasida mahalliy mutaxassislar va xalqaro hamkorlar birgalikda ish olib bormoqda. Bu nafaqat hosildorlikni oshiradi, balki resurslarni tejash va ekologik muvozanatni saqlashga ham xizmat qiladi.\n\nAgro Alliance platformasi ushbu yangilik va imkoniyatlarni fermerlar, bloglerlar va kompaniyalarga yetkazib, sohani raqamlashtirishga o''z hissasini qo''shmoqda. Kelgusida bu yo''nalishda yanada kengroq qamrovli dasturlar amalga oshirilishi rejalashtirilgan.'
        else 'Maqola matni.\n\nMutaxassislarning fikricha, ushbu yo''nalishdagi rivojlanish qishloq xo''jaligi samaradorligini sezilarli oshiradi va fermerlarning daromadini ko''paytiradi. So''nggi yillarda sohaga zamonaviy texnologiyalar va innovatsion yechimlar tobora keng joriy etilmoqda.\n\nLoyiha doirasida mahalliy mutaxassislar va xalqaro hamkorlar birgalikda ish olib bormoqda. Bu nafaqat hosildorlikni oshiradi, balki resurslarni tejash va ekologik muvozanatni saqlashga ham xizmat qiladi.\n\nAgro Alliance platformasi ushbu yangilik va imkoniyatlarni fermerlar, bloglerlar va kompaniyalarga yetkazib, sohani raqamlashtirishga o''z hissasini qo''shmoqda. Kelgusida bu yo''nalishda yanada kengroq qamrovli dasturlar amalga oshirilishi rejalashtirilgan.'
      end,
      'published', 'uz',
      case v_idx
        when 1 then 'news-dron'
        when 2 then 'news-sugorish'
        when 3 then 'news-bioogit'
        when 4 then 'news-don'
        when 5 then 'news-kredit'
        when 6 then 'news-traktor'
        when 7 then 'news-eksport'
        when 8 then 'news-quyosh'
        when 9 then 'news-bugdoy'
        when 10 then 'news-sugorish2'
        when 11 then 'news-organik'
        when 12 then 'news-narx'
        when 13 then 'news-ai'
        when 14 then 'news-tuproq'
        when 15 then 'news-soliq'
        when 16 then 'news-yevropa'
        when 17 then 'news-startap'
        when 18 then 'news-yarmarka'
        when 19 then 'news-paxta'
        when 20 then 'news-monitoring'
        when 21 then 'news-suv'
        when 22 then 'news-biogaz'
      end,
      v_timestamp,
      case when v_idx = 1 then true else false end,
      case when v_idx in (5, 13) then true else false end,
      case when v_idx = 1 then 5 else 4 end,
      true,
      case v_idx
        when 1 then 14200
        when 2 then 8600
        when 3 then 6300
        when 4 then 5700
        when 5 then 4900
        when 6 then 4100
        when 7 then 3800
        when 8 then 3200
        when 9 then 2700
        when 10 then 2400
        when 11 then 2100
        when 12 then 1900
        when 13 then 1800
        when 14 then 1600
        when 15 then 1500
        when 16 then 1300
        when 17 then 1200
        when 18 then 1100
        when 19 then 1000
        when 20 then 900
        when 21 then 800
        when 22 then 700
      end,
      case when v_idx <= 5 then floor(random() * 20 + 5)::integer else 0 end,
      case when v_idx <= 3 then floor(random() * 10 + 2)::integer else 0 end
    )
    returning id into v_article_id;

    -- Track IDs for later relationships
    v_article_ids := array_append(v_article_ids, v_article_id);

    -- Assign tags to each article
    for v_tag_idx in 1..3 loop
      select id into v_tag_id from public.news_tags
      order by random() limit 1;

      if not exists (
        select 1 from public.news_article_tags
        where article_id = v_article_id and tag_id = v_tag_id and deleted_at is null
      ) then
        insert into public.news_article_tags (article_id, tag_id)
        values (v_article_id, v_tag_id);
      end if;
    end loop;

    -- Initial version record
    insert into public.news_versions (
      article_id, version_number, title, slug, excerpt, content, status,
      cover_image, change_summary, created_by
    )
    select
      v_article_id, 1, title, slug, excerpt, content, status,
      cover_image, 'Initial version', author_id
    from public.news_articles
    where id = v_article_id;

    -- Create view records (bulk)
    for v_view in 1..50 loop
      insert into public.news_views (article_id, viewed_at)
      values (
        v_article_id,
        v_timestamp - (v_view || ' hours')::interval
      );
    end loop;
  end loop;

  -- Create comments for popular articles (first 3)
  if array_length(v_article_ids, 1) >= 3 then
    insert into public.news_comments (article_id, profile_id, content, is_approved, approved_at, approved_by)
    values
      (v_article_ids[1], v_author_id, 'Juda foydali maqola. Dron texnologiyalari haqida ko''proq ma''lumot bo''lsa yaxshi bo''lardi.', true, now(), v_author_id),
      (v_article_ids[1], v_author_id, 'Men ham dron sotib olishni o''ylayapman. Maqola juda yordam berdi.', true, now(), v_author_id),
      (v_article_ids[1], v_author_id, 'Bu texnologiyalar O''zbekistonda qanchalik keng tarqalgan?', true, now(), v_author_id),
      (v_article_ids[2], v_author_id, 'Tomchilatib sug''orish tizimini o''rnatish qancha turadi?', true, now(), v_author_id),
      (v_article_ids[2], v_author_id, 'Bizning fermer xo''jaligimizda sinab ko''rdik, natijalar ajoyib!', true, now(), v_author_id),
      (v_article_ids[3], v_author_id, 'Bioo''g''itlar haqida yana maqolalar kuting.', false, null, null);
  end if;

  -- Create bookmarks for some articles
  if array_length(v_article_ids, 1) >= 5 then
    for v_bm in 1..5 loop
      insert into public.news_bookmarks (article_id, profile_id)
      values (v_article_ids[v_bm], v_author_id)
      on conflict (article_id, profile_id) where deleted_at is null do nothing;
    end loop;
  end if;

  -- Create related article links
  if array_length(v_article_ids, 1) >= 6 then
    insert into public.news_related_articles (article_id, related_id, sort_order)
    values
      (v_article_ids[1], v_article_ids[6], 1),  -- dronlar -> avtomatik traktorlar
      (v_article_ids[1], v_article_ids[10], 2), -- dronlar -> raqamli sug'orish
      (v_article_ids[1], v_article_ids[13], 3), -- dronlar -> sun'iy intellekt
      (v_article_ids[2], v_article_ids[10], 1), -- tomchilatib -> raqamli sug'orish
      (v_article_ids[2], v_article_ids[21], 2), -- tomchilatib -> suv tejash
      (v_article_ids[4], v_article_ids[12], 1), -- don narxlari -> narxlar barqaror
      (v_article_ids[4], v_article_ids[20], 2)  -- don narxlari -> narx monitoringi
    on conflict (article_id, related_id) where deleted_at is null do nothing;
  end if;
end;
$$;
