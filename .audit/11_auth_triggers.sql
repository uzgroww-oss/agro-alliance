-- Check for auth schema triggers (handle_new_user)
SELECT
    t.tgname AS trigger_name,
    c.relname AS table_name,
    n.nspname AS schema_name,
    p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'auth'
  AND NOT t.tgisinternal;
