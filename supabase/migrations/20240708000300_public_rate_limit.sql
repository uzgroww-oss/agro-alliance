-- ============================================================================
-- Public endpointlar uchun IP-asosli rate limit (spam/DoS oldini olish)
-- ============================================================================

create table if not exists public.rate_limits (
  key          text        primary key,   -- "action:ip"
  count        integer     not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Atomik tekshiruv+oshirish: oyna ichida p_max dan oshmasa true, oshsa false
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cur record;
begin
  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case
      when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then 1
      else public.rate_limits.count + 1
    end,
    window_start = case
      when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then now()
      else public.rate_limits.window_start
    end
  returning * into cur;

  return cur.count <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
