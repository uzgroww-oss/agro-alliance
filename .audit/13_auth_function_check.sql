SELECT n.nspname AS schema_name, p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('handle_new_user', 'handle_updated_at', 'handle_news_version', 'auth_role', 'auth_roles')
ORDER BY n.nspname, p.proname;
