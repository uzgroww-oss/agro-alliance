-- Video posti uchun MUQOVA (cover).
--
-- Ilgari muqova image_url ni almashtirar edi va video yo'qolardi.
-- Endi video image_url'da qoladi, muqova esa cover_url'da alohida
-- saqlanadi — Instagram REELS uchun cover, YouTube uchun thumbnail.
alter table public.smm_posts
  add column if not exists cover_url text;
