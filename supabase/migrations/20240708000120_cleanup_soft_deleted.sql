-- Clean up soft-deleted users: delete auth users that have no active profile
-- This ensures old deleted bloggers/partners don't block re-creation with same email

do $$
declare
  v_user record;
  v_count int := 0;
begin
  for v_user in (
    select au.id, au.email
    from auth.users au
    join public.profiles p on p.id = au.id
    where p.deleted_at is not null
      and p.deleted_at < now()
  )
  loop
    delete from auth.users where id = v_user.id;
    v_count := v_count + 1;
    raise notice 'Deleted auth user: % (%)', v_user.email, v_user.id;
  end loop;

  -- Also clean up orphaned profiles (profiles with deleted_at but no auth user)
  delete from public.profiles
  where deleted_at is not null
    and deleted_at < now()
    and id not in (select id from auth.users);

  raise notice 'Total auth users cleaned up: %', v_count;
end;
$$;
