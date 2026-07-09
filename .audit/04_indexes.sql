SELECT
    i.relname AS index_name,
    t.relname AS table_name,
    pg_get_indexdef(idx.indexrelid) AS index_def,
    idx.indisunique AS is_unique,
    idx.indisprimary AS is_primary
FROM pg_index idx
JOIN pg_class i ON i.oid = idx.indexrelid
JOIN pg_class t ON t.oid = idx.indrelid
WHERE t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND t.relkind = 'r'
ORDER BY t.relname, i.relname;
