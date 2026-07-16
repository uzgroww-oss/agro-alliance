-- ============================================================================
-- XAVFSIZLIK: o'zi ro'yxatdan o'tgan (self-signup) foydalanuvchi darhol 'active'
-- bo'lmasin — 'pending' bo'lsin. verifyAuth faqat 'active' larni o'tkazadi.
-- Admin yaratgan foydalanuvchilar (blogger/company/user) tegishli funksiyalarda
-- ochiq 'active' qilib o'rnatiladi, shuning uchun ular ishlaydi.
-- ============================================================================

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

  -- 'pending' — admin faollashtirmaguncha yoki admin-create funksiyalari 'active' qilmaguncha kira olmaydi
  insert into public.profiles (id, email, name, status, created_by)
  values (new.id, new.email, v_name, 'pending', new.id);

  insert into public.user_roles (profile_id, role_id)
  values (new.id, v_role_id);

  return new;
end;
$$;
