-- ============================================================================
-- OYLIK KO'RISHLAR ALOHIDA USTUNGA AJRATILADI
-- ============================================================================
-- MUAMMO: `social_statistics.views_count` ustuniga UCHTA har xil narsa
-- yozilardi va ular bir-birini bosib ketardi:
--
--   cron-monthly-views      -> OYLIK ko'rish (snapshot ayirmasi)
--   me-profile-update (YT)  -> kanalning UMRBOD ko'rishi
--   me-profile-update (IG)  -> layk + izoh yig'indisi (ko'rish EMAS)
--   admin-bloggers-social-add -> qo'shilgan paytdagi umrbod ko'rish
--
-- Bosh sahifadagi "Oylik ko'rishlar" aynan shu ustundan hisoblanadi.
-- Ya'ni bloger o'z profilini yangilasa, bugungi sana bilan yangi
-- yozuv tushardi, u ENG SO'NGGI bo'lib qolardi va bosh sahifadagi
-- raqam o'sha zahoti umrbod qiymatga sakrab ketardi — keyingi oyning
-- 1-sanasigacha shunday turardi.
--
-- Hozircha buzilmagan (barcha so'nggi yozuvlar 1-avgustdagi cron'niki),
-- lekin xavf ochiq: istalgan bloger profilini yangilashi yetardi.
--
-- YECHIM: oylik ko'rish uchun ALOHIDA ustun. Endi ikki qiymat
-- bir-biriga umuman tegmaydi:
--   monthly_views — FAQAT cron yozadi, faqat bosh sahifa o'qiydi
--   views_count   — profil sinxronizatsiyasi yozadi (bloger sahifasi)
-- ============================================================================

alter table public.social_statistics
  add column if not exists monthly_views bigint;

comment on column public.social_statistics.monthly_views is
  'Oylik ko''rish. FAQAT cron-monthly-views yozadi. views_count ga aralashtirmang: '
  'u profil sinxronizatsiyasidan keladi va boshqa narsani bildiradi.';

-- ----------------------------------------------------------------------------
-- MAVJUD QIYMATLARNI KO'CHIRISH.
--
-- Ayni damda `views_count` da AYNAN oylik qiymat turibdi — 1-avgustdagi
-- cron uni shunday yozgan (61 akkauntdan 56 tasi). Ko'chirmasak bosh
-- sahifadagi raqam nolga tushib qolardi va keyingi oyning 1-sanasigacha
-- shunday turardi.
--
-- Eski yozuvlar ham ko'chiriladi: ular hech qayerda o'qilmaydi (har
-- akkauntning faqat ENG SO'NGGI yozuvi ishlatiladi), shuning uchun
-- shartni murakkablashtirishning ma'nosi yo'q.
-- ----------------------------------------------------------------------------
update public.social_statistics
   set monthly_views = views_count
 where monthly_views is null
   and views_count is not null;

-- ----------------------------------------------------------------------------
-- View ga yangi ustun qo'shiladi.
--
-- `total_views` TEGILMAYDI: uni bloger profili va ro'yxati ishlatadi,
-- u yerdagi yorliq neytral — "Ko'rishlar". Bosh sahifadagi "Oylik
-- ko'rishlar" esa yangi ustunga o'tadi.
--
-- ⚠️ create or replace view ustunlarni faqat OXIRIGA qo'sha oladi,
-- shuning uchun yangi ustun eng oxirida. Mavjud ustunlarning nomi,
-- turi va tartibi o'zgarmasligi shart.
-- ----------------------------------------------------------------------------
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
    COALESCE(sum(ss.monthly_views) FILTER (WHERE ss.deleted_at IS NULL), 0::bigint) AS total_monthly_views
   FROM bloggers b
     JOIN profiles p ON p.id = b.id
     LEFT JOIN social_accounts sa ON sa.blogger_id = b.id AND sa.deleted_at IS NULL
     LEFT JOIN social_statistics ss ON ss.account_id = sa.id AND ss.deleted_at IS NULL AND ss.snapshot_date = (( SELECT max(ss2.snapshot_date) AS max
           FROM social_statistics ss2
          WHERE ss2.account_id = sa.id AND ss2.deleted_at IS NULL))
  WHERE b.deleted_at IS NULL AND p.status::text = 'active'::text AND p.deleted_at IS NULL
  GROUP BY b.id, p.id, b.slug, p.name, b.rating
  ORDER BY (COALESCE(sum(ss.subscribers_count) FILTER (WHERE ss.deleted_at IS NULL), 0::numeric)) DESC;

-- ----------------------------------------------------------------------------
-- Xavfsizlik sozlamalari QAYTA QO'YILADI.
--
-- 20240708000428 da bu view `security_invoker` ga o'tkazilgan va
-- anon/authenticated dan olib tashlangan edi. `create or replace view`
-- odatda ularni saqlaydi, lekin bunga tayanib qolmaymiz: xavfsizlik
-- sozlamasi jimgina yo'qolishi mumkin bo'lgan narsa emas.
-- ----------------------------------------------------------------------------
alter view public.blogger_social_summary set (security_invoker = on);
revoke all on public.blogger_social_summary from public, anon, authenticated;
grant select on public.blogger_social_summary to service_role;
