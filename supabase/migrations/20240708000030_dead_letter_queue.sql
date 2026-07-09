-- Migration: Dead Letter Queue for AI jobs

CREATE TABLE IF NOT EXISTS public.ai_dead_letter_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_job_id UUID NOT NULL,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    provider_id UUID,
    model_id UUID,
    prompt_version INTEGER,
    error_message TEXT NOT NULL,
    failed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON TABLE public.ai_dead_letter_jobs TO anon, authenticated, service_role;
