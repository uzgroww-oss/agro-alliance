-- ============================================================================
-- XAVFSIZLIK QATTIQLASHTIRISH
-- ============================================================================
-- Auditda topilgan teshiklarni yopadi. Har bir bo'lim nima uchun
-- kerakligi bilan izohlangan — keyingi odam "buni olib tashlasa
-- bo'ladimi" deb o'ylamasin.
--
-- Umumiy tamoyil: `anon` va `authenticated` rollari ommaviy anon kalit
-- bilan internetdan chaqiriladi. Ya'ni ularga ochiq qolgan HAR QANDAY
-- funksiya — bu API endpointi. Faqat edge funksiyalar (service_role)
-- uchun mo'ljallangan narsalar ularga ko'rinmasligi kerak.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. HISOB YARATADIGAN FUNKSIYALAR — BUTUNLAY O'CHIRILADI
--
-- MUAMMO: to'rttasi ham `auth.users` ga yozadi va `anon` roli ularni
-- chaqira olardi. Ya'ni internetdagi istalgan odam ommaviy anon kalit
-- bilan `POST /rest/v1/rpc/seed_new_blogger` yuborib o'ziga ishlaydigan
-- bloger hisobi yarata olardi — "hisoblar faqat admin tomonidan
-- yaratiladi" degan qoida amalda kuchsiz edi.
--
-- Ustiga `seed_news_editor` parolni KODDA ochiq saqlardi, repozitoriya
-- esa ommaviy.
--
-- NEGA REVOKE EMAS, DROP: to'rttasi ham bir martalik seed yordamchilari.
-- Kodda (src/, supabase/functions/) hech qayerda chaqirilmaydi —
-- tekshirildi. Ishlatilmaydigan hisob-yaratish funksiyasini bazada
-- saqlab turishning ma'nosi yo'q.
-- ---------------------------------------------------------------------------

drop function if exists public.seed_new_blogger(
  text, text, text, text, text, text, numeric, boolean, integer, text, text[], jsonb
);
drop function if exists public.seed_news_editor();
drop function if exists public.create_user_with_profile(text, text, text, text);
drop function if exists public.setup_user_profile(text, text, text);


-- ---------------------------------------------------------------------------
-- 2. GITHUB'GA TUSHGAN PAROLNI AYLANTIRISH
--
-- `news@agroalliance.uz` hisobi `seed_news_editor()` tomonidan
-- `newsadmin123` paroli bilan yaratilgan va bu satr migratsiya faylida
-- ochiq turardi. Repozitoriya ommaviy — ya'ni parol internetda
-- login'siz o'qilardi. Hisob `editor` rolida: yangiliklar, SMM postlar,
-- izohlarga javob va AI kalitlariga kirish huquqi bor.
--
-- Yangi parol TASODIFIY va hech qayerda saqlanmaydi — bu hisob bilan
-- interaktiv kirilmaydi (u faqat AI yangiliklariga muallif sifatida
-- biriktiriladi). Kerak bo'lsa: Dashboard -> Authentication -> Users
-- -> "Reset password".
--
-- Shart bilan: faqat parol HALI HAM standart bo'lsa almashtiriladi.
-- Ya'ni bu migratsiya qayta ishlansa, odam qo'ygan parolni buzmaydi.
-- ---------------------------------------------------------------------------

do $$
begin
  update auth.users
     set encrypted_password = extensions.crypt(
           encode(extensions.gen_random_bytes(32), 'base64'),
           extensions.gen_salt('bf')
         ),
         updated_at = now()
   where email = 'news@agroalliance.uz'
     and encrypted_password = extensions.crypt('newsadmin123', encrypted_password);
end $$;


-- ---------------------------------------------------------------------------
-- 3. FAQAT SERVICE-ROLE UCHUN MO'LJALLANGAN RPC LAR
--
-- Uchalasi ham fon ishlari uchun: edge funksiyalar ularni
-- `supabaseAdmin` (service_role) orqali chaqiradi. `anon` ga ochiq
-- qolgani xato edi:
--   enqueue_news_job     — navbatga cheksiz ish qo'shib AI byudjetini
--                          yoqib yuborish mumkin edi
--   claim_next_news_job  — begona odam navbatdagi ishni "o'g'irlab"
--                          olishi mumkin edi
--   increment_rate_limit — rate-limit hisoblagichini sun'iy oshirib
--                          AI ni butunlay to'xtatish mumkin edi
--
-- PUBLIC dan ham olinadi: aks holda anon huquqni PUBLIC orqali meros
-- qilib oladi va revoke hech narsa qilmaydi. Shu sabab service_role ga
-- alohida qaytarib beriladi.
-- ---------------------------------------------------------------------------

revoke execute on function public.enqueue_news_job(
  character varying, jsonb, integer, uuid, uuid, timestamp with time zone, integer
) from public, anon, authenticated;
grant execute on function public.enqueue_news_job(
  character varying, jsonb, integer, uuid, uuid, timestamp with time zone, integer
) to service_role;

revoke execute on function public.claim_next_news_job(character varying)
  from public, anon, authenticated;
grant execute on function public.claim_next_news_job(character varying)
  to service_role;

revoke execute on function public.increment_rate_limit(uuid, uuid, bigint, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.increment_rate_limit(uuid, uuid, bigint, bigint, bigint)
  to service_role;


-- ---------------------------------------------------------------------------
-- 4. TRIGGER FUNKSIYALARI
--
-- Bular faqat trigger sifatida ishlashi kerak, RPC sifatida emas.
--
-- MUHIM (tekshirilgan): trigger ishga tushganda PostgreSQL funksiyaga
-- EXECUTE huquqini QAYTA TEKSHIRMAYDI — u faqat trigger yaratilayotganda
-- tekshiriladi. Jonli bazada rollback qilinadigan tranzaksiyada sinab
-- ko'rildi: huquq olib tashlangandan keyin ham `update` muvaffaqiyatli
-- o'tdi. Ya'ni bu revoke hech qanday triggerni buzmaydi.
--
-- auth_role() va auth_roles() ATAYLAB TEGILMAYDI: ular RLS siyosatlari
-- ichida chaqiriladi va siyosat so'rovchi rol nomidan bajariladi. Ularni
-- yopish butun RLS ni buzadi. Ikkalasi ham faqat chaqiruvchining O'Z
-- rolini qaytaradi — sir emas.
-- ---------------------------------------------------------------------------

revoke execute on function public.handle_new_user()          from public, anon, authenticated;
revoke execute on function public.handle_news_version()      from public, anon, authenticated;
revoke execute on function public.auto_confirm_email()       from public, anon, authenticated;
revoke execute on function public.soft_delete()              from public, anon, authenticated;
revoke execute on function public.sync_profile_email()       from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()          from public, anon, authenticated;
revoke execute on function public.handle_updated_at()        from public, anon, authenticated;
revoke execute on function public.protect_profile_columns()  from public, anon, authenticated;
revoke execute on function public.update_news_sources_updated_at() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5. pg_net — SSRF YO'LINI YOPISH
--
-- `net.http_post` / `http_get` / `http_delete` PUBLIC ga ochiq edi, ya'ni
-- `anon` ham chaqira olardi. Bu — bazangiz nomidan istalgan manzilga
-- HTTP so'rov yuborish (SSRF): ichki xizmatlarni tekshirish, boshqa
-- saytga sizning infratuzilmangizdan hujum qilish.
--
-- Amalda hozir yetib bo'lmaydi (PostgREST faqat `public` va
-- `graphql_public` sxemalarini tashqariga chiqaradi, `net` ro'yxatda
-- yo'q) — lekin huquqning o'zi ortiqcha va sxemalar ro'yxati bir kun
-- o'zgarishi mumkin.
--
-- `postgres` ga QAYTARIB BERILADI: 8 ta pg_cron ishi aynan shu rol
-- nomidan `net.http_post` chaqiradi. Funksiyalar egasi `supabase_admin`,
-- ya'ni postgres huquqni faqat PUBLIC orqali olardi — buni olib
-- tashlagach aniq grant shart, aks holda barcha cron ishlari jimgina
-- o'lardi.
--
-- ⚠️  NATIJA (jonli bazada tekshirilgan): bu blok Supabase'da HECH
-- NARSANI O'ZGARTIRMAYDI. Migratsiya `postgres` nomidan bajariladi,
-- pg_net funksiyalarining egasi esa `supabase_admin` — o'zga rol
-- bergan huquqni qaytarib ololmaydi. Postgres "no privileges were
-- granted" ogohlantirishini beradi va huquqlar joyida qoladi.
-- Cron ishlari shu sababli BUZILMAYDI (tekshirildi).
--
-- Nega baribir qoldirildi: o'z-o'zidan joylashtirilgan (self-hosted)
-- nusxada bu ishlaydi, va bu yerda muammoning yozib qo'yilgani muhim.
-- Supabase'da yopish uchun Dashboard/support orqali `supabase_admin`
-- darajasida revoke kerak.
--
-- YUMSHATUVCHI OMIL (tashqaridan tekshirilgan): PostgREST faqat
-- `public` va `graphql_public` sxemalarini chiqaradi. Anon kalit bilan
-- `POST /rest/v1/rpc/http_post` chaqirilganda 404 qaytadi — ya'ni
-- amaliy hujum yo'li YO'Q, faqat ortiqcha huquq turibdi.
--
-- Blok exception bilan o'ralgan: supautils tizim sxemalarini
-- himoyalaydi. Ruxsat bermasa — butun migratsiya yiqilmasin,
-- qolgan tuzatishlar baribir qo'llansin.
-- ---------------------------------------------------------------------------

do $$
begin
  revoke execute on all functions in schema net from public, anon, authenticated;
  revoke usage on schema net from public, anon, authenticated;

  grant usage on schema net to postgres, service_role;
  grant execute on all functions in schema net to postgres, service_role;

  raise notice 'pg_net: anon/authenticated uchun yopildi';
exception when others then
  raise notice 'pg_net o''zgartirilmadi (%): qo''lda ko''rib chiqing', sqlerrm;
end $$;


-- ---------------------------------------------------------------------------
-- 6. SECURITY DEFINER VIEW LAR
--
-- 12 ta view yaratuvchi (postgres) huquqi bilan ishlaydi, ya'ni ular
-- orqali o'qilgan ma'lumotga RLS TEGMAYDI. Ommaviy ma'lumot ko'rsatgani
-- uchun bugun zarari yo'q, lekin view ta'rifi bir kun o'zgarsa —
-- masalan `profiles` ga join qo'shilsa — RLS chetlab o'tilgani sababli
-- shaxsiy ma'lumot jimgina tashqariga chiqib ketadi.
--
-- Ikki qadam:
--   security_invoker = on  — view endi so'rovchi huquqi bilan ishlaydi
--   revoke                 — anon/authenticated ga umuman kerak emas
--
-- XAVFSIZ: bu view larni faqat edge funksiyalar `supabaseAdmin`
-- (service_role) orqali o'qiydi — tekshirildi. service_role da
-- `bypassrls` bayrog'i bor, ya'ni security_invoker unga ta'sir qilmaydi.
-- Brauzerdan to'g'ridan-to'g'ri view o'qiladigan joy yo'q.
-- ---------------------------------------------------------------------------

do $$
declare
  v text;
  view_lar text[] := array[
    'active_categories_view', 'featured_partners_view', 'public_homepage_view',
    'blogger_social_summary', 'top_social_bloggers', 'social_statistics_summary',
    'breaking_news_view', 'popular_news_view', 'related_news_view',
    'media_library_view', 'unused_media_view', 'popular_media_view'
  ];
begin
  foreach v in array view_lar loop
    if exists (select 1 from pg_views where schemaname = 'public' and viewname = v) then
      execute format('alter view public.%I set (security_invoker = on)', v);
      execute format('revoke all on public.%I from public, anon, authenticated', v);
      execute format('grant select on public.%I to service_role', v);
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 7. O'ZGARUVCHAN search_path
--
-- search_path belgilanmagan funksiyada chaqiruvchi o'z sxemasini
-- oldinga qo'yib, funksiya ichidagi jadval nomini SOXTA jadval bilan
-- almashtira oladi. SECURITY DEFINER funksiyalarda bu to'g'ridan-to'g'ri
-- huquq oshirish yo'li.
--
-- Ro'yxatdagi 8 tadan 2 tasi (create_user_with_profile, setup_user_profile)
-- 1-bo'limda o'chirildi — qolgan 6 tasi shu yerda mahkamlanadi.
-- Funksiya tanalari tekshirildi: hech biri `extensions` sxemasidagi
-- narsaga (crypt va h.k.) murojaat qilmaydi, shuning uchun `public`
-- yetarli. pg_temp oxirida — soxta vaqtinchalik jadval oldini oladi.
-- ---------------------------------------------------------------------------

alter function public.handle_updated_at()               set search_path = public, pg_temp;
alter function public.update_news_sources_updated_at()  set search_path = public, pg_temp;
alter function public.protect_profile_columns()         set search_path = public, pg_temp;
alter function public.claim_next_news_job(character varying) set search_path = public, pg_temp;
alter function public.increment_rate_limit(uuid, uuid, bigint, bigint, bigint)
  set search_path = public, pg_temp;
alter function public.enqueue_news_job(
  character varying, jsonb, integer, uuid, uuid, timestamp with time zone, integer
) set search_path = public, pg_temp;
