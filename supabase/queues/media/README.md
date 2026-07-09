# Media Queue

**Purpose:** Process uploaded media files (images, videos).

**Job Payload:**
```json
{
  "fileKey": "uploads/abc123.jpg",
  "variants": ["thumbnail", "optimized"],
  "config": { "width": 800, "quality": 80 }
}
```

**Consumed by:** `workers/media`

**Retry Policy:** 2 retries, 5min backoff

**Dead-letter after:** 2 failed attempts
