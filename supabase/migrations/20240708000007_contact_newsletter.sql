-- ============================================================================
-- Contact & Newsletter Tables
-- Tables: contact_messages, newsletter_subscribers
-- Required for public-contact and public-newsletter Edge Functions
-- Phase 2.1 — Missing tables from original schema
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Contact Messages (public.contact)
-- --------------------------------------------------------------------------

create table if not exists public.contact_messages (
  id          uuid         primary key default gen_random_uuid(),
  name        varchar(255) not null,
  email       varchar(255) not null,
  phone       varchar(50),
  subject     varchar(500) not null,
  message     text         not null,
  is_read     boolean      not null default false,
  read_at     timestamptz,
  read_by     uuid         references public.profiles(id) on delete set null,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create index idx_contact_messages_is_read on public.contact_messages (is_read) where is_read = false;
create index idx_contact_messages_email on public.contact_messages (email);
create index idx_contact_messages_created_at on public.contact_messages (created_at desc);
create index idx_contact_messages_deleted_at on public.contact_messages (deleted_at);

create trigger trg_contact_messages_updated_at
  before update on public.contact_messages
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 2. Newsletter Subscribers
-- --------------------------------------------------------------------------

create table if not exists public.newsletter_subscribers (
  id          uuid         primary key default gen_random_uuid(),
  email       varchar(255) not null,
  name        varchar(255),
  is_active   boolean      not null default true,
  subscribed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create unique index idx_newsletter_subscribers_email on public.newsletter_subscribers (email) where deleted_at is null and is_active = true;

create index idx_newsletter_subscribers_active on public.newsletter_subscribers (is_active) where is_active = true;
create index idx_newsletter_subscribers_deleted_at on public.newsletter_subscribers (deleted_at);

alter table public.newsletter_subscribers add constraint chk_newsletter_email
  check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

create trigger trg_newsletter_subscribers_updated_at
  before update on public.newsletter_subscribers
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 3. Row-Level Security (RLS)
-- --------------------------------------------------------------------------

do $$
begin
  drop policy if exists "Anyone can submit contact messages" on public.contact_messages;
  drop policy if exists "Editor can read contact messages" on public.contact_messages;
  drop policy if exists "Editor can update contact messages" on public.contact_messages;
  drop policy if exists "Admin can delete contact messages" on public.contact_messages;
  drop policy if exists "Anyone can subscribe" on public.newsletter_subscribers;
  drop policy if exists "Anyone can unsubscribe" on public.newsletter_subscribers;
  drop policy if exists "Editor can read subscribers" on public.newsletter_subscribers;
  drop policy if exists "Admin can delete subscribers" on public.newsletter_subscribers;
end;
$$;

-- 3.1 Contact Messages
alter table public.contact_messages enable row level security;

create policy "Anyone can submit contact messages"
  on public.contact_messages for insert
  with check (true);

create policy "Editor can read contact messages"
  on public.contact_messages for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update contact messages"
  on public.contact_messages for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can delete contact messages"
  on public.contact_messages for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 3.2 Newsletter Subscribers
alter table public.newsletter_subscribers enable row level security;

create policy "Anyone can subscribe"
  on public.newsletter_subscribers for insert
  with check (true);

create policy "Anyone can unsubscribe"
  on public.newsletter_subscribers for update
  using (true);

create policy "Editor can read subscribers"
  on public.newsletter_subscribers for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can delete subscribers"
  on public.newsletter_subscribers for delete
  using (auth_role() in ('super_admin', 'admin'));
