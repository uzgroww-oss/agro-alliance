# AI News Engine Specification

## Agro Alliance — Automated News Discovery, Generation & Publishing Pipeline

---

## 1. Overview

The AI News Engine is an automated pipeline that discovers agricultural news from multiple sources, validates them, generates Uzbek-language articles, and publishes them to the platform. It runs every 6 hours via Supabase Cron.

### 1.1 Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Discovery   │ → │  Validation  │ → │  Generation  │ → │  Publishing  │
│  Worker      │    │  Worker      │    │  Worker      │    │  Worker      │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  RSS Feeds  │    │  AI Validate │    │  AI Generate │    │  PostgreSQL  │
│  Telegram   │    │  Score≥0.70  │    │  Uzbek text  │    │  + R2 Image  │
│  Web Scrape │    │  Dedup      │    │  800-1200w   │    │  + CDN       │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

---

## 2. Stage 1: Source Discovery

### 2.1 Source Types

| Source | Type | Method | Priority |
|--------|------|--------|----------|
| Agro RSS Feeds (Uzbekistan) | RSS/Atom | Fetch + parse XML | Primary |
| Telegram Channels | Bot API | Subscribe + forward | Primary |
| International Agro News | RSS | Fetch + translate to Uzbek | Secondary |
| Government Agriculture Websites | Web scrape | Fetch + extract text | Secondary |
| Social Media (Instagram, Facebook) | Public API | Hashtag/keyword monitoring | Tertiary |

### 2.2 RSS Feed Sources (Initial)

```
Source: Agro-Uzbekistan
  URL: https://agro.uz/rss/news
  Lang: Uzbek

Source: UzAgroNews
  URL: https://uzagronews.uz/rss
  Lang: Uzbek

Source: FAO News
  URL: https://www.fao.org/news/rss
  Lang: English (translate)

Source: Reuters Agriculture
  URL: https://www.reuters.com/tools/rss/agriculture
  Lang: English (translate)

Source: World Agroforestry
  URL: https://www.worldagroforestry.org/rss.xml
  Lang: English (translate)
```

### 2.3 Telegram Channels (Initial)

```
Channel: @AgroUzbekistan
Channel: @QishloqXojaligiYangiliklari
Channel: @FermerUz
```

### 2.4 Discovery Worker Flow

1. On cron trigger (`ai-news-worker`):
2. For each active source:
   a. Fetch content (RSS parse, Telegram API, or web scrape)
   b. Extract: title, description, date, image URL, source URL, author
   c. Check if URL already exists in `news_sources` table (dedup)
   d. If new: insert into `news_sources` table with status=`pending`
3. Mark completed sources with `last_fetched_at` timestamp
4. Trigger Stage 2 for all `pending` sources

**Worker**: `supabase/functions/ai-news-discover/index.ts`
**Queue**: Insert into `news_sources` table → Row-level trigger invokes validation

---

## 3. Stage 2: AI Validation

### 3.1 Validation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Relevancy Score | 0.40 | Is the content about agriculture? |
| Quality Score | 0.25 | Is the content well-written, substantive? |
| Freshness Score | 0.15 | Is the content recent (< 7 days)? |
| Uniqueness Score | 0.10 | Is this different from existing news on platform? |
| Harmful Content | -1.0 | Flag if contains spam, hate, or misinformation |

**Thresholds**:
- `score >= 0.90`: Auto-publish (no review needed)
- `0.70 <= score < 0.90`: Draft (admin review required)
- `score < 0.70`: Rejected (logged for tuning)

### 3.2 Validation Worker Flow

1. Read `news_sources` where status = `pending`
2. For each source:
   a. Send (title + description) to AI model (Workers AI) with validation prompt
   b. Parse AI response for scores across all criteria
   c. Calculate weighted composite score
   d. If auto-publish threshold met → status = `approved`
   e. If draft threshold → status = `draft`
   f. If rejected → status = `rejected`, store rejection reason
3. Trigger Stage 3 for `approved` items
4. Notify admin for `draft` items (in-app notification)

**AI Validation Prompt** (translated to English for model):
```
Analyze this agricultural news content. Rate each criterion 0.0-1.0:
1. Relevancy to agriculture (crops, livestock, farming, agri-tech)
2. Quality (well-written, informative, substantive)
3. Uniqueness (not generic news)
4. Is there any harmful/misleading content? (yes/no)

Title: {title}
Description: {description}
Source: {source_url}

Return JSON: { "relevancy": 0.95, "quality": 0.80, "unique": 0.70, "harmful": false, "summary": "..." }
```

**Worker**: `supabase/functions/ai-news-validate/index.ts`

---

## 4. Stage 3: Content Generation

### 4.1 Generation Rules

| Rule | Requirement |
|------|-------------|
| Language | Uzbek (O'zbek tilida) |
| Length | 800-1200 words (4-6 paragraphs) |
| Tone | Professional, informative, accessible |
| Structure | Title → Hook paragraph → Body (3-4 para) → Conclusion |
| SEO | Include primary keyword in title + first paragraph |
| Sources | Must cite original source |
| Categorization | Auto-assign to one of 9 categories + relevant tags |
| Image | Generate DALL-E / Stable Diffusion prompt from content |

### 4.2 Generation Worker Flow

1. Read `news_sources` where status = `approved`
2. For each source:
   a. Send (title + description + full text) to AI model with generation prompt
   b. Receive generated article (title, body, category, tags, image prompt)
   c. Generate image via AI (optional — served from original if available)
   d. Insert into `news` table with status = `published` (or `draft` if score < 0.90)
   e. Update `news_sources` status = `generated`
3. Trigger cache invalidation for news endpoints

**AI Generation Prompt**:
```
You are an agricultural news writer for Agro Alliance, an Uzbek-language platform. 
Write a professional news article in Uzbek language based on the following source.

Source Title: {title}
Source Text: {full_text}

Requirements:
- Write 4-6 paragraphs (800-1200 words)
- First paragraph: hook + summary of key points
- Body: detailed information, context, expert opinions
- Conclusion: future outlook or significance
- Category: choose one from [texnologiya, qishloq, bozor, davlat, innovatsiya, ekologiya, tadqiqotlar, xalqaro]
- Tags: 2-4 relevant keywords
- Image prompt: describe a scene to generate for this article

Return JSON:
{
  "title": "...",
  "body": ["para1", "para2", "para3", "para4", ...],
  "category": "...",
  "tags": ["tag1", "tag2"],
  "image_prompt": "...",
  "seo_keyword": "..."
}
```

**Worker**: `supabase/functions/ai-news-generate/index.ts`

---

## 5. Stage 4: Publishing

### 5.1 Auto-Publishing Rules

- Articles with validation score >= 0.90 → auto-publish
- Articles with score 0.70-0.89 → save as draft; admin notified
- Maximum 3 auto-published articles per cron run
- Published articles appear on `/yangiliklar` immediately

### 5.2 Publishing Worker Flow

1. Read `news` where status = `ready` (generated + approved)
2. For each article:
   a. Set `published_at = now()`
   b. Set `status = published`
   c. Generate slug from title (if not already set)
   d. Upload generated image to R2 (if AI-generated)
   e. Increment category counters
3. Clear news cache
4. Push notification to subscribers via Supabase Realtime
5. Log to `audit_log`

**Worker**: `supabase/functions/ai-news-publish/index.ts`

---

## 6. Database Tables

### 6.1 `news_sources`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| source_type | text | rss, telegram, web, social |
| source_name | text | e.g., "Agro-Uzbekistan RSS" |
| source_url | text | Original URL of the content |
| title | text | Original title |
| description | text | Original description |
| full_text | text | Extracted full content |
| image_url | text | Original image URL |
| author | text | Original author |
| published_at | timestamptz | Original publication date |
| fetched_at | timestamptz | When we fetched it |
| status | text | pending, validating, approved, draft, rejected, generated |
| validation_score | float | Composite AI validation score |
| validation_detail | jsonb | Per-criterion scores |
| rejection_reason | text | If rejected |

### 6.2 `news`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| source_id | uuid FK | Reference to news_sources |
| slug | text UNIQUE | URL-friendly identifier |
| title | text | Generated/edited title |
| category | text | One of 9 categories |
| description | text | Short excerpt |
| body | jsonb | Array of paragraphs |
| image | text | R2 image URL |
| tags | jsonb | Array of tag strings |
| author | text | "Agro Alliance" or credited |
| views | int | View counter |
| is_featured | boolean | Featured flag |
| status | text | draft, published, archived |
| published_at | timestamptz | Publication timestamp |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| ai_score | float | Confidence score at generation |
| seo_keyword | text | Primary SEO keyword |

---

## 7. Cron Schedule

| Cron Job | Schedule | Worker | Description |
|----------|----------|--------|-------------|
| `ai-news-pipeline` | Every 6 hours (00:00, 06:00, 12:00, 18:00) | All 4 stages | Full AI news pipeline |
| `ai-social-monitor` | Every 15 minutes | Discovery only | Real-time Telegram monitoring |

---

## 8. AI Model Selection

| Task | Recommended Model | Provider | Fallback |
|------|-------------------|----------|----------|
| Validation | Llama 3.1 70B | Cloudflare Workers AI | GPT-4o mini |
| Generation | Llama 3.1 70B | Cloudflare Workers AI | GPT-4o |
| Image Generation | Stable Diffusion XL | Cloudflare Workers AI | DALL-E 3 |
| Translation | Llama 3.1 70B | Cloudflare Workers AI | Google Translate API |
| SEO Optimization | Llama 3.1 70B | Cloudflare Workers AI | In-house rules |

---

## 9. Quality Assurance

### 9.1 Pre-Publishing Checks
- Fact-check: Flag statistics/numbers for admin review
- Plagiarism: Compare against existing news database
- Language quality: Score for grammar and fluency in Uzbek
- Brand safety: Check against blocked terms list

### 9.2 Monitoring
- Track: auto-publish rate, draft rate, rejection rate
- Track: user engagement on AI-generated articles vs human-written
- Track: AI cost per article
- Alert: if rejection rate > 50% in a run → notify admin

### 9.3 Feedback Loop
- Admin can "reject AI" from published articles
- Rejected articles feed back into model tuning
- User engagement (views, time-on-page) per article → quality signal

---

## 10. Admin Controls

- Enable/disable individual sources
- Set auto-publish threshold (default: 0.90)
- View validation scores for all pending sources
- Manually approve/reject draft articles
- Edit AI-generated articles before publishing
- View pipeline statistics: articles discovered, approved, published per run

---

## 11. Error Handling & Retry

| Error | Action | Retry |
|-------|--------|-------|
| AI model timeout | Retry once with fallback model | 1 retry, 30s timeout |
| Network fetch failure | Mark source as `error`, retry next run | Max 3 retries |
| Invalid AI response (non-JSON) | Retry with stricter prompt | 2 retries |
| R2 upload failure | Log error, skip image, publish text-only | 1 retry |
| Rate limited by source | Skip source for 1 hour | Backoff |

---

## 12. Pipeline States & Transitions

```
┌──────────┐
│ pending  │ ── Stage 1: Discovery ──→ (inserted)
└──────────┘
     │
     ▼
┌──────────┐
│validating│ ── Stage 2: Validation
└──────────┘
     │
     ├── score >= 0.90 ──────→ ┌──────────┐
     │                          │ approved │ ── Stage 3: Generation
     ├── 0.70 <= score < 0.90 → │ draft    │ ── (admin review)
     └── score < 0.70 ────────→ │ rejected │ (dead end)
                                └──────────┘
                                     │
                                     ▼
                              ┌──────────┐
                              │generated │ ── Stage 4: Publishing
                              └──────────┘
                                     │
                                     ▼
                              ┌──────────┐
                              │published │ (live on site)
                              └──────────┘
```
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTk2NzE3OTA3OCwtMTU4Mjc3ODg1NSwtMT
E5OTI3OTA4NiwtMjA1NDY1Njk3NV19
-->
