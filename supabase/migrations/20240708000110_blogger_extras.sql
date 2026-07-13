-- ============================================================================
-- Blogger Extras — Brands & Gallery
-- ============================================================================

create table if not exists public.blogger_brands (
  id          uuid         primary key default gen_random_uuid(),
  blogger_id  uuid         not null references public.bloggers(id) on delete cascade,
  name        varchar(255) not null,
  logo_url    varchar(500),
  sort_order  integer      not null default 0,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create index idx_blogger_brands_blogger on public.blogger_brands (blogger_id);
create index idx_blogger_brands_deleted_at on public.blogger_brands (deleted_at);

create trigger trg_blogger_brands_updated_at
  before update on public.blogger_brands
  for each row
  execute function public.handle_updated_at();

alter table public.blogger_brands enable row level security;

create policy "Public can read brands"
  on public.blogger_brands for select
  using (deleted_at is null);

create policy "Blogger can read own brands"
  on public.blogger_brands for select
  using (blogger_id = auth.uid());

create policy "Blogger can create own brands"
  on public.blogger_brands for insert
  with check (blogger_id = auth.uid());

create policy "Blogger can update own brands"
  on public.blogger_brands for update
  using (blogger_id = auth.uid());

create policy "Blogger can delete own brands"
  on public.blogger_brands for delete
  using (blogger_id = auth.uid());

create policy "Editor can read all brands"
  on public.blogger_brands for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can manage brands"
  on public.blogger_brands for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update brands"
  on public.blogger_brands for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can delete brands"
  on public.blogger_brands for delete
  using (auth_role() in ('super_admin', 'admin'));
