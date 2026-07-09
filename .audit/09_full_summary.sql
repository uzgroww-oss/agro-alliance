WITH table_counts AS (
    SELECT schemaname || '.' || tablename AS tbl,
           n_live_tup AS row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
)
SELECT 'TOTAL_TABLES' AS metric, COUNT(*)::text AS value FROM pg_tables WHERE schemaname = 'public'
UNION ALL
SELECT 'TOTAL_VIEWS', COUNT(*)::text FROM pg_views WHERE schemaname = 'public'
UNION ALL
SELECT 'TOTAL_FUNCTIONS', COUNT(*)::text FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prokind = 'f' AND p.proname NOT LIKE 'pg_%'
UNION ALL
SELECT 'TOTAL_TRIGGERS', COUNT(*)::text FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND NOT t.tgisinternal
UNION ALL
SELECT 'TOTAL_INDEXES', COUNT(*)::text FROM pg_index idx JOIN pg_class i ON i.oid = idx.indexrelid JOIN pg_class t ON t.oid = idx.indrelid WHERE t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND t.relkind = 'r'
UNION ALL
SELECT 'TOTAL_RLS_POLICIES', COUNT(*)::text FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 'TOTAL_FOREIGN_KEYS', COUNT(*)::text FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
