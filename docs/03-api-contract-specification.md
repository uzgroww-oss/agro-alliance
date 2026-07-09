# API Contract Specification

## Agro Alliance Platform — Supabase Edge Functions

---

## 1. API Overview

- **Base URL (Production)**: `https://[project].supabase.co/functions/v1`
- **Base URL (Dev)**: `http://localhost:3001` (via Vite proxy `/api`)
- **Content-Type**: `application/json`
- **Auth Header**: `Authorization: Bearer <supabase_jwt>`
- **Pagination**: Cursor-based or offset-based (specified per endpoint)
- **Error Format**: `{ "error": string, "code"?: string, "details"?: any }`

---

## 2. Public Endpoints (No Auth Required)

### 2.1 Get Platform Stats
**Endpoint**: `GET /api/public/stats`
**Response**:
```json
{
  "stats": [
    { "key": "bloggers", "value": "120+", "label": "Agro blogerlar" },
    { "key": "views", "value": "5M+", "label": "Oylik ko'rishlar" },
    { "key": "partners", "value": "50+", "label": "Hamkor kompaniyalar" },
    { "key": "regions", "value": "20+", "label": "Hududlarda faoliyat" },
    { "key": "contents", "value": "1000+", "label": "Yaratilgan kontentlar" }
  ]
}
```
**Cache**: 5 minutes
**Edge Function**: `public-stats`

### 2.2 List Bloggers
**Endpoint**: `GET /api/public/bloggers`
**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 12 | Items per page (max 50) |
| `query` | string | - | Search name or tag |
| `niche` | string | - | Filter by niche key |
| `region` | string | - | Filter by region |
| `platform` | string | - | Filter by platform (youtube, instagram, etc.) |
| `sort` | string | `rating` | Sort field: `rating` or `subscribers` |
| `order` | string | `desc` | Sort order: `asc` or `desc` |

**Response**:
```json
{
  "bloggers": [
    {
      "slug": "elyor",
      "name": "Fermer Elyor",
      "niche": "issiqxona",
      "tag": "Issiqxona • Fermerlik",
      "region": "Toshkent viloyati",
      "subscribers": "1.2M+",
      "subscribers_num": 1200000,
      "engagement": "8.7%",
      "rating": 4.9,
      "photo": "https://r2.agroalliance.uz/bloggers/elyor/avatar.webp",
      "cover": "https://r2.agroalliance.uz/bloggers/elyor/cover.webp",
      "top": true,
      "platforms": ["youtube", "instagram", "tiktok"],
      "created_at": "2024-01-15T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 12,
    "total": 45,
    "total_pages": 4
  }
}
```
**Edge Function**: `public-bloggers-list`

### 2.3 Get Blogger Profile
**Endpoint**: `GET /api/public/bloggers/:slug`
**Response**:
```json
{
  "blogger": {
    "slug": "elyor",
    "name": "Fermer Elyor",
    "email": "elyor@agroalliance.uz",
    "profile": {
      "photo": "https://r2.agroalliance.uz/bloggers/elyor/avatar.webp",
      "age": "32",
      "gender": "erkak",
      "region": "Toshkent viloyati",
      "language": "O'zbek",
      "niche": "issiqxona",
      "tag": "Issiqxona • Fermerlik",
      "bio": "3 yildan beri issiqxona va fermerlik sohasida kontent yarataman.",
      "tags": ["#Issiqxona", "#Fermerlik", "#Sabzavot", "#AgroTex"]
    },
    "socials": [
      {
        "id": 1,
        "platform": "YouTube",
        "link": "https://youtube.com/@fermerelyor",
        "name": "Fermer Elyor",
        "avatar": "https://yt3.googleusercontent.com/...",
        "subscribers": "1.2M"
      }
    ],
    "videos": [
      {
        "id": 1,
        "name": "Issiqxonada pomidor yetishtirish sirlari",
        "link": "https://youtube.com/watch?v=abc123",
        "views": "125K",
        "thumbnail": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
        "platforms": ["YouTube"],
        "date": "2024-05-20",
        "duration": "10:45"
      }
    ],
    "stats": {
      "total_subscribers": 1200000,
      "monthly_views": 870000,
      "engagement": 8.7,
      "total_collaborations": 320,
      "rating": 4.9,
      "experience_years": 3
    },
    "achievements": [
      { "title": "TOP Bloger", "subtitle": "2024", "icon": "trophy" },
      { "title": "Eng faol fermer", "subtitle": "bloger 2023", "icon": "shield" }
    ],
    "services": [
      "Reklama integratsiya",
      "Mahsulot review",
      "Brend bilan kollaboratsiya",
      "Farm tur va vlog"
    ],
    "brands": ["UZ-GROW", "Biokit", "Syngenta", "Green House"],
    "reviews": [
      { "author": "Sardor Y.", "text": "Juda foydali kontent...", "rating": 5 },
      { "author": "Madina R.", "text": "Issiqxona bo'yicha eng yaxshi bloger.", "rating": 5 }
    ],
    "analytics": {
      "gender_male": 68,
      "gender_female": 32,
      "age_groups": [
        { "label": "18-24", "value": 18 },
        { "label": "25-34", "value": 42 },
        { "label": "35-44", "value": 25 },
        { "label": "45+", "value": 15 }
      ],
      "top_regions": [
        { "label": "Toshkent", "value": 38 },
        { "label": "Toshkent viloyati", "value": 22 },
        { "label": "Farg'ona", "value": 12 },
        { "label": "Namangan", "value": 8 },
        { "label": "Boshqalar", "value": 20 }
      ],
      "engagement_history": [
        { "period": "3 oy", "value": 6.1 },
        { "period": "6 oy", "value": 7.8 },
        { "period": "Hozir", "value": 8.7 }
      ]
    }
  }
}
```
**404 Response**:
```json
{ "error": "Bloger topilmadi", "code": "NOT_FOUND" }
```
**Edge Function**: `public-bloggers-profile`

### 2.4 List News
**Endpoint**: `GET /api/public/news`
**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 12 | Items per page |
| `query` | string | - | Search title + description |
| `category` | string | - | Category key |
| `tag` | string | - | Tag (theme) filter |
| `date_from` | date | - | Start date (ISO) |
| `date_to` | date | - | End date (ISO) |
| `period` | string | - | `today`, `week`, `month`, `year` |

**Response**:
```json
{
  "news": [
    {
      "slug": "dronlar-ekin-kuzatish",
      "title": "Dronlar yordamida ekinlarni kuzatish yangi bosqichga chiqmoqda",
      "category": "texnologiya",
      "description": "Dron texnologiyalari dehqonlarga ekin holatini real vaqt rejimida kuzatishda yordam bermoqda.",
      "image": "https://r2.agroalliance.uz/news/dronlar-ekin-kuzatish/thumb.webp",
      "date": "22 May, 2024",
      "views": "14.2K",
      "is_featured": true,
      "author": "Agro Alliance",
      "tags": ["texnologiya", "dron"],
      "created_at": "2024-05-22T00:00:00Z"
    }
  ],
  "pagination": { "page": 1, "per_page": 12, "total": 128, "total_pages": 11 },
  "categories": [
    { "key": "texnologiya", "label": "Agro texnologiya", "count": 24 },
    { "key": "qishloq", "label": "Qishloq xo'jaligi", "count": 32 }
  ]
}
```
**Edge Function**: `public-news-list`

### 2.5 Get News Detail
**Endpoint**: `GET /api/public/news/:slug`
**Response**:
```json
{
  "article": {
    "slug": "dronlar-ekin-kuzatish",
    "title": "Dronlar yordamida ekinlarni kuzatish yangi bosqichga chiqmoqda",
    "category": "texnologiya",
    "description": "...",
    "image": "https://r2.agroalliance.uz/news/dronlar-ekin-kuzatish/full.webp",
    "date": "22 May, 2024",
    "views": "14.2K",
    "author": "Agro Alliance",
    "body": ["Paragraph 1...", "Paragraph 2...", "Paragraph 3...", "Paragraph 4..."],
    "tags": ["texnologiya", "dron"],
    "created_at": "2024-05-22T00:00:00Z"
  }
}
```
**Edge Function**: `public-news-detail`

### 2.6 Get Popular News
**Endpoint**: `GET /api/public/news/popular`
**Query Parameters**: `limit` (int, default: 5, max: 10)
**Response**:
```json
{
  "popular": [
    {
      "slug": "tomchilatib-sugorish",
      "title": "O'zbekistonda tomchilatib sug'orish tizimlari kengaytirilmoqda",
      "date": "20 May, 2024",
      "views": "12.4K",
      "image": "https://r2.agroalliance.uz/news/tomchilatib-sugorish/thumb.webp"
    }
  ]
}
```
**Edge Function**: `public-news-popular`

### 2.7 Get Related News
**Endpoint**: `GET /api/public/news/:slug/related`
**Response**: Same as public-news-list response, max 3 items
**Edge Function**: `public-news-related`

### 2.8 List Public Partners
**Endpoint**: `GET /api/public/partners`
**Response**:
```json
{
  "partners": [
    { "name": "Syngenta", "logo": null, "direction": "O'g'it va himoya vositalari" }
  ],
  "stats": {
    "total": 50,
    "countries": 15,
    "strategic": 25,
    "coverage": "10M+"
  }
}
```
**Edge Function**: `public-partners`

### 2.9 Submit Contact Form
**Endpoint**: `POST /api/contact`
**Request**:
```json
{
  "name": "Sardor",
  "email": "sardor@example.com",
  "topic": "Hamkorlik",
  "message": "Hamkorlik qilishni xohlayman...",
  "attachment": null
}
```
**Validation**:
| Field | Rule |
|-------|------|
| name | Required, min 2 chars |
| email | Required, valid email format |
| topic | Required, must be one of: Tanlang, Hamkorlik, Texnik yordam, Umumiy savol, Reklama va marketing |
| message | Required, min 10 chars, max 5000 |
| attachment | Optional, base64, max 10MB |

**Response**:
```json
{ "success": true, "message": "Xabaringiz yuborildi!" }
```
**Rate Limit**: 3 submissions per email per hour
**Edge Function**: `contact-submit`

### 2.10 Subscribe to Newsletter
**Endpoint**: `POST /api/newsletter`
**Request**:
```json
{ "email": "user@example.com" }
```
**Response (success)**:
```json
{ "success": true, "message": "Obuna bo'ldingiz!" }
```
**Response (duplicate)**:
```json
{ "error": "Siz allaqachon obuna bo'lgansiz", "code": "DUPLICATE" }
```
**Edge Function**: `newsletter-subscribe`

### 2.11 Unsubscribe from Newsletter
**Endpoint**: `GET /api/newsletter/unsubscribe?token=<token>`
**Response**: HTML page with "Siz obunani bekor qildingiz"
**Edge Function**: `newsletter-unsubscribe`

---

## 3. Auth Endpoints (Public)

### 3.1 Login
**Endpoint**: `POST /api/auth/login`
**Request**:
```json
{
  "email": "admin@agroalliance.uz",
  "password": "admin123"
}
```
**Response (success)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@agroalliance.uz",
    "role": "superadmin",
    "profile": { "photo": null }
  }
}
```
**Response (error)**:
```json
{ "error": "Email yoki parol notog'ri", "code": "INVALID_CREDENTIALS" }
```
**Edge Function**: `auth-login`

### 3.2 Get Current User
**Endpoint**: `GET /api/auth/me`
**Headers**: `Authorization: Bearer <token>`
**Response**:
```json
{
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@agroalliance.uz",
    "role": "superadmin",
    "status": "active",
    "profile": { "photo": null, "region": "", "age": "" },
    "socials": [],
    "videos": []
  }
}
```
**Edge Function**: `auth-me`

---

## 4. Blogger Dashboard Endpoints (Auth Required: role = blogger)

### 4.1 Get My Profile
**Endpoint**: `GET /api/me`
**Response**: Same as `/auth/me` response
**Edge Function**: `me-profile`

### 4.2 Update My Profile
**Endpoint**: `PUT /api/me/profile`
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "name": "Fermer Elyor",
  "age": "32",
  "gender": "erkak",
  "region": "Toshkent viloyati",
  "language": "O'zbek",
  "niche": "issiqxona",
  "photo": "data:image/webp;base64,..."
}
```
**Validation**:
- name: required, 2-100 chars
- age: optional, numeric, 10-100
- gender: optional, one of: erkak, ayol
- region: optional, max 100 chars
- language: optional, max 50 chars
- niche: optional, must be valid category key
- photo: optional, base64, max 5MB, WEBP/JPEG/PNG

**Response**:
```json
{ "success": true, "profile": { ... } }
```
**Edge Function**: `me-profile-update`

### 4.3 Add Social Account
**Endpoint**: `POST /api/me/socials`
**Request**:
```json
{ "link": "https://youtube.com/@fermerelyor" }
```
**Business Logic**: System auto-detects platform from URL → fetches channel name, avatar, subscriber count via platform API.
**Response**:
```json
{
  "success": true,
  "social": {
    "id": 1,
    "platform": "YouTube",
    "link": "https://youtube.com/@fermerelyor",
    "name": "Fermer Elyor",
    "avatar": "https://yt3.googleusercontent.com/...",
    "subscribers": "1.2M"
  }
}
```
**Edge Function**: `me-socials-add`

### 4.4 Delete Social Account
**Endpoint**: `DELETE /api/me/socials/:id`
**Response**:
```json
{ "success": true }
```
**Edge Function**: `me-socials-delete`

### 4.5 Add Video
**Endpoint**: `POST /api/me/videos`
**Request**:
```json
{ "link": "https://youtube.com/watch?v=abc123" }
```
**Business Logic**: System fetches video title, views, thumbnail, platform from URL.
**Response**:
```json
{
  "success": true,
  "video": {
    "id": 1,
    "name": "Issiqxonada pomidor yetishtirish sirlari",
    "link": "https://youtube.com/watch?v=abc123",
    "views": "125K",
    "thumbnail": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
    "platforms": ["YouTube"],
    "date": "2024-05-20"
  }
}
```
**Edge Function**: `me-videos-add`

### 4.6 Delete Video
**Endpoint**: `DELETE /api/me/videos/:id`
**Response**:
```json
{ "success": true }
```
**Edge Function**: `me-videos-delete`

---

## 5. Admin Dashboard Endpoints (Auth Required: role = superadmin)

### 5.1 List All Bloggers
**Endpoint**: `GET /api/bloggers`
**Response**:
```json
{
  "bloggers": [
    {
      "id": 1,
      "name": "Fermer Elyor",
      "email": "elyor@agroalliance.uz",
      "niche": "issiqxona",
      "region": "Toshkent viloyati",
      "status": "active",
      "created_at": "2024-01-15T00:00:00Z"
    }
  ]
}
```
**Edge Function**: `admin-bloggers-list`

### 5.2 Create Blogger
**Endpoint**: `POST /api/bloggers`
**Headers**: `Authorization: Bearer <token>`
**Request**:
```json
{
  "name": "Yangi Bloger",
  "email": "yangi@agroalliance.uz",
  "password": "temp1234",
  "region": "Samarqand",
  "niche": "bogdorchilik"
}
```
**Validation**:
- name: required, 2-100 chars
- email: required, unique, valid email
- password: required, min 8 chars
- region: optional, max 100 chars
- niche: optional, valid category key

**Response**:
```json
{ "success": true, "blogger": { "id": 10, "name": "Yangi Bloger", "status": "pending" } }
```
**Edge Function**: `admin-bloggers-create`

### 5.3 Toggle Blogger Status
**Endpoint**: `PATCH /api/bloggers/:id/status`
**Request**:
```json
{ "status": "active" }
```
**Valid Status Values**: `active`, `pending`, `banned`
**Response**:
```json
{ "success": true, "status": "active" }
```
**Edge Function**: `admin-bloggers-status`

### 5.4 Delete Blogger
**Endpoint**: `DELETE /api/bloggers/:id`
**Business Logic**: Cascade delete: profile → social_accounts → videos → auth user
**Response**:
```json
{ "success": true }
```
**Edge Function**: `admin-bloggers-delete`

### 5.5 List Partners
**Endpoint**: `GET /api/partners`
**Response**:
```json
{
  "partners": [
    {
      "id": 1,
      "name": "Syngenta",
      "sphere": "O'g'it va himoya vositalari",
      "contract_no": "CT-2024-001",
      "amount": 500000000,
      "signed_date": "2024-01-15",
      "status": "active",
      "tasks": [
        { "id": 1, "title": "Reklama roligi tayyorlash", "status": "done" },
        { "id": 2, "title": "Blogerlar bilan uchrashuv", "status": "progress" }
      ],
      "client": { "id": 5, "name": "Syngenta", "email": "client@syngenta.uz" }
    }
  ]
}
```
**Edge Function**: `admin-partners-list`

### 5.6 Create Partner
**Endpoint**: `POST /api/partners`
**Request**:
```json
{
  "name": "Yangi Hamkor",
  "sphere": "Agro texnologiyalar",
  "contract_no": "CT-2024-010",
  "amount": 100000000,
  "status": "active"
}
```
**Response**:
```json
{ "success": true, "partner": { "id": 11, "name": "Yangi Hamkor" } }
```
**Edge Function**: `admin-partners-create`

### 5.7 Delete Partner
**Endpoint**: `DELETE /api/partners/:id`
**Response**:
```json
{ "success": true }
```
**Edge Function**: `admin-partners-delete`

### 5.8 Add Partner Task
**Endpoint**: `POST /api/partners/:pid/tasks`
**Request**:
```json
{ "title": "Yangi vazifa" }
```
**Response**:
```json
{ "success": true, "task": { "id": 21, "title": "Yangi vazifa", "status": "pending" } }
```
**Edge Function**: `admin-partners-tasks-add`

### 5.9 Cycle Task Status
**Endpoint**: `PATCH /api/partners/:pid/tasks/:tid`
**Business Logic**: Cycles status: `pending` → `progress` → `done` → `pending`
**Response**:
```json
{ "success": true, "task": { "id": 21, "title": "Yangi vazifa", "status": "progress" } }
```
**Edge Function**: `admin-partners-tasks-cycle`

### 5.10 Delete Task
**Endpoint**: `DELETE /api/partners/:pid/tasks/:tid`
**Response**:
```json
{ "success": true }
```
**Edge Function**: `admin-partners-tasks-delete`

### 5.11 Create Client for Partner
**Endpoint**: `POST /api/partners/:pid/client`
**Request**:
```json
{ "name": "Syngenta", "email": "client@syngenta.uz", "password": "client123" }
```
**Response**:
```json
{ "success": true, "client": { "id": 5, "email": "client@syngenta.uz" } }
```
**Edge Function**: `admin-partners-client-create`

### 5.12 Delete Client
**Endpoint**: `DELETE /api/partners/:pid/client`
**Response**:
```json
{ "success": true }
```
**Edge Function**: `admin-partners-client-delete`

### 5.13 Get Site Stats (Admin)
**Endpoint**: `GET /api/stats`
**Response**: Same as `/public/stats`
**Edge Function**: `admin-stats-get`

### 5.14 Update Site Stats
**Endpoint**: `PUT /api/stats`
**Request**:
```json
{
  "stats": [
    { "key": "bloggers", "value": "130+", "label": "Agro blogerlar" },
    { "key": "views", "value": "6M+", "label": "Oylik ko'rishlar" }
  ]
}
```
**Response**:
```json
{ "success": true, "stats": [...] }
```
**Edge Function**: `admin-stats-update`

---

## 6. Client Dashboard Endpoints (Auth Required: role = client)

### 6.1 Get My Partner Data
**Endpoint**: `GET /api/me/partner`
**Response**:
```json
{
  "partner": {
    "id": 1,
    "name": "Syngenta",
    "sphere": "O'g'it va himoya vositalari",
    "contract_no": "CT-2024-001",
    "amount": 500000000,
    "signed_date": "2024-01-15",
    "status": "active",
    "tasks": [
      { "id": 1, "title": "Reklama roligi tayyorlash", "status": "done" },
      { "id": 2, "title": "Blogerlar bilan uchrashuv", "status": "progress" },
      { "id": 3, "title": "Hisobot tayyorlash", "status": "pending" }
    ]
  }
}
```
**Business Logic**: Client's `partner_id` → get partner record → return with tasks
**Edge Function**: `me-partner`

---

## 7. Admin News Management Endpoints (Future)

### 7.1 Create News Article
**Endpoint**: `POST /api/news`
**Response**: `{ "success": true, "article": { ... } }`

### 7.2 Update News Article
**Endpoint**: `PUT /api/news/:id`

### 7.3 Delete News Article
**Endpoint**: `DELETE /api/news/:id`

### 7.4 List News (Admin)
**Endpoint**: `GET /api/news` (includes drafts, scheduled)

---

## 8. Complete Endpoint Index

| # | Method | Path | Auth | Role | Edge Function |
|---|--------|------|------|------|---------------|
| 1 | GET | `/api/public/stats` | No | - | `public-stats` |
| 2 | GET | `/api/public/bloggers` | No | - | `public-bloggers-list` |
| 3 | GET | `/api/public/bloggers/:slug` | No | - | `public-bloggers-profile` |
| 4 | GET | `/api/public/news` | No | - | `public-news-list` |
| 5 | GET | `/api/public/news/:slug` | No | - | `public-news-detail` |
| 6 | GET | `/api/public/news/popular` | No | - | `public-news-popular` |
| 7 | GET | `/api/public/news/:slug/related` | No | - | `public-news-related` |
| 8 | GET | `/api/public/partners` | No | - | `public-partners` |
| 9 | POST | `/api/contact` | No | - | `contact-submit` |
| 10 | POST | `/api/newsletter` | No | - | `newsletter-subscribe` |
| 11 | GET | `/api/newsletter/unsubscribe` | No | - | `newsletter-unsubscribe` |
| 12 | POST | `/api/auth/login` | No | - | `auth-login` |
| 13 | GET | `/api/auth/me` | Yes | any | `auth-me` |
| 14 | GET | `/api/me` | Yes | blogger | `me-profile` |
| 15 | PUT | `/api/me/profile` | Yes | blogger | `me-profile-update` |
| 16 | POST | `/api/me/socials` | Yes | blogger | `me-socials-add` |
| 17 | DELETE | `/api/me/socials/:id` | Yes | blogger | `me-socials-delete` |
| 18 | POST | `/api/me/videos` | Yes | blogger | `me-videos-add` |
| 19 | DELETE | `/api/me/videos/:id` | Yes | blogger | `me-videos-delete` |
| 20 | GET | `/api/bloggers` | Yes | superadmin | `admin-bloggers-list` |
| 21 | POST | `/api/bloggers` | Yes | superadmin | `admin-bloggers-create` |
| 22 | PATCH | `/api/bloggers/:id/status` | Yes | superadmin | `admin-bloggers-status` |
| 23 | DELETE | `/api/bloggers/:id` | Yes | superadmin | `admin-bloggers-delete` |
| 24 | GET | `/api/partners` | Yes | superadmin | `admin-partners-list` |
| 25 | POST | `/api/partners` | Yes | superadmin | `admin-partners-create` |
| 26 | DELETE | `/api/partners/:id` | Yes | superadmin | `admin-partners-delete` |
| 27 | POST | `/api/partners/:pid/tasks` | Yes | superadmin | `admin-partners-tasks-add` |
| 28 | PATCH | `/api/partners/:pid/tasks/:tid` | Yes | superadmin | `admin-partners-tasks-cycle` |
| 29 | DELETE | `/api/partners/:pid/tasks/:tid` | Yes | superadmin | `admin-partners-tasks-delete` |
| 30 | POST | `/api/partners/:pid/client` | Yes | superadmin | `admin-partners-client-create` |
| 31 | DELETE | `/api/partners/:pid/client` | Yes | superadmin | `admin-partners-client-delete` |
| 32 | GET | `/api/stats` | Yes | superadmin | `admin-stats-get` |
| 33 | PUT | `/api/stats` | Yes | superadmin | `admin-stats-update` |
| 34 | GET | `/api/me/partner` | Yes | client | `me-partner` |

---

## 9. Webhook / Cron-triggered Endpoints

| # | Trigger | Path | Purpose |
|---|---------|------|---------|
| 1 | Cron (6h) | `/api/cron/ai-news` | Run AI news discovery pipeline |
| 2 | Cron (hourly) | `/api/cron/social-refresh` | Refresh blogger social stats |
| 3 | Cron (daily) | `/api/cron/newsletter-digest` | Send weekly newsletter digest |
| 4 | Cron (daily) | `/api/cron/cleanup` | Clean expired tokens, old logs |
| 5 | Cron (15min) | `/api/cron/cache-warm` | Warm public endpoint caches |
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTk2NzE3OTA3OCwtMTU4Mjc3ODg1NSwtMT
E5OTI3OTA4Nl19
-->
