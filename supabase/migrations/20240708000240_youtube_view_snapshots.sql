-- ============================================================================
-- YouTube oylik ko'rish snapshotlari
-- Har oy 1-sanada kanalning umrbod jami ko'rishi yoziladi.
-- Oylik ko'rish = (shu oy jami) − (o'tgan oy jami).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.youtube_view_snapshots (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid        NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  period         date        NOT NULL,          -- oyning 1-sanasi (masalan 2026-08-01)
  lifetime_views bigint      NOT NULL DEFAULT 0, -- o'sha sanadagi umrbod jami ko'rish
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_yt_view_snap_unique
  ON public.youtube_view_snapshots (account_id, period);
CREATE INDEX IF NOT EXISTS idx_yt_view_snap_account ON public.youtube_view_snapshots (account_id);

ALTER TABLE public.youtube_view_snapshots ENABLE ROW LEVEL SECURITY;

-- Faqat service_role boshqaradi (worker/cron orqali)
DROP POLICY IF EXISTS "Service role manages yt snapshots" ON public.youtube_view_snapshots;
CREATE POLICY "Service role manages yt snapshots"
  ON public.youtube_view_snapshots FOR ALL USING (true) WITH CHECK (true);
