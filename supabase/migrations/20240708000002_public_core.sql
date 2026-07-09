-- ============================================================================
-- Public Core Module
-- Tables: partners, partner_tasks, categories, homepage_stats,
--         homepage_sections, homepage_section_items, public_settings
--
-- Phase 1.3 — Public data layer matching the existing frontend
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Partners
-- --------------------------------------------------------------------------

create table if not exists public.partners (
  id               uuid         primary key default gen_random_uuid(),
  name             varchar(255) not null,
  slug             varchar(255) not null,
  sphere           varchar(255),
  logo             varchar(500),
  direction        varchar(100),
  contract_no      varchar(100),
  contract_amount  decimal(15,2),
  signed_date      date,
  status           varchar(20)  not null default 'active',
  is_featured      boolean      not null default false,
  sort_order       integer      not null default 0,
  client_profile_id uuid        references public.profiles(id) on delete set null,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now(),
  deleted_at       timestamptz,
  created_by       uuid         references public.profiles(id) on delete set null,
  updated_by       uuid         references public.profiles(id) on delete set null,
  deleted_by       uuid         references public.profiles(id) on delete set null
);

create unique index idx_partners_slug on public.partners (slug) where deleted_at is null;
create unique index idx_partners_name on public.partners (name) where deleted_at is null;

create index idx_partners_status on public.partners (status);
create index idx_partners_direction on public.partners (direction);
create index idx_partners_is_featured on public.partners (is_featured);
create index idx_partners_sort_order on public.partners (sort_order);
create index idx_partners_deleted_at on public.partners (deleted_at);

alter table public.partners add constraint chk_partners_status
  check (status in ('active', 'pending', 'completed'));

create trigger trg_partners_updated_at
  before update on public.partners
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 2. Partner Tasks
-- --------------------------------------------------------------------------

create table if not exists public.partner_tasks (
  id         uuid         primary key default gen_random_uuid(),
  partner_id uuid         not null references public.partners(id) on delete cascade,
  title      varchar(500) not null,
  status     varchar(20)  not null default 'pending',
  sort_order integer      not null default 0,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  deleted_at timestamptz,
  created_by uuid         references public.profiles(id) on delete set null,
  updated_by uuid         references public.profiles(id) on delete set null,
  deleted_by uuid         references public.profiles(id) on delete set null
);

create index idx_partner_tasks_partner_id on public.partner_tasks (partner_id);
create index idx_partner_tasks_status on public.partner_tasks (status);
create index idx_partner_tasks_sort_order on public.partner_tasks (sort_order);
create index idx_partner_tasks_deleted_at on public.partner_tasks (deleted_at);

alter table public.partner_tasks add constraint chk_partner_tasks_status
  check (status in ('pending', 'progress', 'done'));

create trigger trg_partner_tasks_updated_at
  before update on public.partner_tasks
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 3. Categories
-- Unified table supporting both blogger niches and news categories.
-- type = 'blogger' | 'news' | 'partner'
-- --------------------------------------------------------------------------

create table if not exists public.categories (
  id         uuid         primary key default gen_random_uuid(),
  key        varchar(100) not null,
  type       varchar(50)  not null,
  label      varchar(255) not null,
  icon       varchar(100),
  sort_order integer      not null default 0,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  deleted_at timestamptz,
  created_by uuid         references public.profiles(id) on delete set null,
  updated_by uuid         references public.profiles(id) on delete set null,
  deleted_by uuid         references public.profiles(id) on delete set null
);

create unique index idx_categories_type_key on public.categories (type, key) where deleted_at is null;

create index idx_categories_type on public.categories (type);
create index idx_categories_sort_order on public.categories (sort_order);
create index idx_categories_deleted_at on public.categories (deleted_at);

alter table public.categories add constraint chk_categories_type
  check (type in ('blogger', 'news', 'partner'));

create trigger trg_categories_updated_at
  before update on public.categories
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 4. Homepage Stats
-- Editable statistics displayed on the homepage stats bar.
-- Keys: bloggers, views, partners, regions, contents
-- --------------------------------------------------------------------------

create table if not exists public.homepage_stats (
  id         uuid         primary key default gen_random_uuid(),
  key        varchar(100) not null,
  value      varchar(50)  not null,
  label      varchar(255) not null,
  sort_order integer      not null default 0,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  deleted_at timestamptz,
  created_by uuid         references public.profiles(id) on delete set null,
  updated_by uuid         references public.profiles(id) on delete set null,
  deleted_by uuid         references public.profiles(id) on delete set null
);

create unique index idx_homepage_stats_key on public.homepage_stats (key) where deleted_at is null;

create index idx_homepage_stats_sort_order on public.homepage_stats (sort_order);
create index idx_homepage_stats_deleted_at on public.homepage_stats (deleted_at);

create trigger trg_homepage_stats_updated_at
  before update on public.homepage_stats
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 5. Homepage Sections
-- Dynamic sections of the homepage (hero cards, features grid, etc.)
-- --------------------------------------------------------------------------

create table if not exists public.homepage_sections (
  id          uuid         primary key default gen_random_uuid(),
  section_key varchar(100) not null,
  title       varchar(255),
  subtitle    varchar(255),
  is_active   boolean      not null default true,
  sort_order  integer      not null default 0,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create unique index idx_homepage_sections_key on public.homepage_sections (section_key) where deleted_at is null;

create index idx_homepage_sections_active on public.homepage_sections (is_active);
create index idx_homepage_sections_sort_order on public.homepage_sections (sort_order);
create index idx_homepage_sections_deleted_at on public.homepage_sections (deleted_at);

create trigger trg_homepage_sections_updated_at
  before update on public.homepage_sections
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 6. Homepage Section Items
-- Individual items within a homepage section (e.g., feature cards).
-- --------------------------------------------------------------------------

create table if not exists public.homepage_section_items (
  id          uuid         primary key default gen_random_uuid(),
  section_id  uuid         not null references public.homepage_sections(id) on delete cascade,
  item_key    varchar(100),
  title       varchar(255) not null,
  description text,
  icon        varchar(100),
  link        varchar(500),
  sort_order  integer      not null default 0,
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create unique index idx_section_items_key on public.homepage_section_items (section_id, item_key) where deleted_at is null;

create index idx_section_items_section_id on public.homepage_section_items (section_id);
create index idx_section_items_active on public.homepage_section_items (is_active);
create index idx_section_items_sort_order on public.homepage_section_items (sort_order);
create index idx_section_items_deleted_at on public.homepage_section_items (deleted_at);

create trigger trg_homepage_section_items_updated_at
  before update on public.homepage_section_items
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 7. Public Settings
-- Configurable site-wide settings exposed via API.
-- --------------------------------------------------------------------------

create table if not exists public.public_settings (
  id          uuid         primary key default gen_random_uuid(),
  key         varchar(100) not null,
  value       text         not null,
  type        varchar(50)  not null default 'string',
  description text,
  is_public   boolean      not null default false,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create unique index idx_public_settings_key on public.public_settings (key) where deleted_at is null;

create index idx_public_settings_public on public.public_settings (is_public);
create index idx_public_settings_deleted_at on public.public_settings (deleted_at);

alter table public.public_settings add constraint chk_public_settings_type
  check (type in ('string', 'text', 'boolean', 'json', 'email', 'phone', 'url'));

create trigger trg_public_settings_updated_at
  before update on public.public_settings
  for each row
  execute function public.handle_updated_at();


-- Clean up any previously created policies for idempotent re-runs
do $$
begin
  drop policy if exists "Public can read active partners" on public.partners;
  drop policy if exists "Editor can create partners" on public.partners;
  drop policy if exists "Editor can update partners" on public.partners;
  drop policy if exists "Admin can soft-delete partners" on public.partners;
  drop policy if exists "Company can read own partner tasks" on public.partner_tasks;
  drop policy if exists "Public can read tasks of active partners" on public.partner_tasks;
  drop policy if exists "Editor can create tasks" on public.partner_tasks;
  drop policy if exists "Editor can update tasks" on public.partner_tasks;
  drop policy if exists "Editor can delete tasks" on public.partner_tasks;
  drop policy if exists "Public can read active categories" on public.categories;
  drop policy if exists "Editor can create categories" on public.categories;
  drop policy if exists "Editor can update categories" on public.categories;
  drop policy if exists "Editor can delete categories" on public.categories;
  drop policy if exists "Public can read homepage stats" on public.homepage_stats;
  drop policy if exists "Editor can create homepage stats" on public.homepage_stats;
  drop policy if exists "Editor can update homepage stats" on public.homepage_stats;
  drop policy if exists "Editor can delete homepage stats" on public.homepage_stats;
  drop policy if exists "Public can read active homepage sections" on public.homepage_sections;
  drop policy if exists "Editor can create sections" on public.homepage_sections;
  drop policy if exists "Editor can update sections" on public.homepage_sections;
  drop policy if exists "Editor can delete sections" on public.homepage_sections;
  drop policy if exists "Public can read active section items" on public.homepage_section_items;
  drop policy if exists "Editor can create section items" on public.homepage_section_items;
  drop policy if exists "Editor can update section items" on public.homepage_section_items;
  drop policy if exists "Editor can delete section items" on public.homepage_section_items;
  drop policy if exists "Public can read public settings" on public.public_settings;
  drop policy if exists "Admin can read all settings" on public.public_settings;
  drop policy if exists "Admin can create settings" on public.public_settings;
  drop policy if exists "Admin can update settings" on public.public_settings;
  drop policy if exists "Admin can delete settings" on public.public_settings;
end;
$$;

-- --------------------------------------------------------------------------
-- 8. Row-Level Security (RLS)
-- --------------------------------------------------------------------------

-- 8.1 Partners
alter table public.partners enable row level security;

create policy "Public can read active partners"
  on public.partners for select
  using (status = 'active' and deleted_at is null);

create policy "Editor can create partners"
  on public.partners for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update partners"
  on public.partners for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete partners"
  on public.partners for update
  using (auth_role() in ('super_admin', 'admin'));

-- 8.2 Partner Tasks
alter table public.partner_tasks enable row level security;

create policy "Company can read own partner tasks"
  on public.partner_tasks for select
  using (
    partner_id in (
      select p.id from public.partners p
      where p.client_profile_id = auth.uid()
    )
    and deleted_at is null
  );

create policy "Public can read tasks of active partners"
  on public.partner_tasks for select
  using (
    partner_id in (
      select id from public.partners
      where status = 'active' and deleted_at is null
    )
    and deleted_at is null
  );

create policy "Editor can create tasks"
  on public.partner_tasks for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update tasks"
  on public.partner_tasks for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can delete tasks"
  on public.partner_tasks for delete
  using (auth_role() in ('super_admin', 'admin', 'editor'));

-- 8.3 Categories
alter table public.categories enable row level security;

create policy "Public can read active categories"
  on public.categories for select
  using (deleted_at is null);

create policy "Editor can create categories"
  on public.categories for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update categories"
  on public.categories for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can delete categories"
  on public.categories for delete
  using (auth_role() in ('super_admin', 'admin', 'editor'));

-- 8.4 Homepage Stats
alter table public.homepage_stats enable row level security;

create policy "Public can read homepage stats"
  on public.homepage_stats for select
  using (deleted_at is null);

create policy "Editor can create homepage stats"
  on public.homepage_stats for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update homepage stats"
  on public.homepage_stats for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can delete homepage stats"
  on public.homepage_stats for delete
  using (auth_role() in ('super_admin', 'admin', 'editor'));

-- 8.5 Homepage Sections
alter table public.homepage_sections enable row level security;

create policy "Public can read active homepage sections"
  on public.homepage_sections for select
  using (is_active = true and deleted_at is null);

create policy "Editor can create sections"
  on public.homepage_sections for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update sections"
  on public.homepage_sections for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can delete sections"
  on public.homepage_sections for delete
  using (auth_role() in ('super_admin', 'admin', 'editor'));

-- 8.6 Homepage Section Items
alter table public.homepage_section_items enable row level security;

create policy "Public can read active section items"
  on public.homepage_section_items for select
  using (
    is_active = true
    and section_id in (
      select id from public.homepage_sections
      where is_active = true and deleted_at is null
    )
    and deleted_at is null
  );

create policy "Editor can create section items"
  on public.homepage_section_items for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update section items"
  on public.homepage_section_items for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can delete section items"
  on public.homepage_section_items for delete
  using (auth_role() in ('super_admin', 'admin', 'editor'));

-- 8.7 Public Settings
alter table public.public_settings enable row level security;

create policy "Public can read public settings"
  on public.public_settings for select
  using (is_public = true and deleted_at is null);

create policy "Admin can read all settings"
  on public.public_settings for select
  using (auth_role() in ('super_admin', 'admin'));

create policy "Admin can create settings"
  on public.public_settings for insert
  with check (auth_role() in ('super_admin', 'admin'));

create policy "Admin can update settings"
  on public.public_settings for update
  using (auth_role() in ('super_admin', 'admin'));

create policy "Admin can delete settings"
  on public.public_settings for delete
  using (auth_role() in ('super_admin', 'admin'));

-- --------------------------------------------------------------------------
-- 9. Views
-- --------------------------------------------------------------------------

-- Active categories grouped by type for public API
create or replace view public.active_categories_view as
select
  c.type,
  c.key,
  c.label,
  c.icon,
  c.sort_order
from public.categories c
where c.deleted_at is null
order by c.type, c.sort_order;

-- Featured active partners for public homepage
create or replace view public.featured_partners_view as
select
  p.id,
  p.name,
  p.slug,
  p.sphere,
  p.logo,
  p.direction,
  p.sort_order
from public.partners p
where p.is_featured = true
  and p.status = 'active'
  and p.deleted_at is null
order by p.sort_order;

-- Aggregated homepage data combining stats, sections, and settings
create or replace view public.public_homepage_view as
select
  jsonb_build_object(
    'stats', (
      select jsonb_agg(jsonb_build_object(
        'key', hs.key,
        'value', hs.value,
        'label', hs.label
      ) order by hs.sort_order)
      from public.homepage_stats hs
      where hs.deleted_at is null
    ),
    'sections', (
      select jsonb_agg(
        jsonb_build_object(
          'section_key', s.section_key,
          'title', s.title,
          'subtitle', s.subtitle,
          'items', (
            select jsonb_agg(
              jsonb_build_object(
                'item_key', si.item_key,
                'title', si.title,
                'description', si.description,
                'icon', si.icon,
                'link', si.link
              ) order by si.sort_order
            )
            from public.homepage_section_items si
            where si.section_id = s.id
              and si.is_active = true
              and si.deleted_at is null
          )
        ) order by s.sort_order
      )
      from public.homepage_sections s
      where s.is_active = true and s.deleted_at is null
    ),
    'settings', (
      select jsonb_object_agg(ps.key, ps.value)
      from public.public_settings ps
      where ps.is_public = true and ps.deleted_at is null
    )
  ) as homepage_data;

-- --------------------------------------------------------------------------
-- 10. Seed Data — Categories
-- --------------------------------------------------------------------------

-- Blogger niches (matches src/lib/bloggers.ts)
insert into public.categories (key, type, label, icon, sort_order) values
  ('all',          'blogger', 'Barchasi',             'grid',       0),
  ('fermerlik',    'blogger', 'Fermerlik',            'sprout',     1),
  ('issiqxona',    'blogger', 'Issiqxona',            'building',   2),
  ('bogdorchilik', 'blogger', 'Bog''dorchilik',        'tree',       3),
  ('chorvachilik', 'blogger', 'Chorvachilik',          'cow',        4),
  ('texnologiya',  'blogger', 'Agro texnologiya',      'cpu',        5),
  ('ekologik',     'blogger', 'Ekologik dehqonchilik', 'shield',     6),
  ('biznes',       'blogger', 'Agro biznes',           'briefcase',  7),
  ('boshqalar',    'blogger', 'Boshqalar',             'dots',       8)
on conflict (type, key) where deleted_at is null do nothing;

-- News categories (matches src/lib/news.ts)
insert into public.categories (key, type, label, icon, sort_order) values
  ('all',          'news', 'Barcha yangiliklar',    'grid',   0),
  ('texnologiya',  'news', 'Agro texnologiya',      'cpu',    1),
  ('qishloq',      'news', 'Qishloq xo''jaligi',    'sprout', 2),
  ('bozor',        'news', 'Bozor va iqtisodiyot',  'chart',  3),
  ('davlat',       'news', 'Davlat dasturlari',     'doc',    4),
  ('innovatsiya',  'news', 'Innovatsiya',           'bolt',   5),
  ('ekologiya',    'news', 'Ekologiya',             'leaf',   6),
  ('tadqiqotlar',  'news', 'Tadqiqotlar',           'flask',  7),
  ('xalqaro',      'news', 'Xalqaro yangiliklar',   'globe',  8)
on conflict (type, key) where deleted_at is null do nothing;

-- Partner directions (matches src/pages/Partners.tsx)
insert into public.categories (key, type, label, icon, sort_order) values
  ('agro-tech',       'partner', 'Agro texnologiyalar',              'sprout',   1),
  ('fertilizer',      'partner', 'O''g''it va himoya vositalari',   'shield',   2),
  ('machinery',       'partner', 'Qishloq xo''jaligi texnikasi',    'tractor',  3),
  ('education',       'partner', 'Ta''lim va konsultatsiya',        'cap',      4),
  ('media-marketing', 'partner', 'Media va marketing',               'megaphone',5)
on conflict (type, key) where deleted_at is null do nothing;

-- --------------------------------------------------------------------------
-- 11. Seed Data — Homepage Stats
-- Matches the default stats in src/lib/ui.tsx
-- --------------------------------------------------------------------------

insert into public.homepage_stats (key, value, label, sort_order) values
  ('bloggers', '120+',  'Agro blogerlar',         1),
  ('views',    '5M+',   'Oylik ko''rishlar',      2),
  ('partners', '50+',   'Hamkor kompaniyalar',    3),
  ('regions',  '20+',   'Hududlarda faoliyat',    4),
  ('contents', '1000+', 'Yaratilgan kontentlar',  5)
on conflict (key) where deleted_at is null do nothing;

-- --------------------------------------------------------------------------
-- 12. Seed Data — Homepage Sections
-- Matches the hero cards and features grid from src/pages/Home.tsx
-- --------------------------------------------------------------------------

insert into public.homepage_sections (section_key, title, subtitle, is_active, sort_order) values
  ('hero_cards', 'TEZKOR IMKONIYATLAR', null, true, 1),
  ('features',   'BARCHASI BIR PLATFORMADA', null, true, 2)
on conflict (section_key) where deleted_at is null do nothing;

-- Hero cards (5 items matching Home.tsx heroCards)
insert into public.homepage_section_items (section_id, item_key, title, description, icon, sort_order, is_active)
select
  s.id, hc.item_key, hc.title, hc.description, hc.icon, hc.sort_order, true
from public.homepage_sections s
cross join (values
  ('ai-assistant',    'AI ASSISTANT',      'Sun''iy intellekt yordamchisi kontent, tahlil va g''oyalar bilan yordam beradi.', 'brain',  1),
  ('task-manager',    'TASK MANAGER',      'Vazifalarni boshqaring, muddatlar va KPI larni nazorat qiling.',               'task',   2),
  ('contract-center', 'CONTRACT CENTER',   'Elektron shartnomalar, imzo va xavfsiz hamkorlik.',                            'doc',    3),
  ('blogger-rating',  'BLOGER REYTINGI',   'Reyting, baholash va o''sish imkoniyatlari.',                                  'trophy', 4),
  ('media-market',    'MEDIA MARKETPLACE', 'Kampaniyalar, reklama va hamkorlik bozori.',                                   'play',   5)
) as hc(item_key, title, description, icon, sort_order)
where s.section_key = 'hero_cards'
on conflict (section_id, item_key) where deleted_at is null do nothing;

-- Features grid (6 items matching Home.tsx features)
insert into public.homepage_section_items (section_id, item_key, title, description, icon, sort_order, is_active)
select
  s.id, f.item_key, f.title, f.description, f.icon, f.sort_order, true
from public.homepage_sections s
cross join (values
  ('ai-tech',         'AI TEXNOLOGIYALAR',  'AI yordamida kontent yaratish, tahlil qilish va rivojlantirish.', 'robot',  1),
  ('smart-farming',   'SMART FARMING',      'Zamonaviy texnologiyalar va innovatsion yechimlar.',              'sprout', 2),
  ('education',       'BILIM VA TA''LIM',   'Agro bilimlar, kurslar va professional ta''lim.',                 'book',   3),
  ('media-resources', 'MEDIA RESURSLAR',    'Video, maqola, intervyu va foydali kontentlar.',                 'media',  4),
  ('analytics',       'ANALITIKA',          'Ma''lumotlar tahlili, statistika va samaradorlik o''lchovi.',     'chart',  5),
  ('growth-income',   'O''SISH VA DAROMAD', 'Reyting, imkoniyat va daromad manbalari.',                       'send',   6)
) as f(item_key, title, description, icon, sort_order)
where s.section_key = 'features'
on conflict (section_id, item_key) where deleted_at is null do nothing;

-- --------------------------------------------------------------------------
-- 13. Seed Data — Public Settings
-- --------------------------------------------------------------------------

insert into public.public_settings (key, value, type, description, is_public) values
  ('site_name',        'Agro Alliance',          'string', 'Platform name',                            true),
  ('site_description', 'Agro bloggerlar, fermerlar va kompaniyalarni birlashtiruvchi innovatsion ekotizim.', 'text', 'SEO meta description', true),
  ('contact_phone',    '+998 90 123 45 67',      'phone',  'Main contact phone number',                true),
  ('contact_email',    'info@agroalliance.uz',   'email',  'Main contact email address',               true),
  ('contact_address',  'Toshkent, Yunusobod tumani, Amir Temur ko''chasi, 123-uy', 'text', 'Office address', true),
  ('working_hours',    'Dushanba - Shanba, 09:00 - 18:00', 'string', 'Working hours', true),
  ('telegram_url',     'https://t.me/agroalliance', 'url', 'Telegram channel URL',                    true),
  ('instagram_url',    'https://instagram.com/agroalliance', 'url', 'Instagram profile URL',            true),
  ('youtube_url',      'https://youtube.com/@agroalliance', 'url', 'YouTube channel URL',               true),
  ('facebook_url',     'https://facebook.com/agroalliance', 'url', 'Facebook page URL',                 true),
  ('logo_path',        '/logo.webp',             'string', 'Site logo image path',                      true),
  ('mascot_path',      '/mascot.webp',           'string', 'Default mascot image path',                 true),
  ('hero_bg_path',     '/hero-bg.webp',          'string', 'Hero section background image path',        true)
on conflict (key) where deleted_at is null do nothing;

-- --------------------------------------------------------------------------
-- 14. Seed Data — Partners (Demo)
-- --------------------------------------------------------------------------

insert into public.partners (name, slug, sphere, direction, status, is_featured, sort_order) values
  ('Syngenta',                'syngenta',                'O''g''it va himoya vositalari',   'fertilizer',      'active', true,  1),
  ('Bayer',                   'bayer',                   'Agro kimyo va urug''lar',          'fertilizer',      'active', true,  2),
  ('Corteva',                 'corteva',                 'Qishloq xo''jaligi yechimlari',    'fertilizer',      'active', true,  3),
  ('Yara',                    'yara',                    'Mineral o''g''itlar',              'fertilizer',      'active', true,  4),
  ('John Deere',              'john-deere',              'Qishloq xo''jaligi texnikasi',     'machinery',       'active', true,  5),
  ('Case IH',                 'case-ih',                 'Traktor va kombaynlar',            'machinery',       'active', true,  6),
  ('Massey Ferguson',         'massey-ferguson',         'Qishloq xo''jaligi texnikasi',     'machinery',       'active', true,  7),
  ('UZ-GROW',                 'uz-grow',                 'Agro texnologiyalar',              'agro-tech',       'active', true,  8),
  ('AGRO MARKET',             'agro-market',             'Agro savdo platformasi',           'agro-tech',       'active', true,  9),
  ('FMC',                     'fmc',                     'O''simliklarni himoya qilish',      'fertilizer',      'active', true,  10),
  ('ADAMA',                   'adama',                   'Agro kimyo',                       'fertilizer',      'active', true,  11),
  ('BASF',                    'basf',                    'Agro kimyo va urug''lar',           'fertilizer',      'active', true,  12),
  ('Valley',                  'valley',                  'Sug''orish tizimlari',             'agro-tech',       'active', true,  13),
  ('Netafim',                 'netafim',                 'Tomchilatib sug''orish',            'agro-tech',       'active', true,  14),
  ('Avgust',                  'avgust',                  'O''simliklarni himoya qilish',      'fertilizer',      'active', false, 15)
on conflict (slug) where deleted_at is null do nothing;
