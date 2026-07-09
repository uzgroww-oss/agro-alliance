# Queue Health

**Purpose:** Monitor queue depth, processing rates, and dead-letter status.

**Checks:**
- Queue depth per queue type
- Processing rate (jobs/min)
- Retry queue size
- Dead-letter queue size
- Stuck jobs detection

**Metrics:**
- Current queue depth
- Average processing latency
- Retry rate per queue
- DLQ growth rate

**Alert Thresholds:**
- Queue depth > 500 → warning
- Queue depth > 2000 → critical
- DLQ size > 50 → admin alert
- Job stuck in processing > 30min → critical

**Implementation:** Phase 10
