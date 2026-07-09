-- ============================================================================
-- Auto-confirm email on registration
-- Skips email verification — users can login immediately after signup
-- ============================================================================

-- Function: automatically set email_confirmed_at for new auth users
create or replace function public.auto_confirm_email()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  -- Only confirm if not already confirmed
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

-- Trigger: fires BEFORE INSERT on auth.users
create trigger trg_auto_confirm_email
  before insert on auth.users
  for each row
  execute function public.auto_confirm_email();
