# Worker Health

**Purpose:** Monitor background worker status and execution.

**Checks:**
- Last successful execution time
- Execution duration vs threshold
- Error rate per worker
- Worker queue backlog

**Metrics:**
- Jobs processed per interval
- Average processing time
- Failure rate per worker type
- Worker uptime

**Alert Thresholds:**
- Worker not executed in > 2x interval → warning
- Error rate > 10% → critical
- Queue backlog > 100 → warning

**Implementation:** Phase 10
