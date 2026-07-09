-- ============================================================================
-- Bloggers Core Module
-- Tables: bloggers, blogger_services, blogger_achievements,
--         blogger_availability, blogger_regions, blogger_specializations
--
-- Phase 1.4 — Bloggers data layer
-- ============================================================================

-- Ensure pgcrypto is available for seed helper functions
create extension if not exists pgcrypto schema public;

-- --------------------------------------------------------------------------
-- 1. Bloggers (extends profiles)
-- --------------------------------------------------------------------------

create table if not exists public.bloggers (
  id               uuid         primary key references public.profiles(id) on delete cascade,
  slug             varchar(255) not null,
  experience_years integer      not null default 0,
  rating           decimal(3,1) not null default 0.0,
  is_featured      boolean      not null default false,
  is_verified      boolean      not null default false,
  cover            varchar(500),
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now(),
  deleted_at       timestamptz,
  created_by       uuid         references public.profiles(id) on delete set null,
  updated_by       uuid         references public.profiles(id) on delete set null,
  deleted_by       uuid         references public.profiles(id) on delete set null
);

create unique index idx_bloggers_slug on public.bloggers (slug) where deleted_at is null;

create index idx_bloggers_rating on public.bloggers (rating desc);
create index idx_bloggers_is_featured on public.bloggers (is_featured) where is_featured = true;
create index idx_bloggers_is_verified on public.bloggers (is_verified) where is_verified = true;
create index idx_bloggers_deleted_at on public.bloggers (deleted_at);

alter table public.bloggers add constraint chk_bloggers_rating
  check (rating >= 0.0 and rating <= 5.0);

create trigger trg_bloggers_updated_at
  before update on public.bloggers
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 2. Blogger Services
-- --------------------------------------------------------------------------

create table if not exists public.blogger_services (
  id          uuid         primary key default gen_random_uuid(),
  blogger_id  uuid         not null references public.bloggers(id) on delete cascade,
  title       varchar(255) not null,
  description text,
  sort_order  integer      not null default 0,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create index idx_blogger_services_blogger_id on public.blogger_services (blogger_id);
create index idx_blogger_services_sort_order on public.blogger_services (sort_order);
create index idx_blogger_services_deleted_at on public.blogger_services (deleted_at);

create trigger trg_blogger_services_updated_at
  before update on public.blogger_services
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 3. Blogger Achievements
-- --------------------------------------------------------------------------

create table if not exists public.blogger_achievements (
  id          uuid         primary key default gen_random_uuid(),
  blogger_id  uuid         not null references public.bloggers(id) on delete cascade,
  title       varchar(255) not null,
  subtitle    varchar(255),
  icon        varchar(100),
  sort_order  integer      not null default 0,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create index idx_blogger_achievements_blogger_id on public.blogger_achievements (blogger_id);
create index idx_blogger_achievements_sort_order on public.blogger_achievements (sort_order);
create index idx_blogger_achievements_deleted_at on public.blogger_achievements (deleted_at);

create trigger trg_blogger_achievements_updated_at
  before update on public.blogger_achievements
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 4. Blogger Availability
-- --------------------------------------------------------------------------

create table if not exists public.blogger_availability (
  id            uuid         primary key default gen_random_uuid(),
  blogger_id    uuid         not null references public.bloggers(id) on delete cascade,
  status        varchar(20)  not null default 'open',
  available_from date,
  available_to  date,
  notes         text,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  deleted_at    timestamptz,
  created_by    uuid         references public.profiles(id) on delete set null,
  updated_by    uuid         references public.profiles(id) on delete set null,
  deleted_by    uuid         references public.profiles(id) on delete set null
);

create unique index idx_blogger_availability_blogger_id on public.blogger_availability (blogger_id) where deleted_at is null;

create index idx_blogger_availability_status on public.blogger_availability (status);
create index idx_blogger_availability_deleted_at on public.blogger_availability (deleted_at);

alter table public.blogger_availability add constraint chk_availability_status
  check (status in ('open', 'busy', 'vacation', 'unavailable'));

create trigger trg_blogger_availability_updated_at
  before update on public.blogger_availability
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 5. Blogger Regions (multi-region support)
-- --------------------------------------------------------------------------

create table if not exists public.blogger_regions (
  id          uuid         primary key default gen_random_uuid(),
  blogger_id  uuid         not null references public.bloggers(id) on delete cascade,
  region      varchar(255) not null,
  sort_order  integer      not null default 0,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create unique index idx_blogger_regions_unique on public.blogger_regions (blogger_id, region) where deleted_at is null;

create index idx_blogger_regions_blogger_id on public.blogger_regions (blogger_id);
create index idx_blogger_regions_region on public.blogger_regions (region);
create index idx_blogger_regions_deleted_at on public.blogger_regions (deleted_at);

create trigger trg_blogger_regions_updated_at
  before update on public.blogger_regions
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 6. Blogger Specializations (multiple niches per blogger)
-- --------------------------------------------------------------------------

create table if not exists public.blogger_specializations (
  id                 uuid         primary key default gen_random_uuid(),
  blogger_id         uuid         not null references public.bloggers(id) on delete cascade,
  specialization_key varchar(100) not null,
  sort_order         integer      not null default 0,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),
  deleted_at         timestamptz,
  created_by         uuid         references public.profiles(id) on delete set null,
  updated_by         uuid         references public.profiles(id) on delete set null,
  deleted_by         uuid         references public.profiles(id) on delete set null
);

create unique index idx_blogger_specializations_unique
  on public.blogger_specializations (blogger_id, specialization_key) where deleted_at is null;

create index idx_blogger_specializations_blogger_id on public.blogger_specializations (blogger_id);
create index idx_blogger_specializations_key on public.blogger_specializations (specialization_key);
create index idx_blogger_specializations_deleted_at on public.blogger_specializations (deleted_at);

create trigger trg_blogger_specializations_updated_at
  before update on public.blogger_specializations
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 7. Row-Level Security (RLS)
-- --------------------------------------------------------------------------

-- Clean up any previously created policies for idempotent re-runs
do $$
begin
  drop policy if exists "Public can read active verified bloggers" on public.bloggers;
  drop policy if exists "Blogger can read own profile" on public.bloggers;
  drop policy if exists "Editor can read all bloggers" on public.bloggers;
  drop policy if exists "Blogger can update own profile" on public.bloggers;
  drop policy if exists "Editor can manage bloggers" on public.bloggers;
  drop policy if exists "Editor can update bloggers" on public.bloggers;
  drop policy if exists "Admin can manage bloggers" on public.bloggers;
  drop policy if exists "Public can read services of active bloggers" on public.blogger_services;
  drop policy if exists "Blogger can create own services" on public.blogger_services;
  drop policy if exists "Blogger can update own services" on public.blogger_services;
  drop policy if exists "Blogger can delete own services" on public.blogger_services;
  drop policy if exists "Editor can create any services" on public.blogger_services;
  drop policy if exists "Editor can update any services" on public.blogger_services;
  drop policy if exists "Editor can delete any services" on public.blogger_services;
  drop policy if exists "Public can read achievements" on public.blogger_achievements;
  drop policy if exists "Blogger can create own achievements" on public.blogger_achievements;
  drop policy if exists "Blogger can update own achievements" on public.blogger_achievements;
  drop policy if exists "Blogger can delete own achievements" on public.blogger_achievements;
  drop policy if exists "Editor can manage any achievements" on public.blogger_achievements;
  drop policy if exists "Public can read availability" on public.blogger_availability;
  drop policy if exists "Blogger can create own availability" on public.blogger_availability;
  drop policy if exists "Blogger can update own availability" on public.blogger_availability;
  drop policy if exists "Blogger can delete own availability" on public.blogger_availability;
  drop policy if exists "Editor can manage any availability" on public.blogger_availability;
  drop policy if exists "Public can read regions" on public.blogger_regions;
  drop policy if exists "Blogger can create own regions" on public.blogger_regions;
  drop policy if exists "Blogger can update own regions" on public.blogger_regions;
  drop policy if exists "Blogger can delete own regions" on public.blogger_regions;
  drop policy if exists "Editor can manage any regions" on public.blogger_regions;
  drop policy if exists "Public can read specializations" on public.blogger_specializations;
  drop policy if exists "Blogger can create own specializations" on public.blogger_specializations;
  drop policy if exists "Blogger can update own specializations" on public.blogger_specializations;
  drop policy if exists "Blogger can delete own specializations" on public.blogger_specializations;
  drop policy if exists "Editor can manage any specializations" on public.blogger_specializations;
end;
$$;

-- 7.1 Bloggers
alter table public.bloggers enable row level security;

create policy "Public can read active verified bloggers"
  on public.bloggers for select
  using (
    is_verified = true
    and deleted_at is null
    and id in (
      select p.id from public.profiles p
      where p.status = 'active' and p.deleted_at is null
    )
  );

create policy "Blogger can read own profile"
  on public.bloggers for select
  using (id = auth.uid());

create policy "Editor can read all bloggers"
  on public.bloggers for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Blogger can update own profile"
  on public.bloggers for update
  using (id = auth.uid());

create policy "Editor can manage bloggers"
  on public.bloggers for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update bloggers"
  on public.bloggers for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can manage bloggers"
  on public.bloggers for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 7.2 Blogger Services
alter table public.blogger_services enable row level security;

create policy "Public can read services of active bloggers"
  on public.blogger_services for select
  using (
    deleted_at is null
    and blogger_id in (
      select b.id from public.bloggers b
      join public.profiles p on p.id = b.id
      where b.is_verified = true and p.status = 'active' and b.deleted_at is null
    )
  );

create policy "Blogger can create own services"
  on public.blogger_services for insert
  with check (
    blogger_id = auth.uid()
    and auth_role() = 'blogger'
  );

create policy "Blogger can update own services"
  on public.blogger_services for update
  using (blogger_id = auth.uid());

create policy "Blogger can delete own services"
  on public.blogger_services for delete
  using (blogger_id = auth.uid());

create policy "Editor can create any services"
  on public.blogger_services for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update any services"
  on public.blogger_services for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can delete any services"
  on public.blogger_services for delete
  using (auth_role() in ('super_admin', 'admin', 'editor'));

-- 7.3 Blogger Achievements
alter table public.blogger_achievements enable row level security;

create policy "Public can read achievements"
  on public.blogger_achievements for select
  using (deleted_at is null);

create policy "Blogger can create own achievements"
  on public.blogger_achievements for insert
  with check (blogger_id = auth.uid());

create policy "Blogger can update own achievements"
  on public.blogger_achievements for update
  using (blogger_id = auth.uid());

create policy "Blogger can delete own achievements"
  on public.blogger_achievements for delete
  using (blogger_id = auth.uid());

create policy "Editor can manage any achievements"
  on public.blogger_achievements for all
  using (auth_role() in ('super_admin', 'admin', 'editor'));

-- 7.4 Blogger Availability
alter table public.blogger_availability enable row level security;

create policy "Public can read availability"
  on public.blogger_availability for select
  using (deleted_at is null);

create policy "Blogger can create own availability"
  on public.blogger_availability for insert
  with check (blogger_id = auth.uid());

create policy "Blogger can update own availability"
  on public.blogger_availability for update
  using (blogger_id = auth.uid());

create policy "Blogger can delete own availability"
  on public.blogger_availability for delete
  using (blogger_id = auth.uid());

create policy "Editor can manage any availability"
  on public.blogger_availability for all
  using (auth_role() in ('super_admin', 'admin', 'editor'));

-- 7.5 Blogger Regions
alter table public.blogger_regions enable row level security;

create policy "Public can read regions"
  on public.blogger_regions for select
  using (deleted_at is null);

create policy "Blogger can create own regions"
  on public.blogger_regions for insert
  with check (blogger_id = auth.uid());

create policy "Blogger can update own regions"
  on public.blogger_regions for update
  using (blogger_id = auth.uid());

create policy "Blogger can delete own regions"
  on public.blogger_regions for delete
  using (blogger_id = auth.uid());

create policy "Editor can manage any regions"
  on public.blogger_regions for all
  using (auth_role() in ('super_admin', 'admin', 'editor'));

-- 7.6 Blogger Specializations
alter table public.blogger_specializations enable row level security;

create policy "Public can read specializations"
  on public.blogger_specializations for select
  using (deleted_at is null);

create policy "Blogger can create own specializations"
  on public.blogger_specializations for insert
  with check (blogger_id = auth.uid());

create policy "Blogger can update own specializations"
  on public.blogger_specializations for update
  using (blogger_id = auth.uid());

create policy "Blogger can delete own specializations"
  on public.blogger_specializations for delete
  using (blogger_id = auth.uid());

create policy "Editor can manage any specializations"
  on public.blogger_specializations for all
  using (auth_role() in ('super_admin', 'admin', 'editor'));

-- --------------------------------------------------------------------------
-- 8. Views
-- --------------------------------------------------------------------------

create or replace view public.featured_bloggers_view as
select
  b.id,
  b.slug,
  p.name,
  p.avatar as photo,
  b.cover,
  b.rating,
  b.experience_years,
  b.is_verified,
  array_agg(distinct bs.specialization_key) as specializations,
  array_agg(distinct br.region) as regions
from public.bloggers b
join public.profiles p on p.id = b.id
left join public.blogger_specializations bs on bs.blogger_id = b.id and bs.deleted_at is null
left join public.blogger_regions br on br.blogger_id = b.id and br.deleted_at is null
where b.is_featured = true
  and b.is_verified = true
  and b.deleted_at is null
  and p.status = 'active'
  and p.deleted_at is null
group by b.id, p.id, b.slug, p.name, p.avatar, b.cover, b.rating, b.experience_years, b.is_verified
order by b.rating desc;

create or replace view public.available_bloggers_view as
select
  b.id,
  b.slug,
  p.name,
  p.avatar as photo,
  b.rating,
  ba.status as availability,
  ba.available_from,
  ba.available_to
from public.bloggers b
join public.profiles p on p.id = b.id
join public.blogger_availability ba on ba.blogger_id = b.id
where ba.status = 'open'
  and b.is_verified = true
  and b.deleted_at is null
  and p.status = 'active'
  and p.deleted_at is null
  and ba.deleted_at is null
order by b.rating desc;

create or replace view public.top_rated_bloggers_view as
select
  b.id,
  b.slug,
  p.name,
  p.avatar as photo,
  b.cover,
  b.rating,
  b.experience_years,
  b.is_verified,
  array_agg(distinct bs.specialization_key) as specializations,
  array_agg(distinct br.region) as regions
from public.bloggers b
join public.profiles p on p.id = b.id
left join public.blogger_specializations bs on bs.blogger_id = b.id and bs.deleted_at is null
left join public.blogger_regions br on br.blogger_id = b.id and br.deleted_at is null
where b.is_verified = true
  and b.deleted_at is null
  and p.status = 'active'
  and p.deleted_at is null
group by b.id, p.id, b.slug, p.name, p.avatar, b.cover, b.rating, b.experience_years, b.is_verified
order by b.rating desc
limit 50;

-- --------------------------------------------------------------------------
-- 9. Seed Helper Function
-- --------------------------------------------------------------------------

create or replace function public.seed_new_blogger(
  p_email     text,
  p_name      text,
  p_password  text,
  p_slug      text,
  p_region    text,
  p_spec_key  text,
  p_rating    decimal,
  p_featured  boolean,
  p_exp_years integer,
  p_bio       text,
  p_services  text[],
  p_achievements jsonb
) returns uuid
language plpgsql
security definer
  set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_role_id uuid;
  v_tag     text;
begin
  v_user_id := gen_random_uuid();

  insert into auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, created_at, updated_at, raw_user_meta_data)
  values (
    v_user_id,
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(), now(),
    jsonb_build_object('name', p_name)
  );

  select id into v_role_id from public.roles where name = 'blogger';

  update public.profiles
  set name = p_name, status = 'active'
  where id = v_user_id;

  insert into public.user_roles (profile_id, role_id)
  values (v_user_id, v_role_id);

  insert into public.bloggers (id, slug, experience_years, rating, is_featured, is_verified, cover, created_by)
  values (v_user_id, p_slug, p_exp_years, p_rating, p_featured, true, null, v_user_id);

  insert into public.blogger_regions (blogger_id, region, sort_order)
  values (v_user_id, p_region, 1);

  insert into public.blogger_specializations (blogger_id, specialization_key, sort_order)
  values (v_user_id, p_spec_key, 1);

  if p_services is not null then
    for i in 1 .. array_length(p_services, 1) loop
      insert into public.blogger_services (blogger_id, title, sort_order)
      values (v_user_id, p_services[i], i);
    end loop;
  end if;

  if p_achievements is not null then
    insert into public.blogger_achievements (blogger_id, title, subtitle, icon, sort_order)
    select v_user_id, a.elem->>'title', a.elem->>'subtitle', a.elem->>'icon', a.idx::integer
    from jsonb_array_elements(p_achievements) with ordinality as a(elem, idx);
  end if;

  return v_user_id;
end;
$$;

-- --------------------------------------------------------------------------
-- 10. Seed Data — Demo Bloggers
-- Matches the mock data in src/lib/bloggers.ts exactly
-- --------------------------------------------------------------------------

-- Elyor — issiqxona, top blogger
select public.seed_new_blogger(
  'elyor@agroalliance.uz', 'Fermer Elyor', 'password123',
  'elyor', 'Toshkent viloyati', 'issiqxona',
  4.9, true, 3,
  '3 yildan beri issiqxona va fermerlik sohasida kontent yarataman.',
  array['Reklama integratsiya', 'Mahsulot review', 'Brend bilan kollaboratsiya', 'Farm tur va vlog'],
  '[{"title":"TOP Bloger","subtitle":"2024","icon":"trophy"},{"title":"Eng faol fermer","subtitle":"bloger 2023","icon":"shield"}]'::jsonb
);

-- Aziz — bogdorchilik
select public.seed_new_blogger(
  'aziz@agroalliance.uz', 'Bog''bon Aziz', 'password123',
  'aziz', 'Farg''ona viloyati', 'bogdorchilik',
  4.7, false, 5,
  'Bog''dorchilik va mevali daraxtlar bo''yicha 5 yillik tajriba.',
  array['Reklama integratsiya', 'Mahsulot review', 'Brend bilan kollaboratsiya'],
  '[{"title":"Eng yaxshi bog''bon","subtitle":"2023","icon":"trophy"}]'::jsonb
);

-- Akmal — chorvachilik
select public.seed_new_blogger(
  'akmal@agroalliance.uz', 'Chorvador Akmal', 'password123',
  'chorva', 'Samarqand viloyati', 'chorvachilik',
  4.5, false, 7,
  'Chorvachilik va naslchilik sohasida 7 yillik tajriba.',
  array['Reklama integratsiya', 'Konsultatsiya', 'Brend bilan kollaboratsiya'],
  '[{"title":"Eng yaxshi chorvador","subtitle":"2023","icon":"trophy"},{"title":"Naslchilik bo''yicha ekspert","subtitle":"2024","icon":"shield"}]'::jsonb
);

-- Agrotech — texnologiya, top blogger
select public.seed_new_blogger(
  'agrotech@agroalliance.uz', 'Agro Texnik', 'password123',
  'agrotech', 'Toshkent shahri', 'texnologiya',
  4.9, true, 4,
  'Agro texnologiyalar va smart dehqonchilik bo''yicha kontent yarataman.',
  array['Reklama integratsiya', 'Mahsulot review', 'Brend bilan kollaboratsiya', 'Tech review'],
  '[{"title":"TOP Bloger","subtitle":"2024","icon":"trophy"},{"title":"Texnologiya elchisi","subtitle":"2023","icon":"cpu"}]'::jsonb
);

-- Eko Fermer — ekologik
select public.seed_new_blogger(
  'eko@agroalliance.uz', 'Eko Fermer', 'password123',
  'ecofermer', 'Buxoro viloyati', 'ekologik',
  4.3, false, 6,
  'Organik dehqonchilik va ekologik qishloq xo''jaligi bo''yicha mutaxassis.',
  array['Reklama integratsiya', 'Konsultatsiya'],
  '[{"title":"Eko fermer","subtitle":"2024","icon":"shield"}]'::jsonb
);

-- Agro Biznesmen — biznes
select public.seed_new_blogger(
  'biznes@agroalliance.uz', 'Agro Biznesmen', 'password123',
  'agrobiznes', 'Toshkent shahri', 'biznes',
  4.8, false, 8,
  'Agro biznes va investitsiya loyihalari bo''yicha tahlil va sharhlar.',
  array['Konsultatsiya', 'Brend bilan kollaboratsiya', 'Biznes tahlil'],
  '[{"title":"Biznes ekspert","subtitle":"2024","icon":"briefcase"},{"title":"Eng yaxshi tahlilchi","subtitle":"2023","icon":"chart"}]'::jsonb
);

-- Issiqxona Ustasi — issiqxona
select public.seed_new_blogger(
  'issiqxona@agroalliance.uz', 'Issiqxona Ustasi', 'password123',
  'issiqxona', 'Andijon viloyati', 'issiqxona',
  4.6, false, 10,
  'Issiqxona qurilishi va pomidor yetishtirish bo''yicha 10 yillik tajriba.',
  array['Reklama integratsiya', 'Mahsulot review', 'Konsultatsiya', 'Farm tur'],
  '[{"title":"Issiqxona bo''yicha ekspert","subtitle":"2024","icon":"building"}]'::jsonb
);

-- Dehqon Ota — fermerlik
select public.seed_new_blogger(
  'dehqon@agroalliance.uz', 'Dehqon Ota', 'password123',
  'dehqon', 'Qashqadaryo viloyati', 'fermerlik',
  4.2, false, 15,
  'An''anaviy dehqonchilik va qishloq xo''jaligi bo''yicha katta tajriba.',
  array['Konsultatsiya', 'Farm tur'],
  '[{"title":"Fermerlik faxriysi","subtitle":"2024","icon":"shield"}]'::jsonb
);

-- Smart Agro — texnologiya
select public.seed_new_blogger(
  'smart@agroalliance.uz', 'Smart Agro', 'password123',
  'smartagro', 'Namangan viloyati', 'texnologiya',
  4.7, false, 3,
  'Dron texnologiyalari va smart agro yechimlar bo''yicha kontent.',
  array['Reklama integratsiya', 'Mahsulot review', 'Tech review', 'Brend bilan kollaboratsiya'],
  '[{"title":"Innovatsion yondashuv","subtitle":"2024","icon":"cpu"},{"title":"Dron bo''yicha ekspert","subtitle":"2023","icon":"bolt"}]'::jsonb
);
