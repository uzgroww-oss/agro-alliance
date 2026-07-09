SELECT
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE schemaname = 'public'
ORDER BY schemaname, viewname;
