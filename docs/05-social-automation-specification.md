# Social Automation Specification

## Agro Alliance — Social Media Integration, Monitoring & Auto-Publishing

---

## 1. Overview

Social Automation handles bidirectional integration between Agro Alliance and social platforms (Telegram, Instagram, YouTube, TikTok, Facebook). It enables:
- **Reading**: Auto-fetch blogger stats, videos, and engagement metrics
- **Writing**: Cross-post news articles and platform content to social channels
- **Monitoring**: Listen for brand mentions and relevant content

---

## 2. Platform Integrations

| Platform | Read API | Write API | Auth Method | Priority |
|----------|----------|-----------|-------------|----------|
| Telegram | Bot API | Bot API | Bot Token | P0 |
| YouTube | Data API v3 | OAuth 2.0 | API Key + OAuth | P0 |
| Instagram | Graph API | Graph API | FB Access Token | P1 |
| TikTok | Business API | Business API | Access Token | P2 |
| Facebook | Graph API | Graph API | Page Access Token | P2 |

---

## 3. Telegram Automation

### 3.1 Channel Monitoring
- **Purpose**: Discover news from agro Telegram channels
- **Method**: Agro Alliance bot added as member to target channels
- **Flow**:
  1. Bot receives forwarded messages from monitored channels
  2. Extract: text, media (photo/video), sender info, date
  3. Forward to AI News Engine as potential source
  4. Insert into `news_sources` with source_type = `telegram`

### 3.2 Auto-Publishing to Telegram
- **Purpose**: Share published news articles to Agro Alliance Telegram channel
- **Trigger**: New article published (status = `published`)
- **Flow**:
  1. Format article: title + description + link + hashtags
  2. Attach image (if available)
  3. Post to Telegram channel via Bot API
  4. Log to `social_posts` table
- **Format**:
  ```
  🌾 *{Title}*
  
  {description}
  
  📖 Batasil: {article_url}
  
  #AgroAlliance #{category}
  ```

### 3.3 Telegram Bot Commands
```
/start        → Welcome message with platform info
/yangiliklar  → Latest 5 news articles
/blogerlar    → Top 5 bloggers with links
/hamkor       → Partnership info
/aloqa        → Contact information
/obuna        → Subscribe to newsletter (collects chat_id)
```

---

## 4. YouTube Automation

### 4.1 Blogger Video Auto-Detection
- **Trigger**: Blogger adds YouTube channel / video via dashboard
- **Flow**:
  1. Blogger submits YouTube channel URL or video URL
  2. System calls YouTube Data API v3
  3. For channel: fetch channel name, avatar, subscriber count, recent videos
  4. For video: fetch title, views, thumbnail, duration, publish date
  5. Store in `social_accounts` or `videos` tables

### 4.2 Periodic Stats Refresh
- **Cron**: Every hour
- **Flow**:
  1. For each blogger with YouTube linked:
  2. Fetch current subscriber count via API
  3. Fetch latest video stats (views, likes, comments)
  4. Update `social_account_stats` table
  5. Recalculate aggregate metrics

### 4.3 YouTube Data API Usage
- **Quota**: 10,000 units/day (free tier)
- **Optimization**:
  - Batch channel lookups via comma-separated IDs
  - Cache results for 1 hour minimum
  - Retry with exponential backoff on 403/429

---

## 5. Instagram Automation

### 5.1 Profile Integration
- **Trigger**: Blogger submits Instagram profile URL
- **Flow**:
  1. Instagram Basic Display API or Graph API
  2. Fetch: username, full name, profile picture, follower count, recent media
  3. Store in `social_accounts`

### 5.2 Limitations
- Instagram Graph API requires Facebook Page connection
- `instagram_business_account` needed for full access
- Media content: images, videos, carousel posts
- Rate limit: 200 calls/hour/user

---

## 6. Social Account Linking Flow

### 6.1 Add Social Account (Blogger Dashboard)
```
User: Submits URL → POST /api/me/socials
System:
  1. Parse URL → detect platform (YouTube/Instagram/TikTok/Telegram/Facebook)
  2. Validate URL format
  3. Call platform-specific API to verify existence
  4. Fetch metadata: name, avatar, subscriber count
  5. Insert into `social_accounts` table
  6. Return populated account object
Error Cases:
  - Invalid URL → "Notog'ri link formati"
  - Account not found → "Kanal topilmadi"
  - Already linked → "Bu kanal allaqachon ulangan"
  - API quota exceeded → "Keyinroq urinib ko'ring"
```

### 6.2 Video Link Flow (Blogger Dashboard)
```
User: Submits URL → POST /api/me/videos
System:
  1. Detect platform from URL
  2. Call platform API to fetch video metadata
  3. Extract: title, views, thumbnail, duration, publish date
  4. Insert into `videos` table (linked to blogger profile)
  5. Update aggregate stats
Error Cases:
  - Invalid URL → "Notog'ri video linki"
  - Private video → "Video maxfiy sozlamalarga ega"
  - Video not found → "Video topilmadi"
```

---

## 7. Social Content Publishing

### 7.1 Cross-Post Workflow
- **Purpose**: Share platform news/articles to connected social channels
- **Trigger**: Article published (or scheduled)
- **Target Channels**: Telegram channel (P0), Instagram (P1), Facebook (P2)

### 7.2 Platform-Specific Formatting

**Telegram**:
```
🌾 *{Title}*
{description}
📖 Batasil: {url}
#{category} #AgroAlliance
```

**Instagram**:
```
Image: Article thumbnail/featured image
Caption (Uzbek):
🌾 {Title}
.
{description}
.
🔗 Link in bio: agroalliance.uz/yangiliklar/{slug}
.
#AgroAlliance #QishloqXojaligi #{category}
```

**Facebook**:
```
🌾 {Title}
{description}
🔗 {url}
#AgroAlliance #QishloqXojaligi #{category}
```

### 7.3 Publishing Queue

| Queue | Max Retries | Priority | Rate Limit |
|-------|-------------|----------|------------|
| Telegram | 3 | High | 20 msg/min |
| Instagram | 2 | Medium | 10 posts/day |
| Facebook | 2 | Low | 25 posts/day |

---

## 8. Retry Logic

### 8.1 Retry Strategy
- **First attempt**: Immediate
- **Retry 1**: After 30 seconds
- **Retry 2**: After 5 minutes
- **Retry 3**: After 30 minutes (if applicable)
- **Failure**: Mark as `failed`, log error, notify admin

### 8.2 Retryable Errors
- Network timeout (5xx)
- Rate limit exceeded (429) → wait `Retry-After` header
- Temporary platform unavailability

### 8.3 Non-Retryable Errors
- Invalid credentials / token expired
- Content violates platform policy
- Account suspended/deleted
- Invalid URL format

---

## 9. Social Account Data Model

### 9.1 `social_accounts`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| blogger_id | uuid FK | Blogger profile owner |
| platform | text | youtube, instagram, tiktok, telegram, facebook |
| platform_account_id | text | Platform-specific user/channel ID |
| name | text | Display name on platform |
| avatar | text | Profile picture URL |
| link | text | Profile/channel URL |
| subscribers | int | Current subscriber/follower count |
| subscribers_display | text | Formatted with K/M suffix |
| verified | boolean | Is the account verified? |
| last_sync_at | timestamptz | Last successful data sync |
| created_at | timestamptz | |
| deleted_at | timestamptz | Soft delete |

### 9.2 `videos`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| blogger_id | uuid FK | |
| social_account_id | uuid FK | Which account posted this |
| platform | text | youtube, tiktok, instagram |
| platform_video_id | text | Platform-specific video ID |
| name | text | Video title |
| link | text | Video URL |
| thumbnail | text | Thumbnail image URL |
| views | int | Current view count |
| views_display | text | Formatted view count |
| duration | text | e.g., "10:45" |
| published_at | timestamptz | When published on platform |
| created_at | timestamptz | When added to platform |

### 9.3 `social_posts`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| source_type | text | news, campaign, manual |
| source_id | uuid FK | Reference to source entity |
| platform | text | telegram, instagram, facebook |
| platform_post_id | text | Platform's post ID |
| content | jsonb | Posted content |
| status | text | pending, published, failed |
| error_message | text | Failure reason if any |
| published_at | timestamptz | |
| created_at | timestamptz | |

### 9.4 `social_account_stats_history`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| social_account_id | uuid FK | |
| subscribers | int | Snapshot at this time |
| total_views | int | Cumulative views (if available) |
| engagement_rate | float | Calculated engagement % |
| new_videos | int | Videos published since last snapshot |
| recorded_at | timestamptz | Snapshot timestamp |

---

## 10. Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `social-refresh-stats` | Every hour | Refresh all connected social account stats |
| `social-refresh-videos` | Every 2 hours | Check for new videos from connected accounts |
| `social-post-queue` | Every 5 minutes | Process pending social publishing queue |
| `social-cleanup` | Daily | Remove expired tokens, failed posts older than 30 days |

---

## 11. Rate Limiting & Quota Management

### 11.1 Platform API Quotas
| Platform | Daily Limit | Used For |
|----------|-------------|----------|
| YouTube Data API | 10,000 units | Channel lookups, video stats |
| Instagram Graph API | 200 calls/hour/user | Profile refresh |
| Telegram Bot API | 20 msg/min/channel | Publishing |
| Telegram Bot API | 30 updates/sec | Monitoring |

### 11.2 Quota Tracking
- Log API call counts in `api_usage_log` table
- Alert when usage exceeds 80% of daily quota
- Prioritize calls: stats refresh > video detection > profile lookup
- Fallback to cached data when quota exhausted

---

## 12. Error Handling & Notifications

| Scenario | Action | Notify |
|----------|--------|--------|
| Token expired for social account | Mark account as `needs_reconnect` | Blogger in-app notification |
| API quota exhausted | Skip refresh, use cached data | Admin dashboard alert |
| Platform API returns 5xx | Retry with backoff (max 3) | Log only |
| Account deleted on platform | Soft-delete account, notify blogger | Blogger email |
| New video detected | Auto-import to platform | Log only |

---

## 13. Security Considerations

- Store API tokens in Supabase Vault (encrypted)
- Never expose platform API keys to frontend
- All social API calls originate from Edge Functions (server-side)
- Refresh tokens stored with expiry tracking
- Bot tokens rotated every 90 days
- Webhook endpoints validated via HMAC signature
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTk2NzE3OTA3OCwtMTU4Mjc3ODg1NSwxOD
UzNTA2MTg3LC0xOTIzNzQ0Mzg5XX0=
-->
