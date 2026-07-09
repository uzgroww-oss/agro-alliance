-- AI News Engine — Phase 3
-- Tables: news_sources, news_jobs, news_ingestion_logs
-- AI metadata columns on news_articles

-- 1. News Sources (RSS feeds, websites, Telegram channels)
CREATE TABLE IF NOT EXISTS public.news_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(255) NOT NULL,
  type        varchar(50) NOT NULL,
  url         varchar(500) NOT NULL,
  category_id uuid REFERENCES public.news_categories(id) ON DELETE SET NULL,
  language    varchar(10) NOT NULL DEFAULT 'uz',
  is_active   boolean NOT NULL DEFAULT true,
  fetch_interval_minutes integer NOT NULL DEFAULT 60,
  last_fetched_at timestamptz,
  last_error  text,
  config      jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.news_sources ADD CONSTRAINT chk_news_sources_type
  CHECK (type IN ('rss', 'website', 'telegram'));
ALTER TABLE public.news_sources ADD CONSTRAINT chk_news_sources_language
  CHECK (language IN ('uz', 'ru', 'en'));

CREATE INDEX idx_news_sources_type ON public.news_sources(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_news_sources_active ON public.news_sources(is_active) WHERE is_active = true AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_news_sources_url ON public.news_sources(url) WHERE deleted_at IS NULL;

ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage sources" ON public.news_sources
  FOR ALL USING (auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Workers can read active sources" ON public.news_sources
  FOR SELECT USING (is_active = true AND deleted_at IS NULL);

-- 2. News Jobs Queue
CREATE TABLE IF NOT EXISTS public.news_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type      varchar(100) NOT NULL,
  status        varchar(50) NOT NULL DEFAULT 'pending',
  priority      integer NOT NULL DEFAULT 0,
  payload       jsonb,
  result        jsonb,
  error_message text,
  retry_count   integer NOT NULL DEFAULT 0,
  max_retries   integer NOT NULL DEFAULT 3,
  source_id     uuid REFERENCES public.news_sources(id) ON DELETE SET NULL,
  article_id    uuid REFERENCES public.news_articles(id) ON DELETE SET NULL,
  scheduled_at  timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.news_jobs ADD CONSTRAINT chk_news_jobs_type
  CHECK (job_type IN ('rss_ingest', 'web_crawl', 'telegram_monitor',
                      'ai_validate', 'ai_categorize', 'ai_translate',
                      'ai_summarize', 'ai_seo', 'draft_generate',
                      'auto_publish', 'scheduled_publish'));
ALTER TABLE public.news_jobs ADD CONSTRAINT chk_news_jobs_status
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

CREATE INDEX idx_news_jobs_status ON public.news_jobs(status, scheduled_at)
  WHERE deleted_at IS NULL AND status = 'pending';
CREATE INDEX idx_news_jobs_type ON public.news_jobs(job_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_news_jobs_source ON public.news_jobs(source_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_news_jobs_article ON public.news_jobs(article_id) WHERE deleted_at IS NULL;

ALTER TABLE public.news_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage jobs" ON public.news_jobs
  FOR ALL USING (auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Workers can read pending jobs" ON public.news_jobs
  FOR SELECT USING (status = 'pending' AND deleted_at IS NULL
    AND (scheduled_at IS NULL OR scheduled_at <= now()));

CREATE POLICY "Workers can update jobs" ON public.news_jobs
  FOR UPDATE USING (true) WITH CHECK (true);

-- 3. News Ingestion Logs
CREATE TABLE IF NOT EXISTS public.news_ingestion_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid REFERENCES public.news_jobs(id) ON DELETE SET NULL,
  source_id   uuid REFERENCES public.news_sources(id) ON DELETE SET NULL,
  event_type  varchar(50) NOT NULL,
  message     text,
  metadata    jsonb,
  logged_at   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.news_ingestion_logs ADD CONSTRAINT chk_news_ingestion_logs_type
  CHECK (event_type IN ('started', 'progress', 'completed', 'failed',
                        'retry', 'cancelled', 'duplicate_skipped',
                        'ai_processed', 'translated', 'published'));

CREATE INDEX idx_news_ingestion_logs_job ON public.news_ingestion_logs(job_id);
CREATE INDEX idx_news_ingestion_logs_source ON public.news_ingestion_logs(source_id);
CREATE INDEX idx_news_ingestion_logs_time ON public.news_ingestion_logs(logged_at DESC);

ALTER TABLE public.news_ingestion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read logs" ON public.news_ingestion_logs
  FOR SELECT USING (auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Workers can insert logs" ON public.news_ingestion_logs
  FOR INSERT WITH CHECK (true);

-- 4. AI metadata columns on news_articles
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_confidence numeric(5,2);
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_validated boolean NOT NULL DEFAULT false;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_validated_at timestamptz;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_category_id uuid REFERENCES public.news_categories(id) ON DELETE SET NULL;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_summary_uz text;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_summary_ru text;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_summary_en text;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_translation_uz text;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_translation_ru text;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_translation_en text;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_seo_title varchar(500);
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_seo_description text;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_tags text[];
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_source_fingerprint varchar(64);
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_is_duplicate boolean NOT NULL DEFAULT false;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ai_duplicate_of_id uuid REFERENCES public.news_articles(id) ON DELETE SET NULL;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ingestion_source_id uuid REFERENCES public.news_sources(id) ON DELETE SET NULL;
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS ingestion_job_id uuid REFERENCES public.news_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.news_articles ADD CONSTRAINT chk_news_articles_ai_confidence
  CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 100));

CREATE INDEX idx_news_articles_ai_fingerprint
  ON public.news_articles(ai_source_fingerprint)
  WHERE ai_source_fingerprint IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_news_articles_ai_duplicate
  ON public.news_articles(ai_is_duplicate)
  WHERE ai_is_duplicate = true AND deleted_at IS NULL;
CREATE INDEX idx_news_articles_ai_validated
  ON public.news_articles(ai_validated)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_news_articles_ai_confidence
  ON public.news_articles(ai_confidence DESC)
  WHERE ai_confidence IS NOT NULL AND deleted_at IS NULL;

-- 5. Add 'ai_draft' status to news_articles check constraint
ALTER TABLE public.news_articles DROP CONSTRAINT IF EXISTS chk_news_articles_status;
ALTER TABLE public.news_articles ADD CONSTRAINT chk_news_articles_status
  CHECK (status IN ('draft', 'review', 'ai_draft', 'scheduled', 'published', 'archived', 'deleted'));

-- 6. Function to enqueue a news job
CREATE OR REPLACE FUNCTION public.enqueue_news_job(
  p_job_type varchar,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_priority integer DEFAULT 0,
  p_source_id uuid DEFAULT NULL,
  p_article_id uuid DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_max_retries integer DEFAULT 3
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  INSERT INTO public.news_jobs (job_type, payload, priority, source_id, article_id, scheduled_at, max_retries)
  VALUES (p_job_type, p_payload, p_priority, p_source_id, p_article_id, p_scheduled_at, p_max_retries)
  RETURNING id INTO v_job_id;
  RETURN v_job_id;
END;
$$;

-- 7. Function to claim next pending job (used by workers)
CREATE OR REPLACE FUNCTION public.claim_next_news_job(p_job_type varchar DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_job public.news_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.news_jobs
  WHERE status = 'pending'
    AND deleted_at IS NULL
    AND (scheduled_at IS NULL OR scheduled_at <= now())
    AND (p_job_type IS NULL OR job_type = p_job_type)
  ORDER BY priority DESC, scheduled_at ASC NULLS FIRST, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    UPDATE public.news_jobs
    SET status = 'processing', started_at = now(), retry_count = retry_count + 1
    WHERE id = v_job.id
    RETURNING * INTO v_job;
  END IF;

  RETURN row_to_json(v_job)::jsonb;
END;
$$;

-- 8. Function to log ingestion event
CREATE OR REPLACE FUNCTION public.log_ingestion(
  p_job_id uuid,
  p_source_id uuid,
  p_event_type varchar,
  p_message text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.news_ingestion_logs (job_id, source_id, event_type, message, metadata)
  VALUES (p_job_id, p_source_id, p_event_type, p_message, p_metadata)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;

-- 9. Trigger to update updated_at on news_sources
CREATE OR REPLACE FUNCTION public.update_news_sources_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_news_sources_updated_at ON public.news_sources;
CREATE TRIGGER trg_news_sources_updated_at
  BEFORE UPDATE ON public.news_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_news_sources_updated_at();

-- 10. Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.news_sources TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.news_jobs TO service_role;
GRANT SELECT, INSERT ON public.news_ingestion_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_news_job TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_news_job TO service_role;
GRANT EXECUTE ON FUNCTION public.log_ingestion TO service_role;
