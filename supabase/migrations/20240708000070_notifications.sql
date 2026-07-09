-- ============================================================================
-- Notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       varchar(255) NOT NULL,
  body        text,
  type        varchar(50)  NOT NULL DEFAULT 'info',
  is_read     boolean      NOT NULL DEFAULT false,
  link        varchar(500),
  created_at  timestamptz  NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications (is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX idx_notifications_deleted_at ON public.notifications (deleted_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "Users can mark own notifications as read"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can manage notifications"
  ON public.notifications FOR ALL
  USING (true);
