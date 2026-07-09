# AI Queue

**Purpose:** Process AI news generation requests.

**Job Payload:**
```json
{
  "source": "youtube | rss | manual",
  "rawData": "...",
  "config": { "language": "uz", "category": "agro" }
}
```

**Consumed by:** `workers/ai-news`

**Retry Policy:** 3 retries, 5min backoff

**Dead-letter after:** 3 failed attempts
