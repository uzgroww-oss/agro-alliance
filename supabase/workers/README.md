# Workers

Long-running background workers for the Agro Alliance platform.

Each worker is a standalone Deno script or Supabase Edge Function with cron trigger.

### Worker Categories
| Worker | Purpose | Phase |
|--------|---------|-------|
| ai-news | AI news generation pipeline | 4 |
| social | Social media automation | 7 |
| analytics | Analytics aggregation | 5 |
| notifications | Notification delivery | 11 |
| cleanup | Database and storage cleanup | 12 |
| scheduler | Task scheduling | 8 |
| media | Media processing | 6 |

### Deployment
Workers are deployed as Supabase Edge Functions with cron triggers defined in `config.toml`.
