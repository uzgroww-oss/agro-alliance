-- ============================================================================
-- OYLIK KO'RISH: OXIRGI HISOBLANGAN QIYMAT OLINADI
-- ============================================================================
-- 20240708000432 oylik ko'rishni alohida ustunga ajratdi va bosh
-- sahifadagi raqam endi umrbod qiymatga SAKRAMAYDI. Lekin sinov
-- ikkinchi, tinchroq nosozlikni ochdi — raqam TUSHIB ketardi.
--
-- NEGA: view har akkauntning faqat ENG SO'NGGI snapshot qatorini
-- oladi. Bloger profilini yangilaganda bugungi sana bilan yangi qator
-- tushadi, unda esa `monthly_views` BO'SH bo'ladi (uni faqat cron
-- to'ldiradi). Natijada o'sha akkauntning oylik hissasi nolga aylanadi.
--
-- O'lchandi: bitta akkaunt uchun profil yangilash taqlid qilinganda
--   bosh sahifa:  59 034 244 -> 56 376 787   (2.6M yo'qoldi)
-- Blogerlar profilini yangilagan sari raqam sekin-asta yeyilib borardi
-- va buni hech kim sezmasdi.
--
-- YECHIM: oylik ko'rish uchun eng so'nggi qator emas, oylik qiymat
-- HAQIQATAN YOZILGAN eng so'nggi qator olinadi. Boshqa ko'rsatkichlar
-- (obunachi, ko'rish, videolar) avvalgidek eng so'nggi qatordan —
-- ular profil sinxronizatsiyasida yangilanadi va aynan eng yangisi
-- kerak.
-- ============================================================================

create or replace view public.blogger_social_summary as
 SELECT b.id AS blogger_id,
    p.name AS blogger_name,
    b.slug AS blogger_slug,
    b.rating,
    count(sa.id) FILTER (WHERE sa.deleted_at IS NULL AND sa.is_active = true) AS active_platforms,
    COALESCE(sum(ss.subscribers_count) FILTER (WHERE ss.deleted_at IS NULL), 0::numeric) AS total_subscribers,
    COALESCE(sum(ss.views_count) FILTER (WHERE ss.deleted_at IS NULL), 0::numeric) AS total_views,
    COALESCE(avg(ss.engagement_rate) FILTER (WHERE ss.deleted_at IS NULL), 0::numeric) AS avg_engagement_rate,
    COALESCE(sum(ss.videos_count) FILTER (WHERE ss.deleted_at IS NULL), 0::bigint) AS total_videos,
    COALESCE(sum(oy.monthly_views), 0::bigint) AS total_monthly_views
   FROM bloggers b
     JOIN profiles p ON p.id = b.id
     LEFT JOIN social_accounts sa ON sa.blogger_id = b.id AND sa.deleted_at IS NULL
     LEFT JOIN social_statistics ss ON ss.account_id = sa.id AND ss.deleted_at IS NULL AND ss.snapshot_date = (( SELECT max(ss2.snapshot_date) AS max
           FROM social_statistics ss2
          WHERE ss2.account_id = sa.id AND ss2.deleted_at IS NULL))
     /*
       Oylik ko'rish AYRIM yo'l bilan olinadi: sanasi eng yangi qator
       emas, `monthly_views` to'ldirilgan eng so'nggi qator.

       LATERAL har akkaunt uchun ko'pi bilan BITTA qator qaytaradi,
       ya'ni yuqoridagi qo'shilishlarning kardinalligi o'zgarmaydi va
       yig'indilar ikki baravar bo'lib ketmaydi.
     */
     LEFT JOIN LATERAL (
       SELECT s.monthly_views
         FROM social_statistics s
        WHERE s.account_id = sa.id
          AND s.deleted_at IS NULL
          AND s.monthly_views IS NOT NULL
        ORDER BY s.snapshot_date DESC, s.updated_at DESC
        LIMIT 1
     ) oy ON true
  WHERE b.deleted_at IS NULL AND p.status::text = 'active'::text AND p.deleted_at IS NULL
  GROUP BY b.id, p.id, b.slug, p.name, b.rating
  ORDER BY (COALESCE(sum(ss.subscribers_count) FILTER (WHERE ss.deleted_at IS NULL), 0::numeric)) DESC;

-- Xavfsizlik sozlamalari qayta qo'yiladi (20240708000428 ga qarang)
alter view public.blogger_social_summary set (security_invoker = on);
revoke all on public.blogger_social_summary from public, anon, authenticated;
grant select on public.blogger_social_summary to service_role;

-- LATERAL har izohda `account_id` + `snapshot_date` bo'yicha qidiradi
create index if not exists social_statistics_oylik_idx
  on public.social_statistics (account_id, snapshot_date desc)
  where deleted_at is null and monthly_views is not null;
