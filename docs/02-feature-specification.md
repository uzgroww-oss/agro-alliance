# Feature Specification Document

## Agro Alliance Platform

---

## 1. Public Pages

### 1.1 Home Page (`/`)
| Feature | ID | Status | Backend Needed | Priority |
|---------|----|--------|---------------|----------|
| Hero section with animated mascot | H-01 | Static | No | Done |
| Hero cards (5 features) | H-02 | Static | No | Done |
| Platform CTA buttons | H-03 | Static | No | Done |
| Stats bar | H-04 | Live API | `/public/stats` | P1 |
| Features grid (6 cards) | H-05 | Static | No | Done |
| Stats bar API integration | H-06 | Mock→Live | Replace mock with backend | P1 |

**Frontend File**: `src/pages/Home.tsx`
**API Dependencies**: `/public/stats`

### 1.2 About Page (`/about`)
| Feature | ID | Status | Backend Needed | Priority |
|---------|----|--------|---------------|----------|
| Hero with breadcrumb | A-01 | Static | No | Done |
| Mission/Vision/Values pillars | A-02 | Static | No | Done |
| Stats bar | A-03 | Live API | `/public/stats` | P1 |
| Team members grid | A-04 | Static | `team_members` table → admin CRUD | P3 |
| CTA banner | A-05 | Static | No | Done |
| Vision video CTA | A-06 | Static link | No (external video) | Deferred |

**Frontend File**: `src/pages/About.tsx`
**API Dependencies**: `/public/stats`

### 1.3 Bloggers Page (`/blogerlar`)
| Feature | ID | Status | Backend Needed | Priority |
|---------|----|--------|---------------|----------|
| Hero with top blogger card | B-01 | Static top blogger | `/public/bloggers` (paginated) | P1 |
| Search input | B-02 | Client-side | Move to server-side search | P1 |
| Category filter | B-03 | Client-side | Server-side filter by niche | P1 |
| Region filter | B-04 | Client-side | Server-side filter by region | P1 |
| Platform filter | B-05 | Client-side | Server-side filter by social platform | P2 |
| Sort (rating/subscribers) | B-06 | Client-side | Server-side sorting | P1 |
| Blogger grid cards | B-07 | Mock data | Replace with DB query | P1 |
| Save/favorite button | B-08 | No-op `<button>` | Connect to backend | P3 |
| Pagination | B-09 | Static UI | Server-side pagination | P1 |

**Frontend File**: `src/pages/Bloggers.tsx`
**API Dependencies**: `/public/bloggers` (GET with query params)

### 1.4 Blogger Profile Page (`/blogerlar/:slug`)
| Feature | ID | Status | Backend Needed | Priority |
|---------|----|--------|---------------|----------|
| Header with avatar, socials | BP-01 | Mixed (mock+live) | `/public/bloggers/:slug` | P1 |
| Stats row | BP-02 | Static mock | Aggregate from social_accounts + videos | P1 |
| About section | BP-03 | Static | From profiles table | P1 |
| AI Chat button | BP-04 | No-op button | AI worker integration | P3 |
| Quick Contact links | BP-05 | `href="#"` | Connect to actual social URLs from DB | P2 |
| Content tabs (4) | BP-06 | Static mock | Live from videos + reviews + brand collabs | P1 |
| Achievements | BP-07 | Static | `achievements` table | P3 |
| Services list | BP-08 | Static | `services` table | P2 |
| Analytics (gender/age/regions) | BP-09 | Static mock | Aggregate analytics query | P2 |
| Brands grid | BP-10 | Static | `brand_collaborations` table | P2 |
| Efficiency section | BP-11 | Static | Engagement history from analytics | P2 |

**Frontend File**: `src/pages/BloggerProfile.tsx`
**API Dependencies**: `/public/bloggers/:slug`

### 1.5 Platform Page (`/platforma`)
| Feature | ID | Status | Backend Needed | Priority |
|---------|----|--------|---------------|----------|
| Hero with stats | PL-01 | Static | No | Done |
| Capabilities grid (9 cards) | PL-02 | Static | No | Done |
| Big stats section | PL-03 | Static | No | Done |
| Join CTA | PL-04 | Static `href="#"` | Connect to registration | P3 |

**Frontend File**: `src/pages/Platform.tsx`
**API Dependencies**: None

### 1.6 News Page (`/yangiliklar`)
| Feature | ID | Status | Backend Needed | Priority |
|---------|----|--------|---------------|----------|
| Hero with mascot | N-01 | Static | No | Done |
| Search input | N-02 | Client-side | Server-side search | P1 |
| Category filter | N-03 | Client-side | `/public/news?cat=` | P1 |
| Theme filter | N-04 | No-op (static data) | Tag-based filtering | P2 |
| Date filter | N-05 | No-op (static data) | Date-range filtering | P2 |
| Sidebar categories with counts | N-06 | Static counts | Live aggregates | P1 |
| Most read sidebar | N-07 | Static | `/public/news/popular` | P1 |
| Featured news layout | N-08 | Static | `is_featured` flag | P1 |
| News grid cards | N-09 | Mock data | Replace with DB query | P1 |
| Pagination | N-10 | Static UI | Server-side pagination | P1 |
| Newsletter signup (sidebar) | N-11 | No-op input | `/newsletter` subscribe | P2 |
| Newsletter signup (bottom) | N-12 | No-op input | `/newsletter` subscribe | P2 |

**Frontend File**: `src/pages/News.tsx`
**API Dependencies**: `/public/news`, `/public/news/popular`, `/newsletter`

### 1.7 News Detail Page (`/yangiliklar/:slug`)
| Feature | ID | Status | Backend Needed | Priority |
|---------|----|--------|---------------|----------|
| Article content | ND-01 | Mock data | `/public/news/:slug` | P1 |
| Share buttons | ND-02 | `href="#"` | Connect to actual share URLs | P2 |
| Related articles | ND-03 | Static | `/public/news/:slug/related` | P1 |
| 404 handling | ND-04 | Local logic | Server 404 → show "topilmadi" | P1 |

**Frontend File**: `src/pages/NewsDetail.tsx`
**API Dependencies**: `/public/news/:slug`

### 1.8 Partners Page (`/hamkorlar`)
| Feature | ID | Status | Backend Needed | Priority |
|---------|----|--------|---------------|----------|
| Hero with brand carousel | PR-01 | Static carousel | `/public/partners` | P2 |
| Stats row | PR-02 | Static | `/public/stats` or `/public/partners/stats` | P2 |
| Directions grid | PR-03 | Static | No | Done |
| Partner logos | PR-04 | Static brands | `/public/partners` | P2 |
| View all partners CTA | PR-05 | `href="#"` | Partner directory page (future) | Deferred |
| CTA banner | PR-06 | `href="#"` | Connect to contact page | P3 |
| Newsletter signup | PR-07 | No-op input | `/newsletter` subscribe | P2 |

**Frontend File**: `src/pages/Partners.tsx`
**API Dependencies**: `/public/partners`, `/newsletter`

### 1.9 Contact Page (`/aloqa`)
| Feature | ID | Status | Backend Needed | Priority |
|---------|----|--------|---------------|----------|
| Contact info (phone, email, address, hours) | C-01 | Static | Move to `contact_info` table | P3 |
| Contact form | C-02 | Client-side mock | `POST /contact` → email to admin | P1 |
| File attachment on form | C-03 | Visual only | R2 upload + attachment handling | P3 |
| Feature badges | C-04 | Static | No | Done |
| Office locations | C-05 | Static | Move to `offices` table | P3 |
| Map embed | C-06 | OpenStreetMap | No backend needed | Done |
| FAQ accordion | C-07 | Static | Move to `faqs` table → admin editable | P3 |
| Newsletter signup | C-08 | No-op input | `/newsletter` subscribe | P2 |

**Frontend File**: `src/pages/Contact.tsx`
**API Dependencies**: `POST /contact`, `/newsletter`

### 1.10 Login Page (`/kirish`)
| Feature | ID | Status | Backend Needed | Priority |
|---------|----|--------|---------------|----------|
| Email/password form | L-01 | Mock API | Supabase Auth | P1 |
| Remember Me checkbox | L-02 | Frontend only | Extend token expiry | P1 |
| Show/hide password toggle | L-03 | Frontend | No backend | Done |
| Error display | L-04 | Client-side | Backend validation messages | P1 |
| Forgot password link | L-05 | `href="#"` | Supabase Auth password reset | P2 |
| Google OAuth | L-06 | No-op button | Supabase Auth Google provider | P2 |
| Telegram OAuth | L-07 | No-op button | Supabase Auth Telegram provider | P3 |
| Demo credentials filler | L-08 | Frontend debug | Remove in production | P1 |
| Registration link | L-09 | `href="#"` | No self-registration (admin-only) | Removed |

**Frontend File**: `src/pages/Login.tsx`
**API Dependencies**: Supabase Auth (`/auth/v1/token?grant_type=password`)

---

## 2. Dashboard Pages

### 2.1 Blogger Dashboard (`/dashboard`)
| Tab | Feature | ID | Status | Backend Needed | Priority |
|-----|---------|----|--------|---------------|----------|
| **Dashboard** | Profile info display+edit | BD-01 | Live API | `/me/profile` GET/PUT | P1 |
| | Photo upload | BD-02 | Base64 (needs R2) | `/me/profile/photo` → R2 upload | P2 |
| | Social accounts CRUD | BD-03 | Live API | `/me/socials` GET/POST/DELETE | P1 |
| | Videos CRUD | BD-04 | Live API | `/me/videos` GET/POST/DELETE | P1 |
| | Stat cards (subs, views, engagement, videos, platforms) | BD-05 | Static mock | Aggregate queries | P1 |
| | Video views line chart | BD-06 | Static mock | Analytics query 6-month history | P2 |
| | Platform donut chart | BD-07 | Static mock | Aggregate from social_accounts | P2 |
| | Audience gender/age | BD-08 | Static mock | Analytics from social APIs | P3 |
| | Quick actions | BD-09 | Placeholder buttons | Connect to respective tabs | P2 |
| **Profilim** | Edit profile (redirects) | BD-10 | Duplicate of Dashboard profile | Same as BD-01 | P1 |
| **Ijtimoiy tarmoqlar** | Full social management | BD-11 | Duplicate | Same as BD-03 | P1 |
| **Videolar** | Full video management | BD-12 | Duplicate | Same as BD-04 | P1 |
| **Statistika** | Placeholder | BD-13 | "Tez orada qo'shiladi" | Advanced analytics | Deferred |
| **Hamkorliklar** | Placeholder | BD-14 | "Tez orada qo'shiladi" | Campaign management | Deferred |
| **Xabarlar** | Placeholder | BD-15 | "Tez orada qo'shiladi" | In-app messaging | Deferred |
| **Sozlamalar** | Placeholder | BD-16 | "Tez orada qo'shiladi" | Account settings | Deferred |

**Frontend File**: `src/pages/dashboard/BloggerDashboard.tsx`
**API Dependencies**: `/me`, `/me/profile`, `/me/socials`, `/me/videos`

### 2.2 Admin Dashboard (`/admin`)
| Tab | Feature | ID | Status | Backend Needed | Priority |
|-----|---------|----|--------|---------------|----------|
| **Dashboard** | Overview stat cards | AD-01 | Partial (blogger count live) | Aggregate queries | P1 |
| | Platform growth chart | AD-02 | Static mock | Analytics 6-month | P2 |
| | Recent activity feed | AD-03 | Static mock | `audit_log` table | P3 |
| | Mini blogger table | AD-04 | Live API | `/bloggers` | P1 |
| **Bloggerlar** | Full blogger CRUD table | AD-05 | Live API | `/bloggers` GET/POST/PATCH/DELETE | P1 |
| | Search/filter bloggers | AD-06 | Client-side | Server-side search | P1 |
| | Status toggle | AD-07 | Live API | `/bloggers/:id/status` PATCH | P1 |
| | Edit button | AD-08 | No-op button | `/bloggers/:id` PUT | P2 |
| **Hamkorlar** | Full partner CRUD | AD-09 | Live API | `/partners` GET/POST/DELETE | P1 |
| | Partner stat cards | AD-10 | Live aggregates | Computed from partners data | P1 |
| | Task management | AD-11 | Live API | `/partners/:pid/tasks` CRUD | P1 |
| | Task status cycle | AD-12 | Live API | `/partners/:pid/tasks/:tid` PATCH | P1 |
| | Client login creation | AD-13 | Live API | `/partners/:pid/client` POST/DELETE | P1 |
| **Yangiliklar** | Placeholder | AD-14 | "Tez orada qo'shiladi" | News CMS | Deferred |
| **Statistika** | Stats editor | AD-15 | Live API | `/stats` GET/PUT | P1 |
| **Sozlamalar** | Placeholder | AD-16 | "Tez orada qo'shiladi" | Site settings | Deferred |

**Frontend File**: `src/pages/dashboard/AdminDashboard.tsx`
**API Dependencies**: `/bloggers`, `/partners`, `/stats`

### 2.3 Client Dashboard (`/mijoz`)
| Tab | Feature | ID | Status | Backend Needed | Priority |
|-----|---------|----|--------|---------------|----------|
| **Umumiy** | Partner overview | CD-01 | Live API | `/me/partner` | P1 |
| | Stat cards (total/done/progress/pending) | CD-02 | Live computed | From partner tasks | P1 |
| | Status donut chart | CD-03 | Live data | From task aggregates | P1 |
| | Contract summary | CD-04 | Live data | From partner record | P1 |
| | Recent tasks list | CD-05 | Live data | From partner tasks | P1 |
| **Bajarilgan ishlar** | Full task list | CD-06 | Live data | Same as CD-05, all items | P1 |
| | Progress bar | CD-07 | Live computed | Task completion % | P1 |
| **Shartnoma** | Contract details | CD-08 | Live data | From partner record | P1 |
| | Completion breakdown | CD-09 | Live computed | Task status counts | P1 |

**Frontend File**: `src/pages/dashboard/ClientDashboard.tsx`
**API Dependencies**: `/me/partner`

---

## 3. Shared Components

| Component | ID | Used On | Status | Backend Needed |
|-----------|----|---------|--------|---------------|
| Header | SC-01 | All public pages | Static | No (no dynamic data) |
| Footer | SC-02 | All public pages | Static | No (no dynamic data) |
| StatsBar | SC-03 | Home, About | Live API | `/public/stats` |
| DashboardLayout | SC-04 | All 3 dashboards | Static | No (user data passed as props) |
| LineChart | SC-05 | Blogger Dashboard, Admin Dashboard | Visual only | No backend needed |
| Donut | SC-06 | Blogger Dashboard, Client Dashboard | Visual only | No backend needed |
| Reveal (scroll animation) | SC-07 | All pages | Frontend only | No |
| Icon component | SC-08 | All pages | SVG map | No |

---

## 4. Deferred / Placeholder Features

These features show "Bu bo'lim tez orada qo'shiladi" and are not yet implemented:

| Dashboard | Tab | Feature |
|-----------|-----|---------|
| Blogger | Statistika | Advanced analytics dashboard |
| Blogger | Hamkorliklar | Campaign/brand collaboration management |
| Blogger | Xabarlar | In-app messaging system |
| Blogger | Sozlamalar | Account, notification, privacy settings |
| Admin | Yangiliklar | News article CMS |
| Admin | Sozlamalar | Site-wide settings |

---

## 5. Cross-Cutting Concerns

### 5.1 Authentication Check
- All dashboard pages require valid JWT
- `RequireRole` component guards routes by role
- Invalid/expired token → redirect to `/kirish`

### 5.2 Loading States
- All API calls show "Yuklanmoqda…" during fetch
- Error states show error message with retry option

### 5.3 Responsive Design
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Mobile: hamburger menu, stacked layouts, simplified cards
- Tablet: reduced grids (2 columns), collapsible sidebar
- Desktop: full layout with sidebar, multi-column grids

### 5.4 Image Handling
- Public pages: picsum.photos placeholder → R2 CDN
- Dashboard: base64 → R2 with file resize
- News: featured images → R2 with variants (thumb, medium, full)
- Blogger avatars: uploaded → R2 with face-crop variant
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTA5OTI4NTc0MiwtMTU4Mjc3ODg1NSwxOD
UzNTA2MTg3LC0xOTIzNzQ0Mzg5XX0=
-->
