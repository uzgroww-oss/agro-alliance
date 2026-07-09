-- ============================================================================
-- Media Library & Cloudflare R2 Foundation
-- Tables: media_folders, media_files, media_versions, media_usage,
--         media_tags, media_file_tags, media_transformations, media_jobs
--
-- Phase 1.7 — Digital Asset Management (DAM) system
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Media Folders (hierarchical)
-- --------------------------------------------------------------------------

create table if not exists public.media_folders (
  id          uuid         primary key default gen_random_uuid(),
  parent_id   uuid         references public.media_folders(id) on delete cascade,
  name        varchar(255) not null,
  slug        varchar(255) not null,
  description text,
  cover       varchar(500),
  sort_order  integer      not null default 0,
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create unique index idx_media_folders_slug_parent
  on public.media_folders (slug, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'))
  where deleted_at is null;

create index idx_media_folders_parent on public.media_folders (parent_id);
create index idx_media_folders_sort_order on public.media_folders (sort_order);
create index idx_media_folders_deleted_at on public.media_folders (deleted_at);

create trigger trg_media_folders_updated_at
  before update on public.media_folders
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 2. Media Files (main registry)
-- --------------------------------------------------------------------------

create table if not exists public.media_files (
  id               uuid          primary key default gen_random_uuid(),
  folder_id        uuid          references public.media_folders(id) on delete set null,
  uploaded_by      uuid          references public.profiles(id) on delete set null,
  original_filename varchar(500) not null,
  stored_filename  varchar(500) not null,
  storage_key      varchar(500) not null,
  bucket           varchar(100) not null default 'public',
  mime_type        varchar(100),
  extension        varchar(20),
  size_bytes       bigint        not null default 0,
  width            integer,
  height           integer,
  duration         decimal(10,3),
  checksum         varchar(64),
  etag             varchar(255),
  dominant_color   varchar(20),
  blurhash         varchar(255),
  alt_text         varchar(500),
  caption          text,
  is_public        boolean       not null default true,
  status           varchar(50)   not null default 'uploading',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz,
  created_by       uuid          references public.profiles(id) on delete set null,
  updated_by       uuid          references public.profiles(id) on delete set null,
  deleted_by       uuid          references public.profiles(id) on delete set null
);

create unique index idx_media_files_storage_key on public.media_files (storage_key) where deleted_at is null;

create unique index idx_media_files_checksum
  on public.media_files (checksum) where checksum is not null and deleted_at is null;

create index idx_media_files_folder on public.media_files (folder_id);
create index idx_media_files_uploader on public.media_files (uploaded_by);
create index idx_media_files_mime on public.media_files (mime_type);
create index idx_media_files_status on public.media_files (status);
create index idx_media_files_bucket on public.media_files (bucket);
create index idx_media_files_public on public.media_files (is_public) where is_public = true and status = 'ready';
create index idx_media_files_created on public.media_files (created_at desc);
create index idx_media_files_deleted_at on public.media_files (deleted_at);

alter table public.media_files add constraint chk_media_files_status
  check (status in ('uploading', 'processing', 'ready', 'failed', 'deleted'));
alter table public.media_files add constraint chk_media_files_bucket
  check (bucket in ('public', 'private', 'temp', 'archive'));
alter table public.media_files add constraint chk_media_files_size
  check (size_bytes >= 0);
alter table public.media_files add constraint chk_media_files_dimensions
  check (width is null or (width >= 0 and height is not null and height >= 0));

create trigger trg_media_files_updated_at
  before update on public.media_files
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 3. Media Versions (file replacement history)
-- --------------------------------------------------------------------------

create table if not exists public.media_versions (
  id                uuid          primary key default gen_random_uuid(),
  file_id           uuid          not null references public.media_files(id) on delete cascade,
  version_number    integer       not null,
  original_filename varchar(500)  not null,
  stored_filename   varchar(500)  not null,
  storage_key       varchar(500)  not null,
  mime_type         varchar(100),
  size_bytes        bigint        not null default 0,
  width             integer,
  height            integer,
  checksum          varchar(64),
  change_reason     text,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  deleted_at        timestamptz,
  created_by        uuid          references public.profiles(id) on delete set null,
  updated_by        uuid          references public.profiles(id) on delete set null,
  deleted_by        uuid          references public.profiles(id) on delete set null
);

create unique index idx_media_versions_file_version
  on public.media_versions (file_id, version_number) where deleted_at is null;

create index idx_media_versions_file on public.media_versions (file_id, version_number desc);
create index idx_media_versions_storage_key on public.media_versions (storage_key);
create index idx_media_versions_deleted_at on public.media_versions (deleted_at);

alter table public.media_versions add constraint chk_media_versions_number
  check (version_number >= 1);
alter table public.media_versions add constraint chk_media_versions_size
  check (size_bytes >= 0);

create trigger trg_media_versions_updated_at
  before update on public.media_versions
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 4. Media Usage (polymorphic — track where files are used)
-- --------------------------------------------------------------------------

create table if not exists public.media_usage (
  id          uuid         primary key default gen_random_uuid(),
  file_id     uuid         not null references public.media_files(id) on delete cascade,
  entity_type varchar(100) not null,
  entity_id   uuid         not null,
  field_name  varchar(100),
  sort_order  integer      not null default 0,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id) on delete set null,
  updated_by  uuid         references public.profiles(id) on delete set null,
  deleted_by  uuid         references public.profiles(id) on delete set null
);

create unique index idx_media_usage_entity
  on public.media_usage (file_id, entity_type, entity_id, coalesce(field_name, ''))
  where deleted_at is null;

create index idx_media_usage_file on public.media_usage (file_id);
create index idx_media_usage_entity_lookup on public.media_usage (entity_type, entity_id);
create index idx_media_usage_deleted_at on public.media_usage (deleted_at);

alter table public.media_usage add constraint chk_media_usage_entity_type
  check (entity_type in (
    'news_article', 'blogger', 'partner', 'company',
    'homepage_section', 'public_setting', 'ai_news', 'profile', 'social_account'
  ));

create trigger trg_media_usage_updated_at
  before update on public.media_usage
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 5. Media Tags
-- --------------------------------------------------------------------------

create table if not exists public.media_tags (
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

create unique index idx_media_tags_slug on public.media_tags (slug) where deleted_at is null;

create index idx_media_tags_deleted_at on public.media_tags (deleted_at);

create trigger trg_media_tags_updated_at
  before update on public.media_tags
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 6. Media File Tags (many-to-many)
-- --------------------------------------------------------------------------

create table if not exists public.media_file_tags (
  id         uuid primary key default gen_random_uuid(),
  file_id    uuid not null references public.media_files(id) on delete cascade,
  tag_id     uuid not null references public.media_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_by uuid references public.profiles(id) on delete set null
);

create unique index idx_media_file_tags_unique
  on public.media_file_tags (file_id, tag_id) where deleted_at is null;

create index idx_media_file_tags_file on public.media_file_tags (file_id);
create index idx_media_file_tags_tag on public.media_file_tags (tag_id);
create index idx_media_file_tags_deleted_at on public.media_file_tags (deleted_at);

create trigger trg_media_file_tags_updated_at
  before update on public.media_file_tags
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 7. Media Transformations (generated variants)
-- --------------------------------------------------------------------------

create table if not exists public.media_transformations (
  id                  uuid          primary key default gen_random_uuid(),
  file_id             uuid          not null references public.media_files(id) on delete cascade,
  transformation_name varchar(100)  not null,
  storage_key         varchar(500)  not null,
  mime_type           varchar(100),
  size_bytes          bigint        not null default 0,
  width               integer,
  height              integer,
  etag                varchar(255),
  job_id              uuid,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  deleted_at          timestamptz,
  created_by          uuid          references public.profiles(id) on delete set null,
  updated_by          uuid          references public.profiles(id) on delete set null,
  deleted_by          uuid          references public.profiles(id) on delete set null
);

create unique index idx_media_transformations_file_name
  on public.media_transformations (file_id, transformation_name) where deleted_at is null;

create index idx_media_transformations_file on public.media_transformations (file_id);
create index idx_media_transformations_storage_key on public.media_transformations (storage_key);
create index idx_media_transformations_deleted_at on public.media_transformations (deleted_at);

alter table public.media_transformations add constraint chk_media_transformations_name
  check (transformation_name in ('original', 'thumbnail', 'small', 'medium', 'large', 'webp', 'avif'));
alter table public.media_transformations add constraint chk_media_transformations_size
  check (size_bytes >= 0);

create trigger trg_media_transformations_updated_at
  before update on public.media_transformations
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 8. Media Jobs (future processing queue)
-- --------------------------------------------------------------------------

create table if not exists public.media_jobs (
  id              uuid          primary key default gen_random_uuid(),
  file_id         uuid          references public.media_files(id) on delete cascade,
  job_type        varchar(100)  not null,
  status          varchar(50)   not null default 'pending',
  priority        integer       not null default 0,
  payload         jsonb,
  result          jsonb,
  error_message   text,
  retry_count     integer       not null default 0,
  max_retries     integer       not null default 3,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  deleted_at      timestamptz,
  created_by      uuid          references public.profiles(id) on delete set null,
  updated_by      uuid          references public.profiles(id) on delete set null,
  deleted_by      uuid          references public.profiles(id) on delete set null
);

create index idx_media_jobs_file on public.media_jobs (file_id);
create index idx_media_jobs_type on public.media_jobs (job_type, status);
create index idx_media_jobs_pending on public.media_jobs (priority, scheduled_at) where status = 'pending';
create index idx_media_jobs_deleted_at on public.media_jobs (deleted_at);

alter table public.media_jobs add constraint chk_media_jobs_status
  check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled'));
alter table public.media_jobs add constraint chk_media_jobs_type_check
  check (job_type in (
    'resize', 'optimize', 'scan_virus', 'generate_blurhash',
    'generate_thumbnail', 'generate_webp', 'generate_avif',
    'cdn_purge', 'index_metadata', 'audit_checksum'
  ));
alter table public.media_jobs add constraint chk_media_jobs_retry
  check (retry_count >= 0);
alter table public.media_jobs add constraint chk_media_jobs_max_retries
  check (max_retries >= 1);

create trigger trg_media_jobs_updated_at
  before update on public.media_jobs
  for each row
  execute function public.handle_updated_at();

-- ============================================================================
-- 9. Row-Level Security (RLS)
-- ============================================================================

-- 9.1 Media Folders
alter table public.media_folders enable row level security;

create policy "Public can read active folders"
  on public.media_folders for select
  using (is_active = true and deleted_at is null);

create policy "Editor can manage folders"
  on public.media_folders for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update folders"
  on public.media_folders for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete folders"
  on public.media_folders for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 9.2 Media Files
alter table public.media_files enable row level security;

create policy "Public can read ready public files"
  on public.media_files for select
  using (is_public = true and status = 'ready' and deleted_at is null);

create policy "Editor can read all files"
  on public.media_files for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can upload files"
  on public.media_files for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update own files"
  on public.media_files for update
  using (uploaded_by = auth.uid());

create policy "Admin can update any files"
  on public.media_files for update
  using (auth_role() in ('super_admin', 'admin'));

create policy "Editor can delete own files"
  on public.media_files for delete
  using (uploaded_by = auth.uid());

create policy "Admin can soft-delete files"
  on public.media_files for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 9.3 Media Versions
alter table public.media_versions enable row level security;

create policy "Public can read versions of public files"
  on public.media_versions for select
  using (
    deleted_at is null
    and file_id in (
      select mf.id from public.media_files mf
      where mf.is_public = true and mf.status = 'ready' and mf.deleted_at is null
    )
  );

create policy "Editor can read all versions"
  on public.media_versions for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can manage versions"
  on public.media_versions for insert
  with check (auth_role() in ('super_admin', 'admin'));

create policy "Admin can soft-delete versions"
  on public.media_versions for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 9.4 Media Usage
alter table public.media_usage enable row level security;

create policy "Public can read usage of public files"
  on public.media_usage for select
  using (
    deleted_at is null
    and file_id in (
      select mf.id from public.media_files mf
      where mf.is_public = true and mf.status = 'ready' and mf.deleted_at is null
    )
  );

create policy "Editor can read all usage"
  on public.media_usage for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can manage usage"
  on public.media_usage for insert
  with check (auth_role() in ('super_admin', 'admin'));

create policy "Admin can soft-delete usage"
  on public.media_usage for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 9.5 Media Tags
alter table public.media_tags enable row level security;

create policy "Public can read tags"
  on public.media_tags for select
  using (deleted_at is null);

create policy "Editor can manage tags"
  on public.media_tags for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update tags"
  on public.media_tags for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete tags"
  on public.media_tags for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 9.6 Media File Tags
alter table public.media_file_tags enable row level security;

create policy "Public can read tags of public files"
  on public.media_file_tags for select
  using (
    deleted_at is null
    and file_id in (
      select mf.id from public.media_files mf
      where mf.is_public = true and mf.status = 'ready' and mf.deleted_at is null
    )
  );

create policy "Editor can manage file tags"
  on public.media_file_tags for insert
  with check (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Editor can update file tags"
  on public.media_file_tags for update
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can soft-delete file tags"
  on public.media_file_tags for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 9.7 Media Transformations
alter table public.media_transformations enable row level security;

create policy "Public can read transformations of public files"
  on public.media_transformations for select
  using (
    deleted_at is null
    and file_id in (
      select mf.id from public.media_files mf
      where mf.is_public = true and mf.status = 'ready' and mf.deleted_at is null
    )
  );

create policy "Editor can read all transformations"
  on public.media_transformations for select
  using (auth_role() in ('super_admin', 'admin', 'editor'));

create policy "Admin can manage transformations"
  on public.media_transformations for insert
  with check (auth_role() in ('super_admin', 'admin'));

create policy "Admin can soft-delete transformations"
  on public.media_transformations for delete
  using (auth_role() in ('super_admin', 'admin'));

-- 9.8 Media Jobs
alter table public.media_jobs enable row level security;

create policy "Editor can read own jobs"
  on public.media_jobs for select
  using (
    deleted_at is null
    and file_id in (
      select mf.id from public.media_files mf
      where mf.uploaded_by = auth.uid() and mf.deleted_at is null
    )
  );

create policy "Admin can read all jobs"
  on public.media_jobs for select
  using (auth_role() in ('super_admin', 'admin'));

create policy "Admin can manage jobs"
  on public.media_jobs for all
  using (auth_role() in ('super_admin', 'admin'));

-- ============================================================================
-- 10. Views
-- ============================================================================

-- 10.1 Media Library — comprehensive view
create or replace view public.media_library_view as
select
  mf.id,
  mf.storage_key,
  mf.original_filename,
  mf.stored_filename,
  mf.mime_type,
  mf.extension,
  mf.size_bytes,
  mf.width,
  mf.height,
  mf.duration,
  mf.dominant_color,
  mf.blurhash,
  mf.alt_text,
  mf.caption,
  mf.is_public,
  mf.status,
  mf.bucket,
  mf.checksum,
  mf.created_at,
  mf.updated_at,
  f.name as folder_name,
  f.slug as folder_slug,
  p.name as uploader_name,
  coalesce(
    (select jsonb_agg(jsonb_build_object('name', mt.name, 'slug', mt.slug))
     from public.media_file_tags mft
     join public.media_tags mt on mt.id = mft.tag_id
     where mft.file_id = mf.id and mft.deleted_at is null
    ), '[]'::jsonb
  ) as tags,
  coalesce(
    (select jsonb_agg(jsonb_build_object('entity_type', mu.entity_type, 'entity_id', mu.entity_id))
     from public.media_usage mu
     where mu.file_id = mf.id and mu.deleted_at is null
     limit 10
    ), '[]'::jsonb
  ) as usage_refs,
  coalesce(
    (select jsonb_agg(jsonb_build_object(
      'name', mt.transformation_name,
      'storage_key', mt.storage_key,
      'width', mt.width,
      'height', mt.height,
      'size_bytes', mt.size_bytes
     ) order by mt.transformation_name)
     from public.media_transformations mt
     where mt.file_id = mf.id and mt.deleted_at is null
    ), '[]'::jsonb
  ) as transformations
from public.media_files mf
left join public.media_folders f on f.id = mf.folder_id
left join public.profiles p on p.id = mf.uploaded_by
where mf.deleted_at is null
order by mf.created_at desc;

-- 10.2 Unused Media — files with no usage records
create or replace view public.unused_media_view as
select
  mf.id,
  mf.storage_key,
  mf.original_filename,
  mf.mime_type,
  mf.extension,
  mf.size_bytes,
  mf.is_public,
  mf.status,
  mf.created_at,
  f.name as folder_name,
  p.name as uploader_name
from public.media_files mf
left join public.media_folders f on f.id = mf.folder_id
left join public.profiles p on p.id = mf.uploaded_by
where mf.deleted_at is null
  and mf.status = 'ready'
  and not exists (
    select 1 from public.media_usage mu
    where mu.file_id = mf.id and mu.deleted_at is null
  )
order by mf.size_bytes desc, mf.created_at desc;

-- 10.3 Popular Media — most widely used files
create or replace view public.popular_media_view as
select
  mf.id,
  mf.storage_key,
  mf.original_filename,
  mf.mime_type,
  mf.extension,
  mf.size_bytes,
  mf.width,
  mf.height,
  mf.is_public,
  mf.status,
  mf.created_at,
  f.name as folder_name,
  p.name as uploader_name,
  count(mu.id) filter (where mu.deleted_at is null) as usage_count
from public.media_files mf
left join public.media_folders f on f.id = mf.folder_id
left join public.profiles p on p.id = mf.uploaded_by
left join public.media_usage mu on mu.file_id = mf.id
where mf.deleted_at is null
  and mf.status = 'ready'
group by mf.id, f.name, p.name
having count(mu.id) filter (where mu.deleted_at is null) > 0
order by usage_count desc, mf.created_at desc
limit 50;

-- ============================================================================
-- 11. Seed Data
-- ============================================================================

-- 11.1 Default Media Folders
do $$
begin
  if not exists (select 1 from public.media_folders where slug = 'images' and parent_id is null and deleted_at is null) then
    insert into public.media_folders (name, slug, description, sort_order, is_active) values
      ('Images',    'images',    'Rasm va fotosuratlar',          1, true),
      ('Videos',    'videos',    'Video materiallar',             2, true),
      ('Documents', 'documents', 'Hujjat va PDFlar',              3, true),
      ('AI',        'ai',        'AI tomonidan yaratilgan media', 4, true),
      ('Homepage',  'homepage',  'Bosh sahifa media resurslari',  5, true),
      ('Bloggers',  'bloggers',  'Blogerlar uchun media',         6, true),
      ('Partners',  'partners',  'Hamkorlar media resurslari',    7, true),
      ('News',      'news',      'Yangiliklar uchun media',       8, true),
      ('Avatars',   'avatars',   'Foydalanuvchi profillari',      9, true);
  end if;
end;
$$;

-- 11.2 Default Media Tags
insert into public.media_tags (name, slug)
values
  ('Hero', 'hero'),
  ('Thumbnail', 'thumbnail'),
  ('Banner', 'banner'),
  ('Logo', 'logo'),
  ('Icon', 'icon'),
  ('Background', 'background'),
  ('Illustration', 'illustration'),
  ('Screenshot', 'screenshot'),
  ('Infographic', 'infographic'),
  ('Profile photo', 'profile-photo'),
  ('Cover photo', 'cover-photo'),
  ('Product photo', 'product-photo'),
  ('Gallery', 'gallery'),
  ('AI generated', 'ai-generated'),
  ('Optimized', 'optimized')
on conflict (slug) where deleted_at is null do nothing;
