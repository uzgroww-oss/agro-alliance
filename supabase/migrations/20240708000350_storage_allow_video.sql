-- ============================================================================
-- Storage bucket'lariga video yuklashga ruxsat
--
-- MUAMMO: edge funksiya (media-get-signed-upload-url) video turini qabul
-- qilib imzolangan manzil berardi, lekin Storage'ning O'ZI faylni rad
-- etardi (PUT -> 400). Chunki bucket sozlamalarida allowed_mime_types
-- ro'yxati bor va unda video yo'q edi.
--
-- EHTIYOTKORLIK:
--   allowed_mime_types = NULL  =>  "hamma tur ruxsat etilgan".
--   Shuning uchun NULL bo'lganini o'zgartirmaymiz — aks holda cheklov
--   YO'Q joyga cheklov qo'shib qo'ygan bo'lardik.
-- ============================================================================

update storage.buckets
set allowed_mime_types = allowed_mime_types || array['video/mp4', 'video/quicktime', 'video/webm']
where id in ('public', 'private')
  and allowed_mime_types is not null
  and not (allowed_mime_types @> array['video/mp4']);

-- Hajm chegarasi: video uchun 100 MB.
-- file_size_limit = NULL => chegara yo'q, unga ham tegmaymiz.
update storage.buckets
set file_size_limit = 104857600
where id in ('public', 'private')
  and file_size_limit is not null
  and file_size_limit < 104857600;
