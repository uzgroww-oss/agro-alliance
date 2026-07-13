-- Widen cover/avatar columns (base64 data URLs exceed varchar(500))
-- Use dynamic SQL to drop dependent views

do $$
declare
  v_rec record;
  v_sql text;
begin
  -- Find all views/rules that depend on bloggers.cover or profiles.avatar
  for v_rec in (
    select distinct
      dependent_ns.nspname as schema_name,
      dependent_view.relname as view_name
    from pg_depend
    join pg_rewrite on pg_depend.objid = pg_rewrite.oid
    join pg_class as dependent_view on pg_rewrite.ev_class = dependent_view.oid
    join pg_namespace as dependent_ns on dependent_view.relnamespace = dependent_ns.oid
    join pg_class as source_table on pg_depend.refobjid = source_table.oid
    join pg_attribute on pg_depend.refobjid = pg_attribute.attrelid
      and pg_depend.refobjsubid = pg_attribute.attnum
    join pg_namespace as source_ns on source_table.relnamespace = source_ns.oid
    where source_ns.nspname = 'public'
      and source_table.relname in ('bloggers', 'profiles')
      and pg_attribute.attname in ('cover', 'avatar')
      and dependent_view.relkind = 'v'
  )
  loop
    v_sql := format('drop view if exists %I.%I cascade', v_rec.schema_name, v_rec.view_name);
    execute v_sql;
    raise notice 'Dropped view: %.%', v_rec.schema_name, v_rec.view_name;
  end loop;
end;
$$;

alter table public.bloggers alter column cover type text;
alter table public.profiles alter column avatar type text;
