# System Health

**Purpose:** Monitor core infrastructure components.

**Checks:**
- Database connectivity and query latency
- Supabase Auth availability
- Edge Function runtime health
- External API availability (YouTube, Telegram, AI Worker)
- DNS resolution

**Metrics:**
- Response time (p50, p95, p99)
- Error rate per endpoint
- Uptime percentage

**Alert Thresholds:**
- Latency > 2s → warning
- Latency > 5s → critical
- Error rate > 5% → warning
- Service unavailable → critical alert via Telegram

**Implementation:** Phase 10
