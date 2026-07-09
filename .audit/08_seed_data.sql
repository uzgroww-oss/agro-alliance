SELECT 'roles' AS tbl, COUNT(*) AS cnt FROM public.roles
UNION ALL
SELECT 'permissions', COUNT(*) FROM public.permissions
UNION ALL
SELECT 'role_permissions', COUNT(*) FROM public.role_permissions
UNION ALL
SELECT 'news_categories', COUNT(*) FROM public.news_categories
UNION ALL
SELECT 'site_stats', COUNT(*) FROM public.site_stats
UNION ALL
SELECT 'social_platforms', COUNT(*) FROM public.social_platforms
UNION ALL
SELECT 'public_settings', COUNT(*) FROM public.public_settings
ORDER BY tbl;
