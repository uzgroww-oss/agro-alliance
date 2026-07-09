# Social Queue

**Purpose:** Schedule and process social media posts.

**Job Payload:**
```json
{
  "action": "post | collect_stats",
  "platform": "telegram | instagram | youtube",
  "content": { "text": "...", "media": "..." }
}
```

**Consumed by:** `workers/social`

**Retry Policy:** 2 retries, 10min backoff

**Dead-letter after:** 2 failed attempts
