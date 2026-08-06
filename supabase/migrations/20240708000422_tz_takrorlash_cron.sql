-- ============================================================================
-- TAKRORLANUVCHI TZ REJALASHTIRUVCHISI
-- ============================================================================
-- Hamkor "har kuni / har hafta / har oy" bajariladigan TZ bergan bo'lsa,
-- har davr uchun yangi topshiriq kerak. Uni kimdir yaratishi shart —
-- panel ochilishini kutib bo'lmaydi: hamkor ham, bloger ham panelga
-- kirmagan kunlarda TZ umuman yaratilmasdi.
--
-- SOATIGA BIR MARTA: "har kuni" degan TZ uchun bir soatlik farq
-- ahamiyatsiz, daqiqada bir marta ishlash esa bekorga yuk bo'lardi.
--
-- Kalit Vault'dan olinadi (qarang 20240708000390_cron_secret_from_vault.sql):
-- migratsiya matnida maxfiy kalit bo'lmasligi kerak, repozitoriya ommaviy.
-- ============================================================================

select cron.unschedule('agro-tz-takrorlash')
where exists (select 1 from cron.job where jobname = 'agro-tz-takrorlash');

select cron.schedule('agro-tz-takrorlash', '5 * * * *', $job$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/jobs?job=tz-takrorlash',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret()
    ),
    body := '{}'::jsonb
  );
$job$);
