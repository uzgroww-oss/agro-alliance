-- ============================================================================
-- KIRISH BUZILGANI TUZATILADI: "Profil topilmadi"
-- ============================================================================
-- MUAMMO
--
-- `20240708000410_anon_column_privileges.sql` (commit bc4e50f, 2026-08-05)
-- ruxsatlar tizimini mijozdan yopgan:
--
--     REVOKE SELECT ON public.roles FROM anon, authenticated;
--
-- Bu o'zi to'g'ri qaror edi. Lekin `profiles` jadvalidagi
-- "Public can read active bloggers" RLS siyosati ichida aynan shu
-- jadvalga murojaat bor edi:
--
--     id IN (select ur.profile_id from user_roles ur
--            join roles r on r.id = ur.role_id
--            where r.name = 'blogger')
--
-- RLS siyosati SO'ROVCHI rol nomidan bajariladi. Ya'ni `authenticated`
-- `profiles` dan bitta qator o'qimoqchi bo'lsa ham, Postgres BARCHA
-- ruxsat beruvchi siyosatlarni rejaga qo'shadi va `roles` ga huquq
-- talab qiladi. Natija:
--
--     403  42501  permission denied for table roles
--
-- NIMA KO'RINARDI
--
-- Kirish sahifasida "Profil topilmadi". Chalg'ituvchi xabar edi:
-- parol ham, profil ham joyida — faqat o'qishga ruxsat yo'q edi.
-- `auth.tsx` dagi `fetchProfile` har qanday xatoni yutib `null`
-- qaytaradi, `login` esa `null` ni "profil yo'q" deb tushunadi.
--
-- NEGA DARHOL SEZILMAGAN: sessiyani tiklash yo'lida (`resolveSession`)
-- zaxira bor — `fetchProfile` ishlamasa `/me` edge funksiyasiga
-- o'tadi, u esa service role bilan ishlaydi va RLS ga tushmaydi.
-- Ya'ni ALLAQACHON kirgan foydalanuvchi ishlayveradi; faqat YANGI
-- kirish yiqiladi. Shuning uchun "oldin ishlardi" degan taassurot.
--
-- ----------------------------------------------------------------------------
-- YECHIM
--
-- `roles` ni qayta ochish EMAS — u ataylab yopilgan. O'rniga jadvalga
-- murojaat SECURITY DEFINER funksiya ichiga ko'chiriladi: funksiya
-- o'z egasi huquqi bilan ishlaydi, ya'ni chaqiruvchiga `roles` ga
-- huquq kerak emas. Bu `auth_role()` da allaqachon qo'llanilgan usul.
--
-- Funksiya faqat "shu profil blogermi" degan savolga ha/yo'q qaytaradi
-- — rollar ro'yxatini ham, boshqa hech narsani ham oshkor qilmaydi.
-- ============================================================================

create or replace function public.bloger_profilmi(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = p_id
      and r.name = 'blogger'
  )
$$;

-- PUBLIC dan olinadi va kerakli rollarga ANIQ beriladi: siyosat anon
-- uchun ham ishlaydi (ommaviy bloger profillari), shuning uchun
-- ikkalasiga ham kerak.
revoke execute on function public.bloger_profilmi(uuid) from public;
grant execute on function public.bloger_profilmi(uuid) to anon, authenticated, service_role;

drop policy if exists "Public can read active bloggers" on public.profiles;

create policy "Public can read active bloggers" on public.profiles
  for select
  using (
    status = 'active'
    and deleted_at is null
    and public.bloger_profilmi(id)
  );
