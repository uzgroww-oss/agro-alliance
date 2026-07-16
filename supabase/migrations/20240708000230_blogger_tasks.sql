-- ============================================================================
-- Blogger Topshiriqlari (TZ) — admin blogerlarga topshiriq yuboradi
-- ============================================================================

-- TZ ta'rifi (bitta topshiriq bir yoki ko'p blogerlarga yuboriladi)
CREATE TABLE IF NOT EXISTS public.blogger_tasks (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  title       varchar(255) NOT NULL,
  description text,
  priority    varchar(20)  NOT NULL DEFAULT 'normal',   -- low | normal | high
  deadline    date,
  created_by  uuid         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_blogger_tasks_created_at ON public.blogger_tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blogger_tasks_deleted_at ON public.blogger_tasks (deleted_at);

-- Har bir blogerga biriktirilgan topshiriq + holati
CREATE TABLE IF NOT EXISTS public.blogger_task_assignments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid        NOT NULL REFERENCES public.blogger_tasks(id) ON DELETE CASCADE,
  blogger_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      varchar(20) NOT NULL DEFAULT 'new',   -- new | in_progress | done
  is_read     boolean     NOT NULL DEFAULT false,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_assignment_unique
  ON public.blogger_task_assignments (task_id, blogger_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_assignment_blogger ON public.blogger_task_assignments (blogger_id);
CREATE INDEX IF NOT EXISTS idx_task_assignment_task ON public.blogger_task_assignments (task_id);

ALTER TABLE public.blogger_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blogger_task_assignments ENABLE ROW LEVEL SECURITY;

-- RLS: bloger faqat o'ziga biriktirilgan topshiriqni ko'radi/yangilaydi
DROP POLICY IF EXISTS "Blogger reads own assignments" ON public.blogger_task_assignments;
CREATE POLICY "Blogger reads own assignments"
  ON public.blogger_task_assignments FOR SELECT
  USING (blogger_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Blogger updates own assignments" ON public.blogger_task_assignments;
CREATE POLICY "Blogger updates own assignments"
  ON public.blogger_task_assignments FOR UPDATE
  USING (blogger_id = auth.uid());

DROP POLICY IF EXISTS "Blogger reads assigned tasks" ON public.blogger_tasks;
CREATE POLICY "Blogger reads assigned tasks"
  ON public.blogger_tasks FOR SELECT
  USING (
    deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.blogger_task_assignments a
      WHERE a.task_id = blogger_tasks.id AND a.blogger_id = auth.uid() AND a.deleted_at IS NULL
    )
  );
