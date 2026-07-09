-- Migration: AI Metrics collection

CREATE TABLE IF NOT EXISTS public.ai_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL,
    model_id UUID NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    metadata JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON TABLE public.ai_metrics TO anon, authenticated, service_role;
