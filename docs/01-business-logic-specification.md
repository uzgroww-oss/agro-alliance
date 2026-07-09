# Business Logic Specification

## Agro Alliance Platform

---

## 1. Authentication & Authorization

### 1.1 Registration Flow (Admin-Only)
- **Invocation**: Admin Dashboard → "Yangi bloger qo'shish" → fill form → submit
- **Business Rule**: Only `superadmin` can create new user accounts. No self-registration.
- **Flow**:
  1. Admin submits `{ name, email, password, region, niche }`
  2. System creates auth user in Supabase Auth
  3. System inserts row into `profiles` table with role=`blogger`, status=`pending`
  4. Email notification sent to new blogger with credentials
  5. New blogger appears in admin blogger list with status "Kutilmoqda"
- **Partner Client Registration**: Admin creates client login per partner via `/partners/:id/client` endpoint
- **Validation**:
  - Email must be unique
  - Password minimum 8 characters
  - Name required (min 2 chars)
  - Region and niche are optional at creation

### 1.2 Login Flow
- **Invocation**: `/kirish` page → email/phone + password → submit
- **Methods**: Email+password, Google OAuth, Telegram OAuth
- **Flow**:
  1. User submits credentials
  2. System authenticates via Supabase Auth
  3. If valid: issue JWT token, store in localStorage
  4. Fetch profile from `profiles` table
  5. Redirect to role-specific dashboard via `roleHome()`:
     - `superadmin` → `/admin`
     - `client` → `/mijoz`
     - `blogger` → `/dashboard`
- **Edge Cases**:
  - Pending/banned accounts → reject with "Hisobingiz faollashtirilmagan"
  - Invalid credentials → show "Email yoki parol notog'ri"
  - Rate limit: max 5 attempts per 15 minutes per IP

### 1.3 Session Management
- Token stored in `localStorage` under key `aa_token`
- On app mount: token exists → call `/auth/me` to load profile
- Token refresh: Supabase auto-refresh via `refresh_token`
- Logout: clear token, clear user state, redirect to `/kirish`
- Remember Me: extend session to 30 days; default: 24 hours

### 1.4 Password Reset
- **Trigger**: "Parolni unutdingiz?" link on login page
- **Flow**:
  1. User enters email
  2. Supabase sends magic link to email
  3. User clicks link → reset password form
  4. New password submitted → Supabase updates
  5. Redirect to login with success message

---

## 2. Blogger Module

### 2.1 Blogger Listing (Public)
- **Page**: `/blogerlar`
- **Data Source**: `bloggers` table joined with `profiles`, `social_accounts`, aggregate stats
- **Filters**:
  - Search query (name, tag) — client-side filtering moved to server-side
  - Category/niche — mapped via `bloggers.niche`
  - Region — mapped via `profiles.region`
  - Platform — filtered via junction with `social_accounts`
  - Sort: rating descending, subscribers descending
- **Default Sort**: By rating descending
- **Pagination**: 12 bloggers per page; show page 1-4 + ellipsis + last page
- **Top Blogger**: Determined by `rating` field — displayed in hero sidebar

### 2.2 Blogger Profile (Public)
- **Page**: `/blogerlar/:slug`
- **Sections**:
  - **Header**: Name, tag, region, rating, social links, profile photo
  - **Stats Row**: Subscribers, monthly views, engagement, partnerships, rating, experience years
  - **About**: Niche, direction, location, languages, bio, tags
  - **AI Assistant**: "AI CHAT" button — opens AI chat overlay (future)
  - **Quick Contact**: Telegram, WhatsApp, Instagram, Email
  - **Content Tabs**: {KONTENTLAR, STATISTIKA, HAMKORLIKLAR, SHARHLAR}
    - KONTENTLAR: Grid of video thumbnails from `videos` table
    - STATISTIKA: Engagement bars (views%, engagement%, subscriber growth%, content activity%)
    - HAMKORLIKLAR: Brands worked with
    - SHARHLAR: Testimonials from clients
  - **Achievements**: Badges (TOP Blogger, Most Active, Expo participant, etc.)
  - **Services**: List of offered services (ad integration, product review, collab, farm tour)
  - **Analytics**: Gender donut, age bars, top regions
  - **Brands**: Grid of partner brand names
  - **Efficiency Section**: Engagement growth over time with bar chart

### 2.3 Blogger Dashboard (Private)
- **Access**: role = `blogger`
- **Tabs**:
  1. **Dashboard** (default): Profile card, socials card, stat cards, chart, platform donut, audience, videos table, quick actions
  2. **Profilim**: Edit profile fields + upload photo
  3. **Ijtimoiy tarmoqlar**: CRUD social accounts; auto-detect platform from URL
  4. **Videolar**: CRUD videos; auto-fetch metadata from URL
  5. **Statistika**: Placeholder
  6. **Hamkorliklar**: Placeholder
  7. **Xabarlar**: Placeholder
  8. **Sozlamalar**: Placeholder

- **Profile Update Flow**:
  1. Blogger clicks "Profilni tahrirlash"
  2. Fields become editable: name, age, gender, region, language, niche
  3. Photo upload: file picker → base64 → PUT `/me/profile`
  4. Save → PUT `/me/profile` → reload
- **Social Account CRUD**:
  - Add: POST `/me/socials` with link → system auto-detects platform (YouTube, Instagram, TikTok, Telegram, Facebook) → fetch name, avatar, subscriber count
  - Delete: DELETE `/me/socials/:id`
- **Video CRUD**:
  - Add: POST `/me/videos` with link → system fetches title, views, thumbnail, platform
  - Delete: DELETE `/me/videos/:id`

### 2.4 Blogger Status Workflow
- **States**: `pending` → `active` | `banned`
- **pending**: Newly registered; not visible on public listings
- **active**: Verified; visible on `/blogerlar`, accessible via slug
- **banned**: Removed from public view; cannot login
- **Transition**: Admin toggles via PATCH `/bloggers/:id/status`

---

## 3. Company / Partner Module

### 3.1 Partners Listing (Public)
- **Page**: `/hamkorlar`
- **Data Source**: `partners` table with status=`active`
- **Display**: Marquee carousel of brand names + directions grid
- **Stats Row**: Active partners, countries, strategic partners, coverage, experience

### 3.2 Partner Management (Admin)
- **Access**: superadmin only
- **CRUD**:
  - Create: name, sphere, contractNo, amount, status
  - Read: list with aggregates (task completion %, contract totals)
  - Update: status toggle, edit button (future)
  - Delete: confirm dialog → cascade delete tasks, client
- **Tasks**: Per-partner task management
  - Add task: title → status=`pending`
  - Cycle status: `pending` → `progress` → `done` → `pending`
  - Delete task: confirm-less removal
- **Client Login**: Admin creates client account per partner
  - Create: email + password → creates `profiles` row with role=`client`, linked to `partner_id`
  - Delete: remove client access

### 3.3 Client Dashboard (Private)
- **Access**: role = `client`
- **Tabs**:
  1. **Umumiy** (default): Partner info, stat cards (total/done/progress/pending), donut, contract summary, recent tasks
  2. **Bajarilgan ishlar**: Full task list with status
  3. **Shartnoma**: Contract details + completion bar
- **Read-only**: Client cannot modify tasks or contracts — view-only
- **Data**: Loaded via `/me/partner` — returns the partner linked to client's `partner_id`

---

## 4. News CMS Module

### 4.1 News Listing (Public)
- **Page**: `/yangiliklar`
- **Data Source**: `news` table
- **Filtering**:
  - Category (9 categories: texnologiya, qishloq, bozor, davlat, innovatsiya, ekologiya, tadqiqotlar, xalqaro)
  - Search: title + description
  - Theme: (Barchasi, Sug'orish, Texnika, Eksport, Subsidiya, Iqlim) — via tags
  - Date: (Barchasi, Bugun, Bu hafta, Bu oy, Bu yil) — via published_at
- **Featured Layout** (no filters active):
  - Hero featured (top story, flagged `is_featured=true`)
  - 2 side cards
  - Grid of remaining
- **Sidebar**:
  - Category list with counts
  - Most read (sorted by views)
  - Newsletter signup

### 4.2 News Detail (Public)
- **Page**: `/yangiliklar/:slug`
- **Components**:
  - Breadcrumb, category tag, title, meta (date, views, author)
  - Hero image
  - Article body (paragraphs)
  - Share buttons: Telegram, Facebook, Instagram, copy link
  - Related articles (same category first, then others, max 3)

### 4.3 News Management (Admin Future)
- **Placeholder**: Admin tab "Yangiliklar" — CRUD for news articles
- **Future Workflow**:
  - Create: title, slug (auto), category, description, body, image, tags
  - Publish / Draft / Archive states
  - AI-assisted writing (AI News Engine integration)
  - Scheduled publishing

---

## 5. Contact Module

### 5.1 Contact Form
- **Page**: `/aloqa`
- **Fields**: name (required), email (required, valid), topic (select: Tanlang/Hamkorlik/Texnik yordam/Umumiy savol/Reklama), message (required)
- **File Attachment**: Optional, max 10MB (future)
- **Flow**:
  1. User fills form → submits
  2. System validates fields
  3. Insert into `contact_messages` table
  4. Send notification email to admin
  5. Auto-reply to user with receipt confirmation
  6. Show success state: "Xabaringiz yuborildi!"

### 5.2 FAQ
- Data source: Static defined in frontend; should be moved to `faqs` table for admin management
- Accordion UI: click to expand/collapse
- Default open: first FAQ item

### 5.3 Office Locations
- Static data in frontend; should be moved to `offices` table
- Display: name, address, phone, email, map
- Map: OpenStreetMap embed with lazy activation (click to enable)

---

## 6. Newsletter Module

### 6.1 Subscription
- **Trigger Locations**:
  - News page sidebar
  - News page bottom banner
  - Partners page bottom banner
  - Contact page bottom section
- **Fields**: Email only
- **Flow**:
  1. User enters email → clicks "OBUNA BO'LISH"
  2. Validate email format
  3. Check duplicate (already subscribed → show "Siz allaqachon obuna bo'lgansiz")
  4. Insert into `newsletter_subscribers` table
  5. Show success toast
- **Unsubscribe**: Footer link → one-click unsubscribe via token

---

## 7. Platform Page

### 7.1 Public Platform Page (`/platforma`)
- Marketing page — no backend data models needed
- Displays 9 platform capabilities (static):
  1. Creator Marketplace
  2. AI Assistant
  3. Contract Center
  4. Analytics
  5. Agro Academy
  6. Campaign Management
  7. Task Manager
  8. Media Hub
  9. Payments & Accounting
- Hero stats (reuse `/public/stats`)

---

## 8. About Page

### 8.1 Public About Page (`/about`)
- Marketing page — no backend data models needed
- Displays: mission, vision, values, team members, CTA banner
- Team data: static → should move to `team_members` table for admin management

---

## 9. Stats Module

### 9.1 Public Stats Bar
- **Endpoint**: `/public/stats`
- **Data Source**: `site_stats` table
- **Displayed on**: Home, About, (any page with `<StatsBar />`)
- **Fields**: key (bloggers, views, partners, regions, contents), value (string), label (string)
- **Admin Interface**: Stats Editor tab in Admin Dashboard
  - Load current stats
  - Edit value + label per stat
  - Save → PUT `/stats` → update database
  - Success snackbar: "Saqlandi — bosh sahifada yangilandi."

---

## 10. Home Page

### 10.1 Hero Section
- Static marketing content
- 2 CTA buttons: "PLATFORMAGA KIRISH" → `/platforma`, "HAMKOR BO'LISH" → `/aloqa`
- 5 hero cards (static): AI Assistant, Task Manager, Contract Center, Blogger Rating, Media Marketplace

### 10.2 Features Grid
- 6 feature cards (static): AI, Smart Farming, Education, Media, Analytics, Growth
- No backend data dependency

---

## 11. Notification System

### 11.1 In-App Notifications
- **Bell icon** in dashboard topbars
- **Types**:
  - New blogger registered (admin)
  - Contract signed (admin)
  - Task completed (admin, client)
  - New message received (blogger)
  - News published (all)
- **Storage**: `notifications` table
- **Delivery**: Supabase Realtime subscription
- **State**: read/unread

### 11.2 Email Notifications
- New blogger welcome email
- Admin notification on contact form submission
- Weekly newsletter digest (via cron)
- Password reset email (via Supabase Auth)

---

## 12. AI News Engine

*Detailed in `04-ai-news-engine-specification.md`*

---

## 13. Social Automation

*Detailed in `05-social-automation-specification.md`*

---

## 14. Media Processing

*Detailed in `06-media-processing-pipeline.md`*

---

## 15. Caching Strategy

### 15.1 Public Endpoints
- **Stats**: Cache for 5 minutes
- **Blogger list**: Cache for 2 minutes
- **News list**: Cache for 2 minutes
- **News detail**: Cache for 5 minutes

### 15.2 Cache Invalidation
- On admin update of stats → invalidate stats cache
- On blogger create/delete → invalidate blogger cache
- On news publish/update → invalidate news cache
- Strategy: Use `cache-control` headers + Supabase Redis (future)

---

## 16. Error Handling

### 16.1 API Error Response Format
```json
{
  "error": "Xatolik yuz berdi",
  "code": "VALIDATION_ERROR",
  "details": { "field": "email", "message": "Email format notog'ri" }
}
```

### 16.2 HTTP Status Codes
- `200` — Success
- `201` — Created
- `400` — Validation error
- `401` — Unauthorized (no token / invalid token)
- `403` — Forbidden (wrong role)
- `404` — Resource not found
- `409` — Conflict (duplicate email, etc.)
- `429` — Rate limit exceeded
- `500` — Internal server error

### 16.3 Frontend Error Display
- Auth errors: red inline alert below form
- API errors: thrown as exceptions caught per-component
- Network errors: generic "Xatolik yuz berdi" message

---

## 17. Business Rules Summary

| Rule | Description |
|------|-------------|
| No self-registration | Only admin can create accounts |
| Role-based routing | `roleHome()` maps role → dashboard path |
| Blogger visibility | Only `active` bloggers appear in public listings |
| Client read-only | Clients view tasks/contracts — never modify |
| Social auto-detection | System detects platform from URL and fetches metadata |
| Video auto-detection | System fetches video metadata from YouTube/TikTok |
| Stats caching | Public stats cache with admin-triggered invalidation |
| Newsletter uniqueness | One email = one subscription; duplicate shows warning |
| Contact rate limit | Max 3 submissions per email per hour |
| Task status cycle | `pending` → `progress` → `done` → `pending` |
| Partner-client binding | 1 partner = 1 client account (or none) |
| News featured flag | 1 article can be featured at a time |
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTk2NzE3OTA3OCwtMTU4Mjc3ODg1NSwxOD
UzNTA2MTg3LC0xOTIzNzQ0Mzg5XX0=
-->
