# Storage Health

**Purpose:** Monitor Cloudflare R2 and Supabase Storage status.

**Checks:**
- Storage endpoint accessibility
- Upload/read latency
- Storage usage vs quota
- File integrity sampling
- CDN edge status

**Metrics:**
- Total storage used
- Files count
- Average upload speed
- CDN cache hit rate

**Alert Thresholds:**
- Storage usage > 80% quota → warning
- Storage usage > 95% → critical
- Upload failure rate > 2% → warning
- Endpoint unavailable → critical

**Implementation:** Phase 10
