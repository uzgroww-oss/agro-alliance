# User Journey & State Flow

## Agro Alliance Platform — Complete User Journeys, State Machines & Transitions

---

## 1. Anonymous Visitor Journey

### 1.1 Entry Points

```
Traffic Sources:
├── Direct (agroalliance.uz)
├── Search (Google, Yandex) → SEO-optimized news/blogger pages
├── Social (Telegram, Instagram) → shared article/profile links
├── Referral → partner websites
└── Ads → paid campaigns
```

### 1.2 Anonymous User States

```
┌──────────┐    ┌──────────────┐    ┌──────────┐
│ Arrived  │ → │   Browsing   │ → │  Convert │
└──────────┘    └──────────────┘    └──────────┘
     │                │                 │
     │ Entry         │ Browse:         │ Action:
     │ page load     │ - Home          │ - Click "KIRISH" → Login
     │               │ - Bloggers      │ - Click "HAMKOR BO'LISH" → Contact
     │               │ - News          │ - Subscribe newsletter
     │               │ - Partners      │ - Share article
     │               │ - About/Contact │ - Click blogger link
     │               │ - Platform      │
     │               │                 │
     │               └── Bounce ──────→ Exit (no conversion)
     │                              ↑  │
     └─── Return (later via new entry) ┘
```

### 1.3 Key Conversion Points

| Trigger | Destination | Conversion Type | % Target |
|---------|-------------|-----------------|----------|
| "KIRISH" button (header) | `/kirish` | Login | 5% of visitors |
| "HAMKOR BO'LISH" (Home, About, Partners) | Contact form | Lead | 2% |
| Newsletter signup (News, Partners, Contact) | `/newsletter` | Email capture | 3% |
| Blogger profile view + Contact links | External | Social connect | 8% |
| "PLATFORMAGA KIRISH" (Home, Platform) | `/kirish` | Login | 4% |

---

## 2. Authentication Journey

### 2.1 Login Flow (All Roles)

```
                    ┌──────────┐
                    │ /kirish  │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ Enter    │
                    │ Creds    │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
              ┌────→│ Validate │←────┐
              │     └────┬─────┘     │
              │          │           │
              │     ┌────▼─────┐     │
              │     │  Valid?  │     │ Wrong password
              │     └────┬─────┘     │
              │          │           │
              │     ┌────▼─────┐     │
              │  ┌──│  Check   │──┐  │
              │  │  │  Status  │  │  │
              │  │  └────┬─────┘  │  │
              │  │       │        │  │
              │  │  ┌────▼─────┐  │  │
              │  │  │ Active?  │  │  │
              │  │  └──┬──┬────┘  │  │
              │  │     │  │       │  │
              │  │     │  └── Banned/Pending → Show error
              │  │     │
              │  │┌────▼──────┐
              │  ││  Loading  │  "Kirilmoqda…"
              │  ││  Profile  │
              │  │└────┬──────┘
              │  │     │
              │  │┌────▼──────┐
              │  ││  Redirect │  roleHome(role)
              │  ││  to       │
              │  ││  Dashboard│
              │  │└───────────┘
              │  │
              │  └── Reset: New password → try login again
              │
              └── Forgot password → email reset link → new password
```

### 2.2 Account State Transitions

```
                    ┌────────────┐
                    │  PENDING   │  Newly created by admin
                    └──────┬─────┘
                           │
                    ┌──────▼──────┐
                    │   ACTIVE    │  Admin approves / toggles
                    └──┬──────┬──┘
                       │      │
              ┌────────┘      └────────┐
              ▼                         ▼
        ┌──────────┐            ┌──────────┐
        │  BANNED  │            │ PENDING  │  Admin can cycle back
        └──────────┘            └──────────┘
```

### 2.3 Session States

| State | Condition | UX |
|-------|-----------|----|
| Loading | Token exists, fetching `/auth/me` | "Yuklanmoqda…" spinner |
| Authenticated | Valid token, user loaded | Show dashboard, user avatar |
| Unauthenticated | No token or expired | Show login prompt, redirect to `/kirish` |
| Session expired | API returns 401, refresh fails | `logout()`, redirect to `/kirish` |

---

## 3. Blogger Journey

### 3.1 Registration → Active Flow

```
ADMIN ACTION: Creates blogger account via /admin
                           │
                    ┌──────▼──────┐
                    │   PENDING   │
                    │ (no access) │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ADMIN TOGGLES              SYSTEM SENDS
     Status → active            welcome email
              │                         │
              └──────────┬──────────────┘
                         │
                    ┌────▼────┐
                    │ ACTIVE  │
                    └────┬────┘
                         │
              ┌──────────┴──────────┐
              │                     │
         ┌────▼────┐          ┌────▼────┐
         │ Blogger │          │ Public  │
         │Dashboard│          │ Profile │
         └─────────┘          │ Page    │
                              │ visible │
                              └─────────┘
```

### 3.2 First Login Journey (Blogger)

```
┌────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Login  │ → │ Dashboard│ → │ Profile  │ → │ Connect  │ → │ Add      │
│ First  │    │ Overview │    │ Settings │    │ Socials  │    │ Videos   │
│ Time   │    │          │    │          │    │          │    │          │
└────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                  │               │               │               │
            Empty state:    Form empty       No socials      No videos
            "Ma'lumotlar   "Profilni         "Hali ijtimoiy  "Hali video
            yuklanmoqda"   tahrirlash"       tarmoq qo'shi-   qo'shilmagan"
                                              lmagan."
```

### 3.3 Daily Driver Journey (Blogger)

```
Login → Dashboard (Overview)
  ├── Check stat cards (subs, views, engagement)
  ├── View chart (video views last 6 months)
  ├── Quick scan social accounts
  │     ├── All connected? ✓
  │     └── Missing one? → Add social account
  ├── Check recent videos
  │     ├── All imported? ✓
  │     └── New video out? → Add video link
  └── Quick actions
        ├── Video yuklash → Videos tab
        ├── Silka biriktirish → Socials tab
        ├── Profilni yangilash → Profile
        └── Statistikani ko'rish → Placeholder
```

### 3.4 Blogger Profile State Machine

```
Public Profile Visibility:
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Empty   │ → │ Partial  │ → │ Complete │
│ Profile  │    │ Profile  │    │ Profile  │
└──────────┘    └──────────┘    └──────────┘
     │               │               │
 No photo       Photo +           All fields +
 No socials     Minimal info      3+ socials
 No videos      1-2 videos        5+ videos
                                     │
                                     ▼
                               Featured:
                               is_top = true
                               (admin assignment)
```

---

## 4. Admin Journey

### 4.1 Admin Login → Daily Ops

```
Login → /admin → Dashboard Overview
  ├── Check stat cards (bloggers, partners, news, visits)
  ├── View platform growth chart
  ├── Review recent activity feed
  ├── Mini blogger table → quick status checks
  └── Nav tabs:
        ├── Bloggerlar (1): Manage all bloggers
        │     ├── Add new blogger (form)
        │     ├── Search/filter
        │     ├── Toggle status (pending ↔ active ↔ banned)
        │     └── Delete (with confirm)
        ├── Hamkorlar (2): Manage all partners
        │     ├── Add partner (form)
        │     ├── Per partner: contract details
        │     ├── Task management (add, cycle status, delete)
        │     ├── Client login creation
        │     └── Delete partner
        ├── Yangiliklar (3): Placeholder
        ├── Statistika (4): Site stats editor
        │     └── Edit values/labels → save → public updates
        └── Sozlamalar (5): Placeholder
```

### 4.2 Blogger Registration Flow (Admin)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Click    │ → │ Fill     │ → │ Submit   │ → │ Confirmation│
│ "+ Add"  │    │ Form     │    │ POST     │    │ + Table     │
└──────────┘    └──────────┘    └──────────┘    │ refresh     │
     │               │               │           └────────────┘
 Form fields:    Validation:     Loading:
 - name (req)    - email format  "Yuborilmoqda…"
 - email (req)   - pw min 8
 - password      - name min 2
 - region (opt)
 - niche (opt)
```

### 4.3 Partner & Client Management Flow

```
Admin creates partner:
  ┌────────┐    ┌──────────┐    ┌──────────┐
  │ + Add  │ → │ Fill     │ → │ Partner  │
  │ Partner│    │ Details  │    │ Visible  │
  └────────┘    └──────────┘    └──────────┘
                                     │
                                     ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Add      │ ← │ Cycle    │ ← │ Add      │
  │ Client   │    │ Tasks    │    │ Tasks    │
  │ Login    │    │          │    │          │
  └──────────┘    └──────────┘    └──────────┘
                                     │
                                     ▼
  Client can login + view partner tasks (read-only)
```

---

## 5. Client Journey

### 5.1 Client First Login

```
Login → /mijoz → Dashboard (Umumiy)
  ├── See partner brand + contract info
  ├── Stat cards: total/done/progress/pending tasks
  ├── Status donut chart
  ├── Contract summary
  └── Recent tasks list (max 5)
        └── Click "Barchasi →" → Bajarilgan ishlar tab
```

### 5.2 Client Daily Driver

```
Login → /mijoz
  ├── Umumiy tab (default)
  │     ├── Check task completion %
  │     ├── View donut (done/progress/pending)
  │     └── See latest 5 tasks
  ├── Bajarilgan ishlar tab
  │     ├── See ALL tasks with status indicators
  │     └── Progress bar at top
  └── Shartnoma tab
        ├── Contract details (read-only)
        ├── Completion breakdown
        └── Status badge (active/pending/completed)
```

### 5.3 Client Limitations

| Action | Available? |
|--------|-----------|
| View partner name | ✓ |
| View contract details | ✓ |
| View tasks | ✓ (all, read-only) |
| Add/delete tasks | ✗ |
| Change task status | ✗ |
| Modify contract | ✗ |
| Edit profile | ✗ (only admin can manage) |
| See other partners | ✗ (only own partner) |

---

## 6. News Consumer Journey

### 6.1 News Discovery → Article Read

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Discover │ → │ Browse   │ → │ Read     │ → │ Engage   │
│ Entry    │    │ List     │    │ Article  │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
 Direct link,    Filter by        Full article    Share (Telegram,
 Search,         category,        with body,      Facebook, copy)
 Social share,   search,          images,         Subscribe to
 News page       sorted by         metadata       newsletter
                 date/popular                     Related articles
                                                  click
```

### 6.2 News Consumption States

| State | Description |
|-------|-------------|
| Discovered | User lands on news page or article link |
| Browsing | Scrolling list, applying filters, reading titles |
| Selected | Clicked on article, reading full content |
| Shared | Shared article to social media |
| Subscribed | Entered email in newsletter signup |
| Exited | Left without conversion |

---

## 7. State Diagrams by Entity

### 7.1 Blogger Account States

```
                  ┌──────────────┐
                  │  REGISTERED  │  Admin creates account
                  └──────┬───────┘
                         │
                    ┌────▼───────┐
                    │  PENDING   │  Default, no login access
                    │ (inactive) │
                    └────┬───────┘
                         │
                    ┌────▼───────┐
                    │   ACTIVE   │  Admin toggles → can login
                    └──┬─────┬───┘
                       │     │
              ┌────────┘     └────────┐
              ▼                        ▼
        ┌──────────┐            ┌──────────┐
        │  BANNED  │            │ PENDING  │
        │ (blocked)│            │ (reset)  │
        └──────────┘            └──────────┘
```

### 7.2 Partner Contract States

```
                    ┌──────────────┐
                    │   PENDING    │  Newly added, awaiting activation
                    └──────┬───────┘
                           │
                    ┌────▼───────┐
                    │   ACTIVE   │  In progress, tasks being executed
                    └──────┬─────┘
                           │
                    ┌──────▼───────┐
                    │  COMPLETED   │  All tasks done, contract finished
                    └──────────────┘
```

### 7.3 Task States (Per Partner)

```
                    ┌──────────────┐
                    │   PENDING    │  New task, not started
                    └──────┬───────┘
                           │
                    ┌────▼───────┐
                    │  PROGRESS   │  Work in progress
                    └──────┬─────┘
                           │
                    ┌──────▼───────┐
                    │     DONE     │  Completed
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   PENDING    │  Cycle: done → pending (recycle)
                    └──────────────┘
```

### 7.4 News Article States

```
                    ┌──────────────┐
                    │    DRAFT     │  Created by AI or admin, not public
                    └──────┬───────┘
                           │
                    ┌────▼───────┐
                    │  PUBLISHED  │  Visible on /yangiliklar
                    └──────┬─────┘
                           │
                    ┌──────▼───────┐
                    │   ARCHIVED   │  Removed from listing, still accessible via URL
                    └──────────────┘
```

### 7.5 Social Account States

```
                    ┌──────────────┐
                    │  CONNECTED   │  Successfully linked + verified
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   SYNCING    │  Currently fetching metadata
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼──────┐          ┌──────▼──────┐
        │ ACTIVE     │          │ ERROR       │
        │ (synced)   │          │ (needs      │
        └────────────┘          │  reconnect) │
                                └─────────────┘
```

---

## 8. Notification Trigger Mapping

| Trigger | Notification Type | Recipient | Channel |
|---------|------------------|-----------|---------|
| Blogger created | "Yangi bloger qo'shildi" | Admin | In-app (bell) |
| Blogger status changed | "Bloger holati o'zgartirildi" | Admin | In-app |
| Contact form submitted | "Yangi xabar keldi" | Admin | Email + in-app |
| Task status changed | "Vazifa {status}" | Admin + Client | In-app |
| Partner client created | "Mijoz logini yaratildi" | Admin | In-app |
| News published (AI) | "Yangi maqola chop etildi" | All | In-app + Telegram |
| Newsletter subscribed | "Yangi obunachi" | Admin | In-app |
| Social sync failed | "Ijtimoiy tarmoq sinxronizatsiyasida xatolik" | Blogger | In-app |
| API quota warning | "API kvotasi 80% ga yetdi" | Admin | In-app |
| Pipeline error | "AI News Engine xatosi" | Admin | Email + in-app |

---

## 9. Error State Handling

| State | Trigger | UX |
|-------|---------|----|
| Loading | API call in flight | "Yuklanmoqda…" centered spinner |
| Empty | API returns 0 items | "Hech narsa topilmadi" with action |
| Error | API returns error/throws | Error message with retry button |
| Offline | Network disconnected | Browser default offline page |
| 404 | Resource not found | "Topilmadi" page with back link |
| Rate limited | 429 response | "Keyinroq urinib ko'ring" |
| Maintenance | 503 response | "Platformada texnik ishlar olib borilmoqda" |
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTk2NzE3OTA3OCwtMTU4Mjc3ODg1NSwxOD
UzNTA2MTg3LC0xOTIzNzQ0Mzg5LDEzMjgyNTQ1NDldfQ==
-->
