# Email Queue

**Purpose:** Send transactional and notification emails.

**Job Payload:**
```json
{
  "to": "user@example.com",
  "template": "welcome | digest | alert",
  "data": { "username": "...", "link": "..." }
}
```

**Consumed by:** `workers/notifications`

**Retry Policy:** 3 retries, 15min backoff

**Dead-letter after:** 3 failed attempts
