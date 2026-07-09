# Frontend ↔ Database Compatibility Audit

**Project:** Agro Alliance Platform  
**Frontend:** Vite + React 19 + TypeScript + Tailwind v4  
**Backend:** Supabase (PostgreSQL + Edge Functions)  
**Date:** 2026-07-08  

---

## Executive Summary

| Area | Status | Grade |
|------|--------|-------|
| Authentication Flow | ❌ MISMATCH | D |
| API Endpoint Coverage | 🟡 PARTIAL | C |
| Type System Alignment | ❌ MISMATCH | D |
| Mock Data vs Real Data | ❌ ALL MOCK | F |
| Database Table Utilization | 🟡 PARTIAL | C |
| Role/Permission Model | ❌ MISMATCH | D |
| Storage Buckets | ❌ MISSING | F |
| Realtime Subscriptions | ❌ MISSING | F |
| Unused DB Objects | ⚠️ 27 tables unused | C |
| **Overall** | **Major refactoring required** | **D** |

---

## 1. Authentication Flow — ❌ CRITICAL MISMATCH

### Frontend Expectation (from `auth.tsx`)
```
POST /api/auth/login  → { token: string, user: User }
GET  /api/auth/me     → { user: User }
```

### Frontend `User` type (from `api.ts`):
```typescript
type User = {
  id: number                    // DB uses UUID
  name: string
  email: string
  role: "superadmin" | "blogger" | "client"  // DB uses "super_admin" | "company"
  partnerId?: number            // DB uses UUID
  status?: string
  profile?: Record<string, string>
  socials?: { id: number; platform: string; link: string; connected: boolean; name?: string; avatar?: string; subscribers?: string }[]
  videos?: { id: number; name: string; link: string; views: string; plats: string[]; date: string; status: string; thumbnail?: string; author?: string }[]
}
```

### DB Reality
| Aspect | Frontend | Database | Issue |
|--------|----------|----------|-------|
| User ID type | `number` | `uuid` | ⛔ **BREAKING** — all `id` fields must be strings |
| Role field | Flat string on `User` | Normalized via `user_roles` + `roles` join | ⛔ **BREAKING** — requires `auth_role()` function call |
| Role values | `"superadmin"`, `"blogger"`, `"client"` | `"super_admin"`, `"admin"`, `"editor"`, `"blogger"`, `"company"`, `"user"` | ⛔ **BREAKING** — `superadmin` vs `super_admin`, `client` vs `company` |
| Partner ID type | `number` | `uuid` | ⛔ **BREAKING** |
| Social accounts | Nested array on User | Separate table `social_accounts` | ⛔ **BREAKING** — requires joins |
| Videos | Nested array on User | Separate table (not present for bloggers) | ⛔ **BREAKING** — no `videos` table exists |
| Auth endpoint | Custom `/api/auth/*` | Supabase Auth REST API at `{project}.supabase.co/auth/v1` | ⛔ **MISSING** — needs Edge Function or direct client SDK |

### Fix Required
1. Change all `id` types from `number` to `string` (UUID)
2. Align role names: `superadmin` → `super_admin`, `client` → `company`
3. Add `admin` and `editor` role handling
4. Replace nested User.socials and User.videos with API calls to respective endpoints
5. Create Edge Functions: `auth-login`, `auth-me`, or use Supabase JS client directly

---

## 2. API Endpoint Coverage — 🟡 PARTIAL

### Endpoints Expected by Frontend vs DB/Backend Reality

| Frontend Call | Expected Response | DB Object | Status |
|--------------|-------------------|-----------|--------|
| `GET /api/public/stats` | `{ stats: [{ key, value, label }] }` | `homepage_stats` table | ⚠️ Table exists, no API endpoint |
| `GET /api/public/bloggers/:slug` | `{ blogger: Live }` | `bloggers` + `profiles` + `social_accounts` | ⚠️ No API endpoint |
| `GET /api/bloggers` | `{ bloggers: Row[] }` | `bloggers` + `profiles` + `user_roles` | ⚠️ No API endpoint |
| `POST /api/bloggers` | Create blogger | `auth.users` + `profiles` + `bloggers` + `user_roles` | ⚠️ No API endpoint |
| `DELETE /api/bloggers/:id` | Delete | Soft-delete on `bloggers` | ⚠️ No API endpoint |
| `PATCH /api/bloggers/:id/status` | Toggle | Update `profiles.status` | ⚠️ No API endpoint |
| `GET /api/partners` | `{ partners: Partner[] }` | `partners` + `partner_tasks` | ⚠️ No API endpoint |
| `POST /api/partners` | Create | `partners` | ⚠️ No API endpoint |
| `DELETE /api/partners/:id` | Delete | `partners` soft-delete | ⚠️ No API endpoint |
| `PATCH /api/partners/:pid/tasks/:tid` | Cycle task | `partner_tasks` | ⚠️ No API endpoint |
| `POST /api/partners/:pid/tasks` | Add task | `partner_tasks` | ⚠️ No API endpoint |
| `POST /api/partners/:pid/client` | Create client login | `auth.users` + `profiles` + `user_roles` + `partners.client_profile_id` | ⚠️ No API endpoint |
| `DELETE /api/partners/:pid/client` | Remove client | Reverse of above | ⚠️ No API endpoint |
| `GET /api/stats` | `{ stats: StatItem[] }` | `homepage_stats` | ⚠️ No API endpoint |
| `PUT /api/stats` | Update stats | `homepage_stats` | ⚠️ No API endpoint |
| `GET /api/me` | `{ me: User }` | `profiles` + `bloggers` + `user_roles` | ⚠️ No API endpoint |
| `PUT /api/me/profile` | Update profile | `profiles` + `bloggers` | ⚠️ No API endpoint |
| `POST /api/me/socials` | Add social | `social_accounts` | ⚠️ No API endpoint |
| `DELETE /api/me/socials/:id` | Remove social | `social_accounts` soft-delete | ⚠️ No API endpoint |
| `POST /api/me/videos` | Add video | 🔴 **No videos table exists** | ❌ **MISSING** |
| `DELETE /api/me/videos/:id` | Remove video | 🔴 **No videos table exists** | ❌ **MISSING** |
| `GET /api/me/partner` | `{ partner: Partner }` | `partners` via `profiles.partner_id` | ⚠️ No API endpoint |
| `POST /api/contact` (expected) | Submit form | 🔴 **No contact_messages table exists** | ❌ **MISSING** |
| `POST /api/newsletter` (expected) | Subscribe | 🔴 **No newsletter_subscribers table exists** | ❌ **MISSING** |

**Total API endpoints needed: 23**  
**Existing: 0** (all need Edge Functions or direct DB queries via supabase-js)

---

## 3. Type System Alignment — ❌ CRITICAL MISMATCHES

### 3.1 `User` type (frontend `api.ts`) vs DB

| Field | Frontend Type | DB Column/Table | Match |
|-------|--------------|-----------------|-------|
| `id` | `number` | `profiles.id` (uuid) | ❌ |
| `name` | `string` | `profiles.name` | ✅ |
| `email` | `string` | `profiles.email` | ✅ |
| `role` | `"superadmin" | "blogger" | "client"` | `auth_role()` returns DB role name | ❌ naming + missing roles |
| `partnerId` | `number?` | `profiles.partner_id` (uuid) | ❌ type |
| `status` | `string?` | `profiles.status` | ✅ |
| `profile` | `Record<string, string>?` | `profiles.*` columns | ⚠️ loose typing |
| `socials` | `Social[]` | `social_accounts` table | ⚠️ needs join query |
| `videos` | `Video[]` | 🔴 **No videos table** | ❌ |

### 3.2 `Blogger` type (frontend `bloggers.ts`) vs DB

| Field | Frontend | DB Equivalent | Match |
|-------|----------|---------------|-------|
| `slug` | `string` | `bloggers.slug` | ✅ |
| `name` | `string` | `profiles.name` | ✅ |
| `cat` | `string` | `blogger_specializations.specialization_key` | ⚠️ M:N not flat |
| `tag` | `string` | Composite | ⚠️ computed |
| `subs` | `string` (e.g. "1.2M+") | `social_statistics.subscribers_count` | ⚠️ aggregated |
| `subsNum` | `number` | `social_statistics.subscribers_count` | ⚠️ needs join |
| `eng` | `string` (e.g. "8.7%") | `social_statistics.engagement_rate` | ⚠️ needs join |
| `rating` | `number` | `bloggers.rating` | ✅ |
| `region` | `string` | `blogger_regions.region` | ⚠️ M:N not flat |
| `seed` | `string` (for picsum) | 🔴 **No equivalent in DB** | ❌ mock-only |
| `top` | `boolean?` | `bloggers.is_featured` | ⚠️ renamed |

### 3.3 `News` type (frontend `news.ts`) vs DB

| Field | Frontend | DB Equivalent | Match |
|-------|----------|---------------|-------|
| `slug` | `string` | `news_articles.slug` | ✅ |
| `title` | `string` | `news_articles.title` | ✅ |
| `cat` | `string` | `news_articles.category_id` (FK) | ⚠️ ID vs key |
| `desc` | `string` | `news_articles.excerpt` | ⚠️ renamed |
| `date` | `string` | `news_articles.published_at` | ⚠️ format |
| `views` | `string` (e.g. "14.2K") | `news_articles.view_count` (int) | ⚠️ formatted |
| `seed` | `string` (for picsum) | 🔴 **No equivalent** | ❌ mock-only |
| `top` | `boolean?` | `news_articles.is_featured` / `is_breaking` | ⚠️ ambiguous |
| `author` | `string?` | `profiles.name` via `author_id` | ⚠️ needs join |
| `body` | `string[]` | `news_articles.body` | ⚠️ DB type unknown |

### 3.4 `Live` type (frontend `BloggerProfile.tsx`) vs DB

| Field | Frontend | DB Equivalent | Match |
|-------|----------|---------------|-------|
| `slug` | `string` | `bloggers.slug` | ✅ |
| `name` | `string` | `profiles.name` | ✅ |
| `status` | `string` | `profiles.status` | ✅ |
| `profile` | `Record<string, string>?` | `profiles.*` + `bloggers.*` | ⚠️ loose typing |
| `socials` | `Social[]` | `social_accounts` + `social_platforms` + `social_statistics` | ⚠️ 3-table join |
| `videos` | `Video[]` | 🔴 **No videos table** | ❌ |

### 3.5 CRUD field types (Admin dashboard)

| Frontend Field | Frontend Type | DB Column | Match |
|---------------|--------------|-----------|-------|
| `Row.id` | `number` | `profiles.id` (uuid) | ❌ |
| `Row.cat` | `string` | `blogger_specializations.specialization_key` | ⚠️ M:N |
| `Partner.id` | `number` | `partners.id` (uuid) | ❌ |
| `Partner.contractNo` | `string` | `partners.contract_no` | ⚠️ snake_case |
| `Partner.amount` | `number` | `partners.amount` (numeric?) | ⚠️ type check |
| `Partner.signedDate` | `string` | `partners.signed_date` | ⚠️ snake_case |
| `Task.id` | `number` | `partner_tasks.id` (uuid) | ❌ |
| `Task.status` | `"done"|"progress"|"pending"` | DB has status values | ⚠️ check DB values |
| `PartnerClient.id` | `number` | `profiles.id` (uuid) | ❌ |

---

## 4. Mock Data Status — ❌ ALL PUBLIC PAGES USE MOCK DATA

| Page | Data Source | Connected to DB? | Impact |
|------|-------------|-----------------|--------|
| `Home.tsx` | Hardcoded text + `StatsBar` from API | ❌ StatsBar fetches `/api/public/stats` (returns defaults on error) | 🟡 Partial |
| `Bloggers.tsx` | **`bloggers.ts`** (9 entries, fully hardcoded) | ❌ **No API calls at all** | 🔴 |
| `BloggerProfile.tsx` | `findBlogger()` from mock + optional live API | ❌ Falls back to mock when API fails | 🔴 |
| `News.tsx` | **`news.ts`** (8 entries, fully hardcoded) | ❌ **No API calls at all** | 🔴 |
| `NewsDetail.tsx` | `findNews()` from mock | ❌ **No API calls at all** | 🔴 |
| `Partners.tsx` | Hardcoded `partners[]` + `directions[]` + `stats[]` | ❌ **No API calls at all** | 🔴 |
| `About.tsx` | Hardcoded `team[]` + `pillars[]` | ❌ **No API calls at all** | 🔴 |
| `Contact.tsx` | Form submits locally (no API call) + hardcoded FAQ/offices | ❌ **No API call** | 🔴 |
| `Platform.tsx` | Hardcoded capabilities + stats | ❌ **No API calls at all** | 🔴 |
| `Login.tsx` | Calls `login()` → `/api/auth/login` | ❌ **API endpoint doesn't exist** | 🔴 |
| Admin Dashboard | All CRUD via API | ⚠️ API calls are made, but no endpoints exist | 🔴 |
| Blogger Dashboard | All CRUD via API | ⚠️ API calls are made, but no endpoints exist | 🔴 |
| Client Dashboard | `GET /api/me/partner` | ⚠️ API call made, no endpoint exists | 🔴 |

**Total frontend pages: 14**  
**Pages connected to real data: 0** — all use either mock data or call non-existent APIs

---

## 5. Database Table Utilization — 🟡 PARTIAL (27 of 42 tables unused)

### Tables Used by Frontend (directly or via APIs)
| Table | Used By | How |
|-------|---------|-----|
| `profiles` | Auth, Blogger profiles | `auth_role()`, profile CRUD |
| `roles` | Auth (implicitly) | via `auth_role()` function |
| `user_roles` | Auth (implicitly) | via `auth_role()` function |
| `bloggers` | Blogger listing, profiles | Via API |
| `blogger_specializations` | Blogger niches | Via API |
| `blogger_regions` | Blogger regions | Via API |
| `social_accounts` | Blogger socials tab | Via API |
| `social_platforms` | Social platform icons | Via API |
| `social_statistics` | Subscriber counts | Via API |
| `partners` | Partner management | Via API |
| `partner_tasks` | Task management | Via API |
| `news_articles` | News pages | Via API |
| `news_categories` | News categories | Via API |
| `news_views` | View tracking | Via API |
| `homepage_stats` | StatsBar | Via API |

### Tables Unused by Frontend
| Table | Domain | Purpose | Could Be Used For |
|-------|--------|---------|-------------------|
| `permissions` | RBAC | 72 permission records | Permission checking in admin |
| `role_permissions` | RBAC | 190 assignments | Permission checking |
| `blogger_achievements` | Bloggers | Achievements display | BloggerProfile achievements tab |
| `blogger_availability` | Bloggers | Schedule management | Future feature |
| `blogger_services` | Bloggers | Service listings | BloggerProfile services section |
| `categories` | Content | Generic categories | Content organization |
| `homepage_sections` | Homepage | Section management | Homepage builder |
| `homepage_section_items` | Homepage | Section items | Homepage builder |
| `media_files` | Media | File storage | Media Hub feature |
| `media_folders` | Media | Folder organization | Media Hub |
| `media_tags` | Media | Tagging | Media Hub |
| `media_versions` | Media | Version history | Media Hub |
| `media_transformations` | Media | Image processing | Media Hub |
| `media_usage` | Media | Usage tracking | Media Hub |
| `media_jobs` | Media | Async processing | Media Hub |
| `media_file_tags` | Media | M:N tags | Media Hub |
| `news_article_tags` | News | Tagging | News detail |
| `news_tags` | News | Tag definitions | News filter |
| `news_bookmarks` | News | Bookmarking | News bookmark feature |
| `news_comments` | News | Comments | News comments section |
| `news_related_articles` | News | Related content | NewsDetail related section |
| `news_versions` | News | Version history | News editing |
| `public_settings` | Config | Site settings | Admin settings page |
| `social_account_tokens` | Social | Auth tokens | Social sync |
| `social_statistics_history` | Social | Historical data | Analytics charts |
| `social_sync_jobs` | Social | Sync jobs | Social automation |
| `social_sync_logs` | Social | Sync logging | Social automation |

**42 total tables → 15 used (~36%), 27 unused (~64%)**

---

## 6. Role/Permission Model — ❌ MISMATCH

### Frontend Role Handling (from `App.tsx` and `roles.ts`)
```typescript
// App.tsx — RequireRole guards
<RequireRole role="superadmin"> → /admin
<RequireRole role="blogger">    → /dashboard
<RequireRole role="client">     → /mijoz

// roles.ts — roleHome()
role === "superadmin" ? "/admin" : 
role === "client" ? "/mijoz" : "/dashboard"
```

### DB Role Values
| Frontend Expected | DB Actual | Dashboard Route | Issue |
|-------------------|-----------|-----------------|-------|
| `superadmin` | `super_admin` | `/admin` | ❌ Naming mismatch |
| `blogger` | `blogger` | `/dashboard` | ✅ |
| `client` | `company` | `/mijoz` | ❌ Naming mismatch |
| (not handled) | `admin` | (none) | ❌ Missing |
| (not handled) | `editor` | (none) | ❌ Missing |
| (not handled) | `user` | (none) | ❌ Missing |

### RLS vs Frontend Expectations
- DB has 199 RLS policies covering all tables
- Frontend expects role checks via `auth_role()` function  
- No RLS bypass exists in frontend code
- The frontend role guard is purely client-side — a user could manually navigate to `/admin` without the correct role
- **No server-side permission enforcement** is implemented in the frontend API calls

---

## 7. Missing Storage Buckets — ❌ NONE EXIST

| Frontend Feature | Requires Bucket | Current Behavior |
|-----------------|-----------------|------------------|
| Blogger avatar upload | `avatars` | Uploads via `PUT /api/me/profile` with base64 (no bucket) |
| News cover images | `news-images` | Uses picsum.photos (mock) |
| Blogger cover photos | `blogger-covers` | Uses picsum.photos (mock) |
| Partner logos | `partner-logos` | Uses text placeholders (mock) |
| Media files | `media` | Full media system in DB but no storage bucket |
| Hero/background images | `public-assets` | Stored in `/public/` (static files) |

**Recommended buckets:**
- `avatars` — public read, authenticated write
- `news-images` — public read, editor/admin write
- `blogger-covers` — public read, blogger/admin write
- `partner-logos` — public read, admin write  
- `media` — varies, for the Media Hub feature
- `attachments` — for contact form file uploads

---

## 8. Missing Realtime Subscriptions — ❌ NONE IMPLEMENTED

The entire frontend uses polling (manual refresh after each action). Pages that would benefit:

| Feature | Current Pattern | Realtime Alternative |
|---------|----------------|---------------------|
| Admin dashboard stats | Manual reload on mount | Subscribe to `homepage_stats` |
| Partner tasks | Manual reload after every CRUD | Subscribe to `partner_tasks` |
| Notifications bell | No implementation | Subscribe to `notifications` filtered by user_id |
| News publishing | Manual refresh | Subscribe to `news_articles` where status = 'published' |
| Blogger stats | Manual reload | Subscribe to `social_statistics` |
| Data would benefit from | Polling interval | PostgreSQL LISTEN/NOTIFY or Supabase Realtime |

---

## 9. Views Potentially Serving Frontend — BUT NO EDGE FUNCTIONS

The DB has 17 views that could serve frontend pages directly via the Supabase REST API, but no Edge Functions or endpoints exist:

| View | Could Serve | Current Status |
|------|-------------|----------------|
| `blogger_search_view` | Bloggers.tsx listing + search | Mock data used |
| `popular_news_view` | News.tsx sidebar "popular" | Mock data used |
| `public_homepage_view` | Home.tsx aggregated data | Partially (stats only) |
| `related_news_view` | NewsDetail.tsx related | Mock data used |
| `social_statistics_summary` | Admin stats overview | Hardcoded numbers |
| `top_rated_bloggers_view` | Bloggers.tsx sorted by rating | Mock data used |
| `top_social_bloggers` | Bloggers.tsx sorted by subscribers | Mock data used |
| `unused_media_view` | Admin media cleanup | Not implemented |

---

## 10. Missing Functionality — BACKEND EDGE FUNCTIONS NEEDED

The frontend expects a comprehensive backend API. Currently zero Edge Functions exist:

### Priority 1 — Auth & Profile (Critical)
```
Edge Function: auth-login         → POST   → { token, user }
Edge Function: auth-me            → GET    → { user }
Edge Function: me-profile         → PUT    → Update profile
```

### Priority 2 — Public Pages (High)
```
Edge Function: public-stats       → GET    → { stats }
Edge Function: public-bloggers    → GET    → { bloggers[] }
Edge Function: public-bloggers-slug → GET → { blogger }
Edge Function: public-news        → GET    → { news[] }
Edge Function: public-news-slug   → GET    → { news }
Edge Function: public-partners    → GET    → { partners[] }
```

### Priority 3 — Admin Dashboard (High)
```
Edge Function: admin-bloggers     → GET/POST/DELETE/PATCH
Edge Function: admin-partners     → GET/POST/DELETE + tasks CRUD + client creation
Edge Function: admin-stats        → GET/PUT
```

### Priority 4 — Blogger Dashboard (High)
```
Edge Function: blogger-me         → GET    → { user }
Edge Function: blogger-socials    → POST/DELETE
Edge Function: blogger-videos     → POST/DELETE  (requires videos table)
```

### Priority 5 — Client Dashboard (Medium)
```
Edge Function: client-partner     → GET    → { partner }
```

### Priority 6 — Additional Features (Medium)
```
Edge Function: contact-submit     → POST   → Insert into contact_messages
Edge Function: newsletter-subscribe → POST → Insert into newsletter_subscribers
Edge Function: notifications-list → GET    → List user notifications
Edge Function: homepage-data     → GET    → Return public_homepage_view
```

---

## 11. Critical Missing DB Objects

Based on frontend requirements, these DB objects are missing:

| Missing Object | Required By | Priority |
|----------------|-------------|----------|
| `Videos` table | `BloggerDashboard.tsx` — videos CRUD | **CRITICAL** |
| `Contact messages` API endpoint | `Contact.tsx` form submission | **HIGH** |
| `Newsletter subscribers` table + API | `News.tsx`, `Partners.tsx`, `Contact.tsx` newsletter forms | **HIGH** |
| `Notifications` API (table exists) | `DashboardLayout.tsx` bell icon | **MEDIUM** |
| `Faqs` table | `Contact.tsx` FAQ accordion | **MEDIUM** |
| `Offices` table | `Contact.tsx` offices section | **MEDIUM** |
| `Team members` table | `About.tsx` team section | **LOW** |
| Storage buckets | Avatar upload, news images, partner logos | **HIGH** |

---

## 12. Implementation Roadmap

### Phase 1 — Critical Fixes (Week 1-2)

| Task | Effort | Impact |
|------|--------|--------|
| **1.1** Fix all `id` types: `number` → `string` (UUID) across all frontend types | 2h | 🔴 Many files |
| **1.2** Align role names: `superadmin` → `super_admin`, `client` → `company` in App.tsx, roles.ts, RequireRole | 1h | 🔴 Route guards |
| **1.3** Add `admin` and `editor` role handling to `roles.ts` and route guards | 1h | 🟡 Access control |
| **1.4** Create `Videos` table or add to social system | 3h | 🔴 Blogger dashboard |
| **1.5** Create Supabase Edge Functions for auth: `auth-login`, `auth-me` | 8h | 🔴 All auth |
| **1.6** Fix field naming: `contractNo` → `contract_no`, `signedDate` → `signed_date` etc. in frontend types | 2h | 🟡 Admin dashboard |
| **1.7** Switch to Supabase JS client library for auth (replaces custom `api()` for auth) | 4h | 🔴 Auth flow |

### Phase 2 — API Layer (Week 2-3)

| Task | Effort | Impact |
|------|--------|--------|
| **2.1** Create public Edge Functions: stats, bloggers, news, partners | 16h | 🔴 Public pages |
| **2.2** Create admin Edge Functions: bloggers CRUD, partners CRUD, stats | 16h | 🔴 Admin dashboard |
| **2.3** Create blogger Edge Functions: me, profile, socials | 8h | 🔴 Blogger dashboard |
| **2.4** Create client Edge Function: me/partner | 4h | 🔴 Client dashboard |
| **2.5** Replace `api.ts` with proper Supabase client or well-typed Edge Function calls | 4h | 🟡 All API calls |

### Phase 3 — Replace Mock Data (Week 3-4)

| Task | Effort | Impact |
|------|--------|--------|
| **3.1** Connect `Bloggers.tsx` to `top_rated_bloggers_view` via API | 4h | 🔴 |
| **3.2** Connect `BloggerProfile.tsx` to `blogger_search_view` + social_accounts query | 4h | 🔴 |
| **3.3** Connect `News.tsx` to `news_articles` via API | 4h | 🔴 |
| **3.4** Connect `NewsDetail.tsx` to `news_articles` + `related_news_view` | 3h | 🔴 |
| **3.5** Connect `Partners.tsx` to `partners` via API | 2h | 🟡 |
| **3.6** Connect `Contact.tsx` form to Edge Function | 3h | 🟡 |
| **3.7** Connect newsletter forms to Edge Function | 2h | 🟡 |
| **3.8** Create `contact_messages` table (if not exists) | 1h | 🟡 |

### Phase 4 — Type Alignment (Week 4-5)

| Task | Effort | Impact |
|------|--------|--------|
| **4.1** Create shared TypeScript types matching DB schema in `src/types/` | 4h | 🔴 All files |
| **4.2** Replace inline types with shared types | 3h | 🟡 |
| **4.3** Fix all field name mismatches (kebab/camel/snake) | 2h | 🟡 |
| **4.4** Use `zod` (already installed) for runtime type validation | 4h | 🟡 Quality |

### Phase 5 — Storage & Media (Week 5-6)

| Task | Effort | Impact |
|------|--------|--------|
| **5.1** Create storage buckets: `avatars`, `news-images`, `blogger-covers`, `partner-logos` | 1h | 🔴 |
| **5.2** Configure RLS on storage buckets | 1h | 🔴 |
| **5.3** Implement avatar upload via Supabase Storage (currently base64) | 3h | 🔴 |
| **5.4** Replace picsum.photos with real storage URLs in all pages | 4h | 🟡 |
| **5.5** Build Media Hub admin page using existing media tables | 8h | 🟡 New feature |

### Phase 6 — Realtime & Notifications (Week 6-7)

| Task | Effort | Impact |
|------|--------|--------|
| **6.1** Enable Realtime on `partner_tasks`, `news_articles`, `notifications` | 1h | 🟡 |
| **6.2** Implement realtime subscription for task updates in admin dashboard | 3h | 🟡 |
| **6.3** Build notifications dropdown in DashboardLayout using `notifications` table | 6h | 🟡 New feature |
| **6.4** Replace manual polling with realtime subscriptions | 4h | 🟡 |

### Phase 7 — New Features from Existing DB Objects (Week 7-8)

| Task | Effort | Impact |
|------|--------|--------|
| **7.1** Build news comments section (table exists, frontend needs UI) | 6h | 🟡 |
| **7.2** Build news bookmarking feature (table exists) | 4h | 🟡 |
| **7.3** Add admin settings page backed by `public_settings` table | 4h | 🟡 |
| **7.4** Build homepage builder admin page using `homepage_sections` + `homepage_section_items` | 8h | 🟡 New feature |
| **7.5** Add blogger achievements display from `blogger_achievements` table | 3h | 🟡 |
| **7.6** Add blogger services display from `blogger_services` table | 2h | 🟡 |

---

## Summary of Issues by Severity

### 🔴 CRITICAL (blocks all functionality)
1. No API endpoints exist (0/23 needed)
2. All public pages use mock data exclusively
3. `id` fields use wrong type (number vs UUID)
4. Role names misaligned between frontend and DB
5. No `videos` table for blogger video management
6. No storage buckets for file uploads

### 🟡 HIGH (major features broken)
7. No realtime subscriptions — all data is stale after initial load
8. `Contact.tsx` form doesn't actually submit data anywhere
9. Newsletter signup doesn't subscribe users
10. 27 of 42 database tables are unused by frontend
11. Type system has widespread field name mismatches (camelCase vs snake_case)
12. No server-side permission enforcement

### 🔵 MEDIUM (quality of life)
13. No notification system implementation
14. Team members, offices, FAQs are hardcoded
15. No media hub UI despite complete media database
16. No news comments/bookmarks UI despite tables existing
17. No admin settings page despite `public_settings` table

### ⚪ LOW (nice to have)
18. Zod validation installed but not used
19. The `/platforma` page is hidden from navigation
20. Pagination controls are UI-only (1 page of mock data)

---

## Final Verdict

```
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND ↔ DATABASE COMPATIBILITY AUDIT                        │
│                                                                  │
│  Overall Grade:              D — Major refactoring required      │
│  Critical issues:           5                                     │
│  High issues:               7                                     │
│  Medium issues:             6                                     │
│  Low issues:                3                                     │
│                                                                  │
│  Estimated remediation:     6-8 weeks (1-2 developers)           │
│                                                                  │
│  The frontend is currently a design prototype with mock data.    │
│  The database is a production-ready schema that far exceeds      │
│  what the frontend currently consumes. No API layer exists.      │
│  Every single page needs to be connected to real data sources.   │
└──────────────────────────────────────────────────────────────────┘
```
