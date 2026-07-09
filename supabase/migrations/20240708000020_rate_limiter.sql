-- Migration: Rate Limiter tables and helper function

CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL,
    model_id UUID NOT NULL,
    minute_window TIMESTAMP WITH TIME ZONE NOT NULL,
    day_window DATE NOT NULL,
    request_count BIGINT NOT NULL DEFAULT 0,
    token_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uniq_provider_model_minute UNIQUE (provider_id, model_id, minute_window),
    CONSTRAINT uniq_provider_model_day UNIQUE (provider_id, model_id, day_window)
);

-- Function to atomically check and increment limits. Returns true if within limits.
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
    p_provider_id UUID,
    p_model_id UUID,
    p_tokens BIGINT,
    p_minute_quota BIGINT,
    p_day_quota BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
    v_minute_ts TIMESTAMP WITH TIME ZONE := date_trunc('minute', now());
    v_day DATE := (now() AT TIME ZONE 'UTC')::date;
    v_minute_rec RECORD;
    v_day_rec RECORD;
BEGIN
    -- Minute bucket
    SELECT * INTO v_minute_rec FROM ai_rate_limits
    WHERE provider_id = p_provider_id AND model_id = p_model_id AND minute_window = v_minute_ts
    FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO ai_rate_limits (provider_id, model_id, minute_window, day_window, request_count, token_count)
        VALUES (p_provider_id, p_model_id, v_minute_ts, v_day, 1, p_tokens);
    ELSE
        IF v_minute_rec.request_count + 1 > p_minute_quota OR v_minute_rec.token_count + p_tokens > p_minute_quota THEN
            RETURN FALSE;
        END IF;
        UPDATE ai_rate_limits
        SET request_count = request_count + 1,
            token_count = token_count + p_tokens
        WHERE id = v_minute_rec.id;
    END IF;

    -- Day bucket
    SELECT * INTO v_day_rec FROM ai_rate_limits
    WHERE provider_id = p_provider_id AND model_id = p_model_id AND day_window = v_day
    FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO ai_rate_limits (provider_id, model_id, minute_window, day_window, request_count, token_count)
        VALUES (p_provider_id, p_model_id, v_minute_ts, v_day, 1, p_tokens);
    ELSE
        IF v_day_rec.request_count + 1 > p_day_quota OR v_day_rec.token_count + p_tokens > p_day_quota THEN
            RETURN FALSE;
        END IF;
        UPDATE ai_rate_limits
        SET request_count = request_count + 1,
            token_count = token_count + p_tokens
        WHERE id = v_day_rec.id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_rate_limit(UUID, UUID, BIGINT, BIGINT, BIGINT) TO anon, authenticated, service_role;
