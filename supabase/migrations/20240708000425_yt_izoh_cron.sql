-- ============================================================================
-- YOUTUBE IZOHLARIGA AVTOMATIK JAVOB — JADVAL
-- ============================================================================
-- SOATIGA BIR MARTA. Nega tez-tez emas:
--   - izohga 40 daqiqada javob berish ham "tez" hisoblanadi, tomoshabin
--     buni sezmaydi;
--   - har javob YouTube kvotasidan 50 birlik yeydi (kuniga 10 000).
--     Daqiqada bir yurish kvotani soatlar ichida tugatardi.
--
-- ⚠️ Ish O'ZI hech narsa qilmaydi: `yt_izoh_avto` sozlamasi o'chiq
-- bo'lsa darhol qaytadi. Ya'ni bu jadval yoqilgan bo'lsa ham, javoblar
-- tahririyat ataylab yoqmaguncha chiqmaydi.
--
-- Kalit Vault'dan olinadi (qarang 20240708000390_cron_secret_from_vault.sql):
-- migratsiya matnida maxfiy kalit bo'lmasligi kerak, repozitoriya ommaviy.
--
-- 25-daqiqa: boshqa ishlar bilan bir vaqtda urishmasin (tz-takrorlash
-- 5-daqiqada).
-- ============================================================================

select cron.unschedule('agro-yt-izoh')
where exists (select 1 from cron.job where jobname = 'agro-yt-izoh');

select cron.schedule('agro-yt-izoh', '25 * * * *', $job$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/jobs?job=yt-izoh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret()
    ),
    body := '{}'::jsonb
  );
$job$);
