-- Helper: hard-delete an auth user by email (for cleanup)

create or replace function public.delete_auth_user_by_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = p_email;
  if v_uid is null then return false; end if;
  delete from auth.users where id = v_uid;
  return true;
end;
$$;
