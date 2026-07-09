# Retry Queue

**Purpose:** Hold failed jobs for automatic retry with exponential backoff.

**Backoff Strategy:**
- Attempt 1: 5 minutes
- Attempt 2: 15 minutes
- Attempt 3: 30 minutes
- Attempt 4: 1 hour (max)

**Policy:**
- Jobs move to retry queue after first failure
- Each retry increments attempt counter
- After max retries → moves to dead-letter queue
- Manual re-enqueue possible from admin panel

**Monitoring:**
- Track retry rate per queue type
- Alert on high retry counts
- Phase: 8
