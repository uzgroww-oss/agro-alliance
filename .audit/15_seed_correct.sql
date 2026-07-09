SELECT 'roles' AS tbl, COUNT(*)::text AS cnt FROM public.roles
UNION ALL
SELECT 'permissions', COUNT(*)::text FROM public.permissions
UNION ALL
SELECT 'role_permissions', COUNT(*)::text FROM public.role_permissions
UNION ALL
SELECT 'news_categories', COUNT(*)::text FROM public.news_categories
UNION ALL
SELECT 'social_platforms', COUNT(*)::text FROM public.social_platforms
UNION ALL
SELECT 'public_settings', COUNT(*)::text FROM public.public_settings
UNION ALL
SELECT 'bloggers', COUNT(*)::text FROM public.bloggers
ORDER BY tbl;
