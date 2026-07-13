-- Instagram OAuth tokenlarni saqlash uchun jadval
create table if not exists public.instagram_tokens (
  id                 uuid         primary key default gen_random_uuid(),
  user_id            uuid         not null references public.profiles(id) on delete cascade,
  access_token       text         not null,
  instagram_account_id varchar(100),
  instagram_username varchar(255),
  expires_at         timestamptz  not null,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now()
);

create unique index idx_instagram_tokens_user_id on public.instagram_tokens (user_id);

alter table public.instagram_tokens enable row level security;

-- Faqat admin (super_admin) tokenni ko'rishi va tahrirlashi mumkin
create policy "Admins can manage instagram tokens"
  on public.instagram_tokens for all
  using (
    exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.profile_id = auth.uid() and r.name in ('super_admin', 'admin')
    )
  );

-- Trigger updated_at
create trigger trg_instagram_tokens_updated_at
  before update on public.instagram_tokens
  for each row
  execute function public.handle_updated_at();
