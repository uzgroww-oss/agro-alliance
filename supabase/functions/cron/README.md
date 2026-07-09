# Cron Jobs

Cron-triggered Supabase Edge Functions.

### Schedule
- AI news sync: every 6 hours
- Social stats refresh: daily
- Analytics aggregation: hourly
- Database cleanup: weekly
- YouTube sync: every 3 hours
- Telegram digests: daily

### Configuration
Cron schedules are defined in `supabase/config.toml` under `[functions.cron_jobs]`.

### Implementation
See `supabase/workers/` for individual worker implementations that are triggered by these cron jobs.
