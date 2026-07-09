# Worker Architecture

Background workers handle long-running or scheduled tasks that cannot run within an Edge Function request lifecycle.

## Worker Types

### ai-news
- **Purpose:** AI-powered news generation
- **Trigger:** Cron (every 6 hours) + Queue
- **Data Flow:** External sources → AI Worker → Validate → Database → Notify
- **Phase:** 4

### social
- **Purpose:** Social media automation
- **Trigger:** Cron (daily) + Queue
- **Data Flow:** Schedule → Post → Collect stats → Database
- **Phase:** 7

### analytics
- **Purpose:** Analytics aggregation
- **Trigger:** Cron (hourly)
- **Data Flow:** Raw metrics → Aggregate → Compute → Database → Invalidate cache
- **Phase:** 5

### notifications
- **Purpose:** Notification dispatch
- **Trigger:** Queue (event-driven)
- **Data Flow:** Queue → Build message → Send (Telegram/Email) → Status update
- **Phase:** 11

### cleanup
- **Purpose:** Database and storage maintenance
- **Trigger:** Cron (weekly)
- **Data Flow:** Identify stale records → Archive/Delete → Log
- **Phase:** 12

### scheduler
- **Purpose:** Job scheduling and orchestration
- **Trigger:** Cron (every minute)
- **Data Flow:** Cron → Check schedule → Enqueue jobs → Report
- **Phase:** 8

### media
- **Purpose:** Media processing
- **Trigger:** Queue (event-driven)
- **Data Flow:** Upload notification → Validate → Process → Store → Update metadata
- **Phase:** 6

## Execution Model

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Cron Job   │────▶│  Scheduler   │────▶│   Queue     │
└─────────────┘     │  Worker      │     │  System     │
                    └──────────────┘     └──────┬──────┘
                                                │
                                        ┌───────▼───────┐
                                        │   Consumers   │
                                        │  (Workers)    │
                                        └───────────────┘
```

## Error Handling
- All workers log errors via `_shared/logger.ts`
- Failed jobs go to retry queue with exponential backoff
- Irrecoverable failures go to dead-letter queue for admin review
- Critical failures trigger Telegram alerts
