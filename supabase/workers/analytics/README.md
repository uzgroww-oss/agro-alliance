# Analytics Worker

**Purpose:** Aggregate and compute platform-wide analytics.

**Inputs:**
- Raw view counts
- User activity logs
- Partner transaction data
- News engagement metrics

**Outputs:**
- Computed statistics in site_stats table
- Dashboard-ready aggregated data
- Trend analysis results

**Flow:**
1. Read raw metrics from past period
2. Aggregate by category/timeframe
3. Compute derived metrics (trends, averages)
4. Write to analytics tables
5. Invalidate cache

**Future Implementation Phase:** 5
