-- Migration: Social Automation Core

-- Table for social posts (metadata about each post to be published)
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'instagram', 'facebook')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'published', 'failed')),
  caption TEXT,
  image_file_id UUID REFERENCES public.media_files(id) ON DELETE SET NULL,
  hashtags TEXT[],
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_posts_article ON public.social_posts (article_id);
CREATE INDEX idx_social_posts_platform ON public.social_posts (platform);

-- Queue of social publish jobs (similar to media_jobs)
CREATE TABLE IF NOT EXISTS public.social_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('publish_telegram','publish_instagram','publish_facebook')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  priority INTEGER NOT NULL DEFAULT 0,
  payload JSONB,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_jobs_status ON public.social_jobs (status);
CREATE INDEX idx_social_jobs_type ON public.social_jobs (job_type, status);
CREATE INDEX idx_social_jobs_pending ON public.social_jobs (priority, scheduled_at) WHERE status = 'pending';

-- Failed publish queue (archive of jobs that exhausted retries)
CREATE TABLE IF NOT EXISTS public.failed_social_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id UUID NOT NULL,
  post_id UUID NOT NULL,
  job_type TEXT NOT NULL,
  payload JSONB,
  error_message TEXT NOT NULL,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_failed_social_jobs_post ON public.failed_social_jobs (post_id);

-- Publish history (audit trail)
CREATE TABLE IF NOT EXISTS public.publish_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  response TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simple analytics table for aggregates
CREATE TABLE IF NOT EXISTS public.publish_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value BIGINT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.social_posts TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.social_jobs TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.failed_social_jobs TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.publish_history TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.publish_analytics TO anon, authenticated, service_role;
