-- ============================================================================
-- IZOHLARGA AVTOMATIK JAVOB — HAR 10 DAQIQADA
-- ============================================================================
-- ILGARI SOATIGA BIR MARTA edi (`25 * * * *`). O'sha paytdagi izoh:
-- "izohga 40 daqiqada javob berish ham tez hisoblanadi".
--
-- Amalda unday emas. Tomoshabin izoh yozib, javobni bir soatdan keyin
-- olsa — u allaqachon ketgan bo'ladi. Tarmoqlarning tavsiya algoritmi
-- ham izoh ostidagi faollikni POST YANGI bo'lgan paytda hisobga oladi,
-- ya'ni kechikkan javob ikki tomonlama yo'qotish.
--
-- ENDI HAR 10 DAQIQADA: eng yomon kutish 60 daqiqadan 10 ga tushadi.
--
-- KVOTA HISOBI (YouTube, kuniga 10 000 birlik):
--   izohlarni o'qish  —  1 birlik x 144 yurish = 144 birlik/kun
--   bitta javob       — 50 birlik
-- Ya'ni tez-tez yurishning O'ZI deyarli tekin: kvotani javoblar yeydi,
-- ular soni esa jadvalga emas, YANGI izohlar soniga bog'liq. Bir izohga
-- ikki marta javob berilmaydi — `izoh_javob` da (platform, comment_id)
-- juftligi yagona.
--
-- ⚠️ Agar kvota yetmay qolsa: `izoh_limit` sozlamasini kamaytiring
-- (panel -> Izohlarga javob -> "Bir yurishda ko'pi bilan"). Jadvalni
-- qaytarish shart emas.
--
-- YURISHLAR BIR-BIRINING USTIGA CHIQMAYDI: ishning o'z byudjeti
-- 110 soniya, ya'ni 10 daqiqalik oraliqqa bemalol sig'adi.
--
-- Ish O'ZI hech narsa qilmaydi: bironta tarmoqda avtomatik rejim
-- yoqilmagan bo'lsa darhol qaytadi va tashqi so'rov yubormaydi.
-- ============================================================================

select cron.unschedule('agro-izohlar')
where exists (select 1 from cron.job where jobname = 'agro-izohlar');

select cron.schedule('agro-izohlar', '*/10 * * * *', $job$
  select net.http_post(
    url := 'https://ckdgprxppmtsgrofvkxd.supabase.co/functions/v1/jobs?job=izohlar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.cron_secret()
    ),
    body := '{}'::jsonb
  );
$job$);
