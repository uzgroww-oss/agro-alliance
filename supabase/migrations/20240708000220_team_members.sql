-- Team members table for "Bizning Jamoa" section
create table if not exists public.team_members (
  id          uuid         primary key default gen_random_uuid(),
  name        varchar(255) not null,
  role        varchar(255),
  image_url   text,
  sort_order  integer      not null default 0,
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz,
  created_by  uuid         references public.profiles(id),
  updated_by  uuid         references public.profiles(id),
  deleted_by  uuid         references public.profiles(id)
);

alter table public.team_members enable row level security;

create policy "Public can view active team members"
  on public.team_members for select
  using (is_active = true and deleted_at is null);

create policy "Admins can manage team members"
  on public.team_members for all
  using (
    exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.profile_id = auth.uid()
        and r.name in ('super_admin', 'admin', 'editor')
    )
  );

-- Optional seed data
insert into public.team_members (name, role, image_url, sort_order, is_active) values
  ('Aliyev Alisher', 'Bosh direktor', null, 1, true),
  ('Karimova Nilufar', 'Marketing menejeri', null, 2, true),
  ('Raximov Jasur', 'Texnik direktor', null, 3, true),
  ('Tursunova Sabina', 'Kontent menejeri', null, 4, true),
  ('Xasanov Bahrom', 'SMM mutaxassisi', null, 5, true)
on conflict (id) do nothing;
