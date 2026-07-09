-- ============================================================================
-- Identity & Access Foundation v2
-- Tables: roles, permissions, role_permissions, profiles, user_roles
--
-- Phase 1.2 — Enterprise RBAC with multi-role support
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Tables
-- --------------------------------------------------------------------------

create table if not exists public.roles (
  id          uuid        primary key default gen_random_uuid(),
  name        varchar(50) not null,
  description text,
  is_system   boolean     not null default false,
  priority    integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create unique index idx_roles_name on public.roles (name) where deleted_at is null;

create index idx_roles_priority on public.roles (priority);
create index idx_roles_deleted_at on public.roles (deleted_at);

-- --------------------------------------------------------------------------
-- 3. Permissions
-- --------------------------------------------------------------------------

create table if not exists public.permissions (
  id          uuid         primary key default gen_random_uuid(),
  code        varchar(100) not null,
  name        varchar(255) not null,
  description text,
  resource    varchar(50)  not null,
  action      varchar(50)  not null,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz
);

create unique index idx_permissions_code on public.permissions (code) where deleted_at is null;

create index idx_permissions_resource on public.permissions (resource);
create index idx_permissions_action on public.permissions (action);
create index idx_permissions_deleted_at on public.permissions (deleted_at);

-- --------------------------------------------------------------------------
-- 4. Role-Permissions Junction
-- --------------------------------------------------------------------------

create table if not exists public.role_permissions (
  id            uuid        primary key default gen_random_uuid(),
  role_id       uuid        not null references public.roles(id) on delete cascade,
  permission_id uuid        not null references public.permissions(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create unique index idx_role_permissions_unique on public.role_permissions (role_id, permission_id);

create index idx_role_permissions_role_id on public.role_permissions (role_id);
create index idx_role_permissions_permission_id on public.role_permissions (permission_id);

-- --------------------------------------------------------------------------
-- 5. Profiles
-- --------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid         primary key references auth.users(id) on delete cascade,
  email      varchar(255) not null,
  name       varchar(255) not null,
  avatar     varchar(500),
  phone      varchar(20),
  language   varchar(10),
  timezone   varchar(50),
  bio        text,
  status     varchar(20)  not null default 'pending',
  metadata   jsonb        not null default '{}'::jsonb,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  deleted_at timestamptz,
  deleted_by uuid         references public.profiles(id) on delete set null,
  created_by uuid         references public.profiles(id) on delete set null,
  updated_by uuid         references public.profiles(id) on delete set null
);

alter table public.profiles add constraint chk_profiles_status
  check (status in ('active', 'inactive', 'pending', 'banned'));

create unique index idx_profiles_email on public.profiles (email) where deleted_at is null;

create index idx_profiles_status on public.profiles (status);
create index idx_profiles_deleted_at on public.profiles (deleted_at);
create index idx_profiles_language on public.profiles (language);
create index idx_profiles_created_by on public.profiles (created_by);

-- --------------------------------------------------------------------------
-- 6. User-Roles Junction (multi-role support)
-- --------------------------------------------------------------------------

create table if not exists public.user_roles (
  id         uuid        primary key default gen_random_uuid(),
  profile_id uuid        not null references public.profiles(id) on delete cascade,
  role_id    uuid        not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index idx_user_roles_unique on public.user_roles (profile_id, role_id);

create index idx_user_roles_profile_id on public.user_roles (profile_id);
create index idx_user_roles_role_id on public.user_roles (role_id);

-- --------------------------------------------------------------------------
-- 7. Helper Functions
-- --------------------------------------------------------------------------

-- Automatic updated_at handler
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Soft-delete helper — marks rows as deleted instead of physically removing
create or replace function public.soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.deleted_at = now();
  new.deleted_by = auth.uid();
  return new;
end;
$$;

-- Returns the highest-priority role name of the authenticated user.
-- Multi-role: joins through user_roles, picks by priority DESC.
-- SECURITY DEFINER bypasses RLS to avoid recursion.
create or replace function public.auth_role()
returns varchar
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.profile_id
  where p.id = auth.uid()
    and p.deleted_at is null
  order by r.priority desc
  limit 1;
$$;

-- Returns all role names for the authenticated user (as a comma-separated string).
create or replace function public.auth_roles()
returns varchar
language sql
stable
security definer
set search_path = public
as $$
  select string_agg(r.name, ',' order by r.priority desc)
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.profile_id
  where p.id = auth.uid()
    and p.deleted_at is null;
$$;

-- Create profile + user_roles entry when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
  v_name    varchar;
begin
  select id into v_role_id from public.roles where name = 'user';

  v_name := coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, name, status, created_by)
  values (new.id, new.email, v_name, 'active', new.id);

  insert into public.user_roles (profile_id, role_id)
  values (new.id, v_role_id);

  return new;
end;
$$;

-- Syncs profiles.email from auth.users.email when auth user email changes
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id
    and deleted_at is null;
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- 8. Triggers
-- --------------------------------------------------------------------------

create trigger trg_roles_updated_at
  before update on public.roles
  for each row
  execute function public.handle_updated_at();

create trigger trg_permissions_updated_at
  before update on public.permissions
  for each row
  execute function public.handle_updated_at();

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- Auto-create profile + user_roles from auth.users
create trigger trg_profiles_after_auth_insert
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Sync email when auth.users.email changes
create trigger trg_profiles_sync_email
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- --------------------------------------------------------------------------
-- 9. Row-Level Security (RLS)
-- --------------------------------------------------------------------------

-- Clean up any previously created policies for idempotent re-runs
do $$
begin
  drop policy if exists "Roles are publicly readable" on public.roles;
  drop policy if exists "Super admin can create roles" on public.roles;
  drop policy if exists "Super admin can update roles" on public.roles;
  drop policy if exists "Super admin can delete roles" on public.roles;
  drop policy if exists "Permissions are publicly readable" on public.permissions;
  drop policy if exists "Super admin can create permissions" on public.permissions;
  drop policy if exists "Super admin can update permissions" on public.permissions;
  drop policy if exists "Super admin can delete permissions" on public.permissions;
  drop policy if exists "Role-permissions are publicly readable" on public.role_permissions;
  drop policy if exists "Super admin can create role-permissions" on public.role_permissions;
  drop policy if exists "Super admin can update role-permissions" on public.role_permissions;
  drop policy if exists "Super admin can delete role-permissions" on public.role_permissions;
  drop policy if exists "Users can read own role assignments" on public.user_roles;
  drop policy if exists "Super admin can read all user roles" on public.user_roles;
  drop policy if exists "Super admin can assign user roles" on public.user_roles;
  drop policy if exists "Super admin can update user roles" on public.user_roles;
  drop policy if exists "Super admin can revoke user roles" on public.user_roles;
  drop policy if exists "Public can read active bloggers" on public.profiles;
  drop policy if exists "Users can read own profile" on public.profiles;
  drop policy if exists "Super admin can read all profiles" on public.profiles;
  drop policy if exists "Super admin can create profiles" on public.profiles;
  drop policy if exists "Users can update own profile" on public.profiles;
  drop policy if exists "Super admin can update any profile" on public.profiles;
end;
$$;

-- 9.1 Roles
alter table public.roles enable row level security;

create policy "Roles are publicly readable"
  on public.roles for select
  using (deleted_at is null);

create policy "Super admin can create roles"
  on public.roles for insert
  with check (auth_role() = 'super_admin');

create policy "Super admin can update roles"
  on public.roles for update
  using (auth_role() = 'super_admin');

create policy "Super admin can delete roles"
  on public.roles for delete
  using (auth_role() = 'super_admin');

-- 9.2 Permissions
alter table public.permissions enable row level security;

create policy "Permissions are publicly readable"
  on public.permissions for select
  using (deleted_at is null);

create policy "Super admin can create permissions"
  on public.permissions for insert
  with check (auth_role() = 'super_admin');

create policy "Super admin can update permissions"
  on public.permissions for update
  using (auth_role() = 'super_admin');

create policy "Super admin can delete permissions"
  on public.permissions for delete
  using (auth_role() = 'super_admin');

-- 9.3 Role-Permissions
alter table public.role_permissions enable row level security;

create policy "Role-permissions are publicly readable"
  on public.role_permissions for select
  using (true);

create policy "Super admin can create role-permissions"
  on public.role_permissions for insert
  with check (auth_role() = 'super_admin');

create policy "Super admin can update role-permissions"
  on public.role_permissions for update
  using (auth_role() = 'super_admin');

create policy "Super admin can delete role-permissions"
  on public.role_permissions for delete
  using (auth_role() = 'super_admin');

-- 9.4 User-Roles
alter table public.user_roles enable row level security;

create policy "Users can read own role assignments"
  on public.user_roles for select
  using (profile_id = auth.uid());

create policy "Super admin can read all user roles"
  on public.user_roles for select
  using (auth_role() = 'super_admin');

create policy "Super admin can assign user roles"
  on public.user_roles for insert
  with check (auth_role() = 'super_admin');

create policy "Super admin can update user roles"
  on public.user_roles for update
  using (auth_role() = 'super_admin');

create policy "Super admin can revoke user roles"
  on public.user_roles for delete
  using (auth_role() = 'super_admin');

-- 9.5 Profiles
alter table public.profiles enable row level security;

-- Public can read active blogger profiles (directory)
create policy "Public can read active bloggers"
  on public.profiles for select
  using (
    status = 'active'
    and id in (
      select ur.profile_id
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where r.name = 'blogger'
    )
    and deleted_at is null
  );

-- Authenticated users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

-- Super admin can read all profiles
create policy "Super admin can read all profiles"
  on public.profiles for select
  using (auth_role() = 'super_admin');

-- Profiles are created by the auth trigger (SECURITY DEFINER)
-- Only super admin can directly insert outside of trigger
create policy "Super admin can create profiles"
  on public.profiles for insert
  with check (auth_role() = 'super_admin');

-- Users can update their own non-sensitive fields
-- Protected fields (status, deleted_at) are guarded by triggers
create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Super admin can update any profile (including status and user_roles)
create policy "Super admin can update any profile"
  on public.profiles for update
  using (auth_role() = 'super_admin');

-- No DELETE policy — physical deletion is prevented at RLS level.
-- Soft-delete is performed via UPDATE setting deleted_at and deleted_by.

-- --------------------------------------------------------------------------
-- 10. Seed Data — Roles
-- --------------------------------------------------------------------------

insert into public.roles (name, description, is_system, priority) values
  ('super_admin', 'Full system access — platform owner', true, 100),
  ('admin',       'Administrative access — manage content and users', true, 80),
  ('editor',      'Content management — create and edit news, manage bloggers', true, 60),
  ('blogger',     'Content creator — manage own profile, socials, and videos', true, 40),
  ('company',     'Partner company representative — view partner data and tasks', true, 20),
  ('user',        'Basic authenticated user — read public content', true, 10)
on conflict (name) where deleted_at is null do nothing;

-- --------------------------------------------------------------------------
-- 11. Seed Data — Permissions
-- Resource-dot-action naming convention (resource.action)
-- --------------------------------------------------------------------------

insert into public.permissions (code, name, description, resource, action) values

  -- Auth
  ('auth.login',        'Login',           'Authenticate with email and password', 'auth', 'login'),
  ('auth.read',         'Read Auth',       'View current user session data', 'auth', 'read'),

  -- Profiles
  ('profiles.read',     'Read Profile',    'View own or public profile details', 'profiles', 'read'),
  ('profiles.update',   'Update Profile',  'Update own profile fields', 'profiles', 'update'),
  ('profiles.manage',   'Manage Profiles', 'Admin: create, update, delete any profile', 'profiles', 'manage'),
  ('profiles.roles',    'Manage Roles',    'Assign and revoke user roles', 'profiles', 'roles'),

  -- Bloggers
  ('bloggers.read',     'Read Bloggers',   'View blogger directory and profiles', 'bloggers', 'read'),
  ('bloggers.create',   'Create Blogger',  'Register new blogger accounts', 'bloggers', 'create'),
  ('bloggers.update',   'Update Blogger',  'Modify blogger profile data', 'bloggers', 'update'),
  ('bloggers.delete',   'Delete Blogger',  'Remove blogger accounts', 'bloggers', 'delete'),
  ('bloggers.status',   'Blogger Status',  'Toggle blogger active/pending/banned', 'bloggers', 'status'),

  -- Partners
  ('partners.read',     'Read Partners',   'View partner directory', 'partners', 'read'),
  ('partners.create',   'Create Partner',  'Add new partner companies', 'partners', 'create'),
  ('partners.update',   'Update Partner',  'Edit partner details', 'partners', 'update'),
  ('partners.delete',   'Delete Partner',  'Remove partner companies', 'partners', 'delete'),
  ('partners.tasks',    'Partner Tasks',   'CRUD operations on partner tasks', 'partners', 'tasks'),
  ('partners.clients',  'Partner Clients', 'Create and delete client accounts for partners', 'partners', 'clients'),

  -- News
  ('news.read',         'Read News',       'View published news articles', 'news', 'read'),
  ('news.create',       'Create News',     'Publish new articles', 'news', 'create'),
  ('news.update',       'Update News',     'Edit existing articles', 'news', 'update'),
  ('news.delete',       'Delete News',     'Remove articles', 'news', 'delete'),
  ('news.publish',      'Publish News',    'Change article status to published', 'news', 'publish'),
  ('news.archive',      'Archive News',    'Move articles to archive', 'news', 'archive'),

  -- Stats
  ('stats.read',        'Read Stats',      'View platform statistics', 'stats', 'read'),
  ('stats.update',      'Update Stats',    'Modify platform statistics', 'stats', 'update'),

  -- Socials (blogger's social accounts)
  ('socials.create',    'Add Social',      'Link a social media account', 'socials', 'create'),
  ('socials.delete',    'Remove Social',   'Unlink a social media account', 'socials', 'delete'),

  -- Videos
  ('videos.create',     'Add Video',       'Add a video reference', 'videos', 'create'),
  ('videos.delete',     'Remove Video',    'Delete a video reference', 'videos', 'delete'),

  -- Contact & Newsletter
  ('contact.create',     'Submit Contact',        'Submit contact form message', 'contact', 'create'),
  ('newsletter.subscribe','Subscribe Newsletter',  'Subscribe to newsletter', 'newsletter', 'subscribe'),
  ('newsletter.unsubscribe','Unsubscribe Newsletter','Unsubscribe from newsletter', 'newsletter', 'unsubscribe'),

  -- Media & Storage
  ('media.upload',       'Upload Media',    'Upload files to storage', 'media', 'upload'),
  ('media.delete',       'Delete Media',    'Remove files from storage', 'media', 'delete'),
  ('media.process',      'Process Media',   'Run media processing pipeline', 'media', 'process'),
  ('storage.buckets',    'Manage Buckets',  'Create and configure storage buckets', 'storage', 'buckets'),
  ('storage.files',      'Manage Files',    'List, move, and delete stored files', 'storage', 'files'),

  -- Settings
  ('settings.read',      'Read Settings',   'View system settings', 'settings', 'read'),
  ('settings.update',    'Update Settings', 'Modify system settings', 'settings', 'update'),
  ('settings.manage',    'Manage Settings', 'Full control over system configuration', 'settings', 'manage'),

  -- Feature Flags
  ('feature-flags.read',   'Read Flags',    'View feature flag states', 'feature-flags', 'read'),
  ('feature-flags.manage', 'Manage Flags',  'Enable and disable feature flags', 'feature-flags', 'manage'),

  -- Admin & System
  ('users.manage',       'Manage Users',       'Manage user accounts and authentication', 'system', 'users'),
  ('roles.manage',       'Manage Roles',       'Create, update, and delete roles', 'system', 'roles'),
  ('permissions.manage', 'Manage Permissions', 'Create, update, and delete permissions', 'system', 'permissions'),
  ('audit.read',         'Read Audit Log',     'View system audit logs', 'system', 'audit'),
  ('system.config',      'System Config',      'View and modify system configuration', 'system', 'config'),
  ('system.backup',      'System Backup',      'Trigger and manage database backups', 'system', 'backup'),
  ('system.health',      'System Health',      'View system health dashboard', 'system', 'health'),

  -- AI
  ('ai.trigger',         'Trigger AI',      'Manually trigger AI news generation', 'ai', 'trigger'),
  ('ai.manage',          'Manage AI',       'Configure AI engine settings', 'ai', 'manage'),
  ('ai.config',          'AI Config',       'View AI pipeline configuration', 'ai', 'config'),

  -- Workers
  ('workers.restart',    'Restart Worker',  'Restart background workers', 'workers', 'restart'),
  ('workers.logs',       'Worker Logs',     'View worker execution logs', 'workers', 'logs'),

  -- Queue
  ('queue.view',         'View Queue',      'View queue depth and status', 'queue', 'view'),
  ('queue.retry',        'Retry Job',       'Re-queue failed jobs', 'queue', 'retry'),
  ('queue.purge',        'Purge Queue',     'Clear all pending jobs from a queue', 'queue', 'purge'),
  ('queue.manage',       'Manage Queue',    'Full queue administration', 'queue', 'manage'),

  -- Monitoring
  ('monitoring.view',    'View Monitoring', 'Access monitoring dashboards', 'monitoring', 'view'),
  ('monitoring.alerts',  'Manage Alerts',   'Configure monitoring alert rules', 'monitoring', 'alerts'),

  -- Analytics
  ('analytics.read',     'Read Analytics',  'Access analytics dashboards and reports', 'analytics', 'read'),
  ('analytics.export',   'Export Analytics','Export analytics data', 'analytics', 'export'),

  -- Social Publishing
  ('social.publish',     'Social Publish',  'Schedule and publish social media posts', 'social', 'publish'),
  ('social.manage',      'Social Manage',   'Configure social automation settings', 'social', 'manage'),

  -- Cron
  ('cron.manage',        'Manage Cron',     'Configure cron job schedules', 'cron', 'manage'),
  ('cron.logs',          'Cron Logs',       'View cron job execution history', 'cron', 'logs'),

  -- Edge Functions
  ('functions.deploy',   'Deploy Functions','Deploy and update Edge Functions', 'functions', 'deploy'),
  ('functions.logs',     'Function Logs',   'View Edge Function execution logs', 'functions', 'logs'),

  -- Deployment
  ('deployment.manage',  'Manage Deployment','Control deployment pipeline', 'deployment', 'manage'),
  ('deployment.rollback','Rollback',        'Roll back to previous deployment', 'deployment', 'rollback'),

  -- Notifications
  ('notifications.manage','Manage Notifications','Configure notification templates and rules', 'notifications', 'manage'),
  ('notifications.send',  'Send Notification','Manually send notifications', 'notifications', 'send')

on conflict (code) where deleted_at is null do nothing;

-- --------------------------------------------------------------------------
-- 12. Seed Data — Role-Permission Assignments
-- --------------------------------------------------------------------------

-- super_admin: all permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'super_admin'
on conflict (role_id, permission_id) do nothing;

-- admin: exclude super_admin-only system management
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'admin'
  and p.code not in (
    'profiles.roles',
    'users.manage',
    'roles.manage',
    'permissions.manage',
    'deployment.manage',
    'deployment.rollback',
    'system.config',
    'system.backup',
    'ai.manage',
    'ai.config'
  )
on conflict (role_id, permission_id) do nothing;

-- editor: content-focused permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'editor'
  and p.code in (
    'auth.login', 'auth.read',
    'profiles.read', 'profiles.update',
    'bloggers.read', 'bloggers.create', 'bloggers.update',
    'news.read', 'news.create', 'news.update', 'news.delete',
    'news.publish', 'news.archive',
    'stats.read',
    'contact.create',
    'media.upload', 'media.process',
    'analytics.read',
    'newsletter.subscribe',
    'settings.read',
    'feature-flags.read'
  )
on conflict (role_id, permission_id) do nothing;

-- blogger: self-service permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'blogger'
  and p.code in (
    'auth.login', 'auth.read',
    'profiles.read', 'profiles.update',
    'bloggers.read',
    'news.read',
    'stats.read',
    'analytics.read',
    'socials.create', 'socials.delete',
    'videos.create', 'videos.delete',
    'contact.create',
    'media.upload',
    'newsletter.subscribe',
    'settings.read',
    'feature-flags.read'
  )
on conflict (role_id, permission_id) do nothing;

-- company: partner read-only permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'company'
  and p.code in (
    'auth.login', 'auth.read',
    'profiles.read',
    'partners.read',
    'partners.tasks',
    'news.read',
    'bloggers.read',
    'stats.read',
    'contact.create',
    'newsletter.subscribe'
  )
on conflict (role_id, permission_id) do nothing;

-- user: basic authenticated access
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'user'
  and p.code in (
    'auth.login', 'auth.read',
    'profiles.read',
    'news.read',
    'bloggers.read',
    'stats.read',
    'contact.create',
    'newsletter.subscribe'
  )
on conflict (role_id, permission_id) do nothing;

-- --------------------------------------------------------------------------
-- 13. Validation Checks
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from public.roles where name = 'super_admin') then
    raise exception 'Seed failed: super_admin role not found';
  end if;
end $$;

do $$
declare
  expected_count integer := 71;
  actual_count   integer;
begin
  select count(*) into actual_count from public.permissions where deleted_at is null;
  if actual_count < expected_count then
    raise warning 'Permission count: % (expected at least %)', actual_count, expected_count;
  end if;
end $$;
