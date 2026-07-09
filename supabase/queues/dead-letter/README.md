# Dead-Letter Queue

**Purpose:** Store jobs that failed all retry attempts.

**Job to DLQ conditions:**
- Max retries exhausted
- Invalid payload format
- Irrecoverable error

**DLQ Management:**
- Admin review required
- Manual re-enqueue or discard
- Weekly DLQ cleanup
- DLQ size monitoring alert

**Data Retention:** 30 days

**Cleanup:** `workers/cleanup` handles DLQ purging
