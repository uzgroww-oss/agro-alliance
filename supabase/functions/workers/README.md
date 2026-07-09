# Workers Directory

See `supabase/workers/` for actual worker implementations.

This directory groups Edge Functions that act as long-running workers or cron-triggered jobs.

### Worker Categories
- AI news generation workers
- Social media automation workers
- Analytics aggregation workers
- Notification dispatch workers
- Cleanup and maintenance workers
- Scheduled task runners
- Media processing workers

### Deployment
Workers are deployed as Supabase Edge Functions with cron triggers configured in `config.toml`.
