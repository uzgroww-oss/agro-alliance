-- ============================================================================
-- Blogger TZ topshiriqlariga fayl biriktirish (TZ hujjati)
-- ============================================================================

ALTER TABLE public.blogger_tasks
  ADD COLUMN IF NOT EXISTS file_url  text,
  ADD COLUMN IF NOT EXISTS file_name varchar(500);
