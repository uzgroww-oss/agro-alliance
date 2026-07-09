CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
  v_name    varchar;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'company';
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'user';
  END IF;

  v_name := coalesce(
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  INSERT INTO public.profiles (id, email, name, status, created_by)
  VALUES (new.id, new.email, v_name, 'active', new.id);

  INSERT INTO public.user_roles (profile_id, role_id)
  VALUES (new.id, v_role_id);

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_after_auth_insert ON auth.users CASCADE;
CREATE TRIGGER trg_profiles_after_auth_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
