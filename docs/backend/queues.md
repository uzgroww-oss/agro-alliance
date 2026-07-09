# Queue Architecture

The queue system enables asynchronous, reliable background job processing.

## Design

```
┌──────────┐    enqueue    ┌──────────┐    dequeue    ┌──────────┐
│ Producer │──────────────▶│  Queue   │──────────────▶│ Consumer │
│ (Function)│              │ (pg_net) │               │ (Worker) │
└──────────┘               └────┬─────┘               └──────────┘
                                │
                     ┌──────────▼──────────┐
                     │      Retry Queue     │
                     │  (exponential backoff)│
                     └──────────┬──────────┘
                                │
                     ┌──────────▼──────────┐
                     │   Dead-Letter Queue  │
                     │   (admin review)     │
                     └─────────────────────┘
```

## Queue Table Structure

```sql
CREATE TABLE job_queue (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,              -- queue type identifier
  payload     JSONB NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal',
  status      TEXT NOT NULL DEFAULT 'pending',
  retries     INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at TIMESTAMPTZ,
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error       TEXT,
  dead_letter_at TIMESTAMPTZ
);
```

## Queue Types

| Queue | Producer | Consumer | Max Retries | Backoff |
|-------|----------|----------|-------------|---------|
| ai | ai-news worker | ai-news worker | 3 | 5min |
| social | social worker | social worker | 2 | 10min |
| email | notifications worker | notifications worker | 3 | 15min |
| media | media worker | media worker | 2 | 5min |
| retry | system (auto) | scheduler worker | — | exponential |
| dead-letter | system (auto) | admin review | — | — |

## Implementation

- Queue uses Supabase pg_net extension for HTTP-based dispatch
- Database table `job_queue` stores all jobs
- Edge Functions poll or are triggered by database changes
- Admin interface for managing stuck/dead-letter jobs
- Phase: 8
