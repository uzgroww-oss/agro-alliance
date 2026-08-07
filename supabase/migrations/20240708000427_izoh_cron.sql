-- ============================================================================
-- IZOHLARGA AVTOMATIK JAVOB — JADVAL YANGILANDI
-- ============================================================================
-- Ish nomi `yt-izoh` dan `izohlar` ga o'zgardi: u endi faqat YouTube
-- emas, Instagram, Facebook va Telegram bilan ham ishlaydi.
--
-- Eski jadval O'CHIRILADI, aks holda u mavjud bo'lmagan ishni chaqirib
-- har soatda 404 olardi va buni hech kim sezmasdi.
--
-- SOATIGA BIR MARTA. Nega tez-tez emas:
--   - izohga 40 daqiqada javob berish ham "tez" hisoblanadi;
--   - har javob tarmoq kvotasidan yeydi (YouTube'da 50 birlik,
--     kuniga 10 000).
--
-- ⚠️ Ish O'ZI hech narsa qilmaydi: bironta tarmoqda avtomatik rejim
-- yoqilmagan bo'lsa darhol qaytadi va tashqi so'rov ham yubormaydi.
-- ============================================================================

select cron.unschedule('agro-yt-izoh')
where exists (select 1 from cron.job where jobname = 'agro-yt-izoh');

select cron.unschedule('agro-izohlar')
where exists (select 1 from cron.job where jobname = 'agro-izohlar');

select cron.schedule('agro-izohlar', '25 * * * *', $job$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/jobs?job=izohlar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret()
    ),
    body := '{}'::jsonb
  );
$job$);
