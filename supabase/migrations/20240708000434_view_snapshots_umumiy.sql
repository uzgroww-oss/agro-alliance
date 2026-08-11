-- ============================================================================
-- SNAPSHOT JADVALI ENDI FAQAT YOUTUBE UCHUN EMAS
-- ============================================================================
-- MUAMMO: bosh sahifadagi "Oylik ko'rishlar" ikki tarmoqning
-- yig'indisi edi, lekin ular BOSHQA-BOSHQA narsani o'lchardi:
--
--   YouTube   — oy davomida ORTGAN ko'rish (umrbod jamining ayirmasi).
--               Eski videolarga tushgan ko'rishlar ham ichida.
--   Instagram — o'sha oyda JOYLANGAN postlarning ko'rishi.
--               Eski postlarga shu oy tushgan ko'rish hisobga olinmasdi,
--               oy oxirida chiqqan post esa hali ko'rish yig'ib
--               ulgurmagan bo'lardi.
--
-- Ikkalasini qo'shib bitta raqam qilish — turli o'lchovlarni qo'shish.
-- Instagram 93% hissa qo'shgani uchun natija amalda Instagram usuliga
-- tayanardi.
--
-- YECHIM: Instagram ham snapshot ayirmasiga o'tadi. "Umrbod jami"
-- sifatida akkauntning BARCHA postlari ko'rishlari yig'indisi olinadi
-- — u faqat o'sadi, ya'ni ayirma "oy davomida ortgan ko'rish" degani
-- bo'ladi. Aynan YouTube dagidek.
--
-- Jadval nomi shu sababdan o'zgaradi: `youtube_view_snapshots` endi
-- yolg'on nom bo'lardi va kod o'qigan odam Instagram bu yerda emas deb
-- o'ylardi. Ma'lumot yo'qolmaydi — `alter table ... rename` qatorlarni
-- saqlaydi. (Xuddi shu yo'l bilan `yt_izoh_javob` -> `izoh_javob`
-- bo'lgan edi.)
--
-- `platform` ustuni KERAK EMAS: `account_id` allaqachon
-- `social_accounts` orqali tarmoqni bildiradi.
-- ============================================================================

alter table if exists public.youtube_view_snapshots rename to view_snapshots;

comment on table public.view_snapshots is
  'Akkauntning oy boshidagi UMRBOD ko''rishlari. Oylik ko''rish = shu oy jami - o''tgan oy jami. '
  'YouTube uchun kanal statistikasidan, Instagram uchun barcha postlar ko''rishining yig''indisidan.';

comment on column public.view_snapshots.lifetime_views is
  'Umrbod jami. Faqat o''sishi kutiladi; kamaysa (video/post o''chirilgan) chaqiruvchi zaxira usulga o''tadi.';
