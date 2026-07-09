SELECT
    t.tgname AS trigger_name,
    c.relname AS table_name,
    p.proname AS function_name,
    t.tgenabled AS enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;
