-- ============================================================================
-- AI Provider System
-- Tables: ai_providers, ai_prompt_templates, ai_costs, ai_job_logs
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. AI Providers
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_providers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                varchar(100) NOT NULL,
  type                varchar(50)  NOT NULL,
  endpoint            varchar(500),
  api_key_encrypted   text,
  models              jsonb        NOT NULL DEFAULT '[]'::jsonb,
  config              jsonb        NOT NULL DEFAULT '{}'::jsonb,
  is_active           boolean      NOT NULL DEFAULT true,
  rate_limit_per_minute integer    NOT NULL DEFAULT 1000,
  rate_limit_per_day    integer    NOT NULL DEFAULT 20000,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE UNIQUE INDEX idx_ai_providers_name ON public.ai_providers (name) WHERE deleted_at IS NULL;
CREATE INDEX idx_ai_providers_type ON public.ai_providers (type);
CREATE INDEX idx_ai_providers_active ON public.ai_providers (is_active) WHERE is_active = true;
CREATE INDEX idx_ai_providers_deleted_at ON public.ai_providers (deleted_at);

CREATE TRIGGER trg_ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 2. AI Prompt Templates
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid        NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  name        varchar(255) NOT NULL,
  version     integer     NOT NULL DEFAULT 1,
  template    text        NOT NULL,
  variables   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_ai_prompt_templates_provider ON public.ai_prompt_templates (provider_id);
CREATE INDEX idx_ai_prompt_templates_active ON public.ai_prompt_templates (is_active) WHERE is_active = true;
CREATE INDEX idx_ai_prompt_templates_deleted_at ON public.ai_prompt_templates (deleted_at);

CREATE TRIGGER trg_ai_prompt_templates_updated_at
  BEFORE UPDATE ON public.ai_prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 3. AI Costs
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_costs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       uuid        NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  model_id          varchar(100),
  prompt_tokens     integer     NOT NULL DEFAULT 0,
  completion_tokens integer     NOT NULL DEFAULT 0,
  cost_usd          decimal(10,6) NOT NULL DEFAULT 0,
  operation         varchar(100),
  user_id           uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_costs_provider ON public.ai_costs (provider_id);
CREATE INDEX idx_ai_costs_created_at ON public.ai_costs (created_at DESC);
CREATE INDEX idx_ai_costs_user ON public.ai_costs (user_id) WHERE user_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 4. AI Job Logs
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_job_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        varchar(100) NOT NULL,
  status          varchar(50)  NOT NULL DEFAULT 'pending',
  provider_id     uuid,
  model_id        varchar(100),
  input_tokens    integer     NOT NULL DEFAULT 0,
  output_tokens   integer     NOT NULL DEFAULT 0,
  cost_usd        decimal(10,6) NOT NULL DEFAULT 0,
  duration_ms     integer,
  error_message   text,
  metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_job_logs_type ON public.ai_job_logs (job_type);
CREATE INDEX idx_ai_job_logs_status ON public.ai_job_logs (status);
CREATE INDEX idx_ai_job_logs_created_at ON public.ai_job_logs (created_at DESC);

-- --------------------------------------------------------------------------
-- 5. RLS
-- --------------------------------------------------------------------------

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage ai_providers"
  ON public.ai_providers FOR ALL
  USING (auth_role() = 'super_admin');

CREATE POLICY "Super admin can manage ai_prompt_templates"
  ON public.ai_prompt_templates FOR ALL
  USING (auth_role() = 'super_admin');

CREATE POLICY "Super admin can read ai_costs"
  ON public.ai_costs FOR SELECT
  USING (auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Service role can insert ai_costs"
  ON public.ai_costs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Super admin can read ai_job_logs"
  ON public.ai_job_logs FOR SELECT
  USING (auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Service role can insert ai_job_logs"
  ON public.ai_job_logs FOR INSERT
  WITH CHECK (true);
