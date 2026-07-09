# Supabase Implementation Plan

## Agro Alliance Platform — Build Order & Dependencies (No SQL)

---

## 1. Implementation Philosophy

- **Order matters**: Each phase depends on the previous phase being complete
- **Test at each step**: Every migration and function is tested before moving to the next phase
- **Frontend parity**: After each phase, the frontend should work with live data for that module
- **No breaking changes**: Each phase is additive; no schema changes after phase is shipped

---

## 2. Phase Breakdown

### Phase 0: Project Setup
**Duration**: 1 day
**Dependencies**: None

| Step | Task | Details | Verification |
|------|------|---------|-------------|
| 0.1 | Create Supabase project | New project in Supabase dashboard | Project URL + anon key available |
| 0.2 | Configure auth settings | Site URL, redirect URLs, SMTP, providers | Auth emails sending |
| 0.3 | Create Cloudflare R2 bucket | `agro-alliance-media` with public/private/temp | Bucket accessible via API |
| 0.4 | Configure custom domains | `api.agroalliance.uz` → Supabase, `media.agroalliance.uz` → R2 | DNS verified, SSL active |
| 0.5 | Install Supabase CLI | Local development environment | `supabase --version` works |
| 0.6 | Initialize local Supabase | `supabase init` in project root | Local DB running |
| 0.7 | Configure Vite for production | Remove proxy, set production Supabase URL | `npm run build` succeeds |
| 0.8 | Delete/update `render.yaml` | Remove reference to nonexistent `server/` dir | Clean repo |

---

### Phase 1: Database Foundation
**Duration**: 2-3 days
**Dependencies**: Phase 0

| Step | Task | Depends On | Edge Functions Affected |
|------|------|-----------|------------------------|
| 1.1 | Create `profiles` table + auth hook + trigger | 0.2 | all (auth dependency) |
| 1.2 | Create `site_stats` table + seed data | 1.1 | `public-stats`, `admin-stats-*` |
| 1.3 | Create `contact_messages` table | 1.1 | `contact-submit` |
| 1.4 | Create `newsletter_subscribers` table | 1.1 | `newsletter-*` |
| 1.5 | Create `news_categories` (enum/reference table) | 1.1 | `public-news-*`, `admin-news-*` |
| 1.6 | Create `news` table | 1.5 | `public-news-*`, `admin-news-*` |
| 1.7 | Create `blogger_niches` (enum/reference table) | 1.1 | `public-bloggers-*` |
| 1.8 | Create `social_accounts` table | 1.1 | `me-socials-*` |
| 1.9 | Create `videos` table | 1.8 | `me-videos-*` |
| 1.10 | Create `partners` table | 1.1 | `admin-partners-*` |
| 1.11 | Create `partner_tasks` table | 1.10 | `admin-partners-tasks-*` |
| 1.12 | Create `notifications` table | 1.1 | (future) |
| 1.13 | Create `audit_log` table | 1.1 | (all admin endpoints) |
| 1.14 | Create `news_sources` table | 1.5 | `ai-news-*` |
| 1.15 | Create `social_posts` table | 1.8 | `social-*` |
| 1.16 | Create `social_account_stats_history` table | 1.8 | `social-refresh-stats` |

**RLS Policies**: Apply after each table creation

**Verification**: All tables created, foreign keys validated, RLS policies active

---

### Phase 2: Auth Integration
**Duration**: 1-2 days
**Dependencies**: Phase 1

| Step | Task | Depends On | Description |
|------|------|-----------|-------------|
| 2.1 | Create `auth-login` Edge Function | 1.1 | Authenticate via Supabase Auth, return JWT + profile |
| 2.2 | Create `auth-me` Edge Function | 1.1 | Read JWT, return user profile with role |
| 2.3 | Update `src/lib/auth.tsx` | 2.1-2.2 | Replace mock auth with Supabase Auth SDK |
| 2.4 | Wire login form to live API | 2.3 | Working login/logout flow |
| 2.5 | Test auth guard on dashboards | 2.4 | Unauthenticated → redirect, authenticated → dashboard |

**Verification**: Login/logout flow works end-to-end, role-based routing functional

---

### Phase 3: Public APIs
**Duration**: 2-3 days
**Dependencies**: Phase 2

| Step | Task | Depends On | Description |
|------|------|-----------|-------------|
| 3.1 | `public-stats` Edge Function | 1.2 | GET /api/public/stats |
| 3.2 | `public-bloggers-list` Edge Function | 1.7, 1.8 | GET /api/public/bloggers (paginated, filtered) |
| 3.3 | `public-bloggers-profile` Edge Function | 1.7, 1.8, 1.9 | GET /api/public/bloggers/:slug |
| 3.4 | `public-news-list` Edge Function | 1.6 | GET /api/public/news (paginated, filtered) |
| 3.5 | `public-news-detail` Edge Function | 1.6 | GET /api/public/news/:slug |
| 3.6 | `public-news-popular` Edge Function | 1.6 | GET /api/public/news/popular |
| 3.7 | `public-news-related` Edge Function | 1.6 | GET /api/public/news/:slug/related |
| 3.8 | `public-partners` Edge Function | 1.10 | GET /api/public/partners |
| 3.9 | `contact-submit` Edge Function | 1.3 | POST /api/contact |
| 3.10 | `newsletter-subscribe` Edge Function | 1.4 | POST /api/newsletter |
| 3.11 | `newsletter-unsubscribe` Edge Function | 1.4 | GET /api/newsletter/unsubscribe |

**Frontend Updates (After Each Step)**:
- 3.1: StatsBar on Home/About fetches live data
- 3.2: Bloggers page fetches list from API
- 3.3: Blogger Profile page fetches profile + socials + videos
- 3.4-3.7: News page fetches articles, detail, related
- 3.8: Partners page fetches partner logos
- 3.9: Contact form submits to API
- 3.10-3.11: Newsletter signup works

**Verification**: All public pages show live data, filters work, pagination functional

---

### Phase 4: Blogger Dashboard APIs
**Duration**: 2-3 days
**Dependencies**: Phase 3

| Step | Task | Depends On | Description |
|------|------|-----------|-------------|
| 4.1 | `me-profile` Edge Function | 1.1 | GET /api/me — full blogger profile |
| 4.2 | `me-profile-update` Edge Function | 1.1 | PUT /api/me/profile |
| 4.3 | `me-socials-add` Edge Function | 1.8 | POST /api/me/socials (auto-detect platform) |
| 4.4 | `me-socials-delete` Edge Function | 1.8 | DELETE /api/me/socials/:id |
| 4.5 | `me-videos-add` Edge Function | 1.9 | POST /api/me/videos (auto-fetch metadata) |
| 4.6 | `me-videos-delete` Edge Function | 1.9 | DELETE /api/me/videos/:id |

**Frontend Updates**:
- 4.1: Dashboard Overview shows live profile, socials, videos
- 4.2: Profile editing works with real save
- 4.3-4.4: Social account CRUD functional
- 4.5-4.6: Video CRUD functional

**Verification**: Blogger can view/edit profile, add/remove socials, add/remove videos

---

### Phase 5: Admin Dashboard APIs
**Duration**: 2-3 days
**Dependencies**: Phase 4

| Step | Task | Depends On | Description |
|------|------|-----------|-------------|
| 5.1 | `admin-bloggers-list` Edge Function | 1.1 | GET /api/bloggers |
| 5.2 | `admin-bloggers-create` Edge Function | 1.1 | POST /api/bloggers (creates auth user + profile) |
| 5.3 | `admin-bloggers-status` Edge Function | 1.1 | PATCH /api/bloggers/:id/status |
| 5.4 | `admin-bloggers-delete` Edge Function | 1.1 | DELETE /api/bloggers/:id |
| 5.5 | `admin-partners-list` Edge Function | 1.10, 1.11 | GET /api/partners |
| 5.6 | `admin-partners-create` Edge Function | 1.10 | POST /api/partners |
| 5.7 | `admin-partners-delete` Edge Function | 1.10 | DELETE /api/partners/:id |
| 5.8 | `admin-partners-tasks-add` Edge Function | 1.11 | POST /api/partners/:pid/tasks |
| 5.9 | `admin-partners-tasks-cycle` Edge Function | 1.11 | PATCH /api/partners/:pid/tasks/:tid |
| 5.10 | `admin-partners-tasks-delete` Edge Function | 1.11 | DELETE /api/partners/:pid/tasks/:tid |
| 5.11 | `admin-partners-client-create` Edge Function | 1.1, 1.10 | POST /api/partners/:pid/client |
| 5.12 | `admin-partners-client-delete` Edge Function | 1.1, 1.10 | DELETE /api/partners/:pid/client |
| 5.13 | `admin-stats-get` Edge Function | 1.2 | GET /api/stats |
| 5.14 | `admin-stats-update` Edge Function | 1.2 | PUT /api/stats |

**Frontend Updates**:
- 5.1-5.4: Blogger management table live
- 5.5-5.12: Partner management + tasks + client creation
- 5.13-5.14: Stats editor works

**Verification**: Full admin CRUD operational

---

### Phase 6: Client Dashboard API
**Duration**: 0.5 day
**Dependencies**: Phase 5

| Step | Task | Depends On | Description |
|------|------|-----------|-------------|
| 6.1 | `me-partner` Edge Function | 1.10, 1.11 | GET /api/me/partner (client → partner lookup) |

**Frontend Updates**:
- 6.1: Client dashboard shows live partner data

**Verification**: Client login → sees partner info, contract, tasks (read-only)

---

### Phase 7: Frontend Polish & Mock Data Removal
**Duration**: 1-2 days
**Dependencies**: Phases 3-6

| Step | Task | Description |
|------|------|-------------|
| 7.1 | Replace all mock data imports with API calls | `bloggers.ts`, `news.ts`, `ui.ts` stats |
| 7.2 | Move all client-side filtering to server-side | Bloggers page, News page |
| 7.3 | Wire all `href="#"` buttons | Header/footer links, CTAs, share buttons |
| 7.4 | Remove dead assets | `icons.svg`, `hero.png`, `react.svg`, `vite.svg` |
| 7.5 | Add loading/error/empty states | Consistent across all data-fetching components |
| 7.6 | SEO meta tags on all public pages | title, description, OG tags |

**Verification**: No mock data, all `href="#"` replaced, no dead assets

---

### Phase 8: Edge Function Hardening
**Duration**: 1 day
**Dependencies**: Phases 3-6

| Step | Task | Description |
|------|------|-------------|
| 8.1 | Add rate limiting | Login (5/15min), Contact (3/hr), Uploads (10/hr) |
| 8.2 | Add comprehensive validation | All inputs validated at Edge Function level |
| 8.3 | Audit logging on admin actions | Create/delete/update logged to `audit_log` |
| 8.4 | Error response audit | All functions return consistent error format |
| 8.5 | CORS hardening | Specific origin whitelist, not wildcard in production |
| 8.6 | Token expiry handling | 401 → refresh attempt → clear + redirect |

**Verification**: Security review passes

---

### Phase 9: Media Storage Migration
**Duration**: 1 day
**Dependencies**: Phase 4

| Step | Task | Description |
|------|------|-------------|
| 9.1 | Create photo upload Edge Function | POST /api/me/profile/photo (multipart) |
| 9.2 | Implement image processing pipeline | Sharp for resize, WebP convert, variant generation |
| 9.3 | Implement R2 upload integration | Store variants, return CDN URLs |
| 9.4 | Migrate blogger photo from base64 to multipart | Update BloggerDashboard photo upload |
| 9.5 | Implement signed URLs for private content | Contracts, attachments |

**Verification**: Photo uploads go to R2, served via CDN, variants generated

---

### Phase 10: Notification System
**Duration**: 1-2 days
**Dependencies**: Phase 4

| Step | Task | Description |
|------|------|-------------|
| 10.1 | Create notifications table | Already in Phase 1; ensure complete |
| 10.2 | Create notification triggers | On task complete, blogger create, contact submit |
| 10.3 | Implement Supabase Realtime subscription | Dashboard bell icon shows live count |
| 10.4 | Create notification list UI | Dashboard dropdown/modal with read/unread |

**Verification**: Real-time notifications appear on dashboard

---

### Phase 11: AI News Engine
**Duration**: 3-5 days
**Dependencies**: Phase 1 (news_sources table)

| Step | Task | Description |
|------|------|-------------|
| 11.1 | Create `news_sources` table | Already in Phase 1 |
| 11.2 | `ai-news-discover` Worker | RSS parsing, Telegram monitoring, web scraping |
| 11.3 | `ai-news-validate` Worker | AI validation via Workers AI |
| 11.4 | `ai-news-generate` Worker | AI article generation in Uzbek |
| 11.5 | `ai-news-publish` Worker | Auto-publish or save as draft |
| 11.6 | Configure cron triggers | Every 6 hours for full pipeline |
| 11.7 | Admin review interface | View/manage AI-generated drafts |
| 11.8 | Quality monitoring dashboard | Auto-publish rate, rejection rate, cost tracking |

**Verification**: Pipeline runs on cron, produces valid articles, auto-publishes high-confidence content

---

### Phase 12: Social Automation
**Duration**: 2-3 days
**Dependencies**: Phase 4

| Step | Task | Description |
|------|------|-------------|
| 12.1 | Telegram bot setup | Bot token, webhook, channel membership |
| 12.2 | `social-refresh-stats` Cron Worker | Hourly refresh of all social account stats |
| 12.3 | `social-refresh-videos` Cron Worker | Check for new videos from connected accounts |
| 12.4 | Social auto-detection in `me-socials-add` | Platform detection + metadata fetch |
| 12.5 | Auto-publish news to Telegram | On article publish → formatted post |
| 12.6 | Retry logic for failed social operations | 3 retries with exponential backoff |

**Verification**: Blogger adds social URL → metadata fetched. Stats refresh hourly.

---

### Phase 13: SEO & Performance
**Duration**: 1 day
**Dependencies**: Phase 7

| Step | Task | Description |
|------|------|-------------|
| 13.1 | Generate sitemap.xml | All public routes + news articles + blogger profiles |
| 13.2 | Implement server-side rendering | (Optional) to improve SEO for dynamic content |
| 13.3 | Image lazy loading audit | Ensure all `<img>` tags use `loading="lazy"` |
| 13.4 | Code splitting | Route-based lazy loading via React.lazy |
| 13.5 | Bundle analysis | Verify initial JS < 200KB |
| 13.6 | Lighthouse audit | Target 90+ on all categories |

**Verification**: Lighthouse scores verified, sitemap submitted to search engines

---

### Phase 14: Deployment & Go-Live
**Duration**: 0.5 day
**Dependencies**: All phases

| Step | Task | Description |
|------|------|-------------|
| 14.1 | CI/CD pipeline setup | GitHub Actions for build + deploy |
| 14.2 | Edge Function deploy automation | `supabase functions deploy` in CI |
| 14.3 | Database migration automation | Supabase migrations in CI |
| 14.4 | Staging environment verification | Full smoke test on staging |
| 14.5 | Production database backup | Before final deploy |
| 14.6 | Production deploy | Frontend + Edge Functions + migrations |
| 14.7 | Post-deploy smoke test | All critical paths verified |
| 14.8 | DNS cutover | (if changing hosts) Low TTL → switch → restore TTL |
| 14.9 | Monitoring setup | Alerts configured, dashboards ready |

**Verification**: Site live, all features working, monitoring active

---

## 3. Implementation Map

```
Phase 0: Project Setup (1d)
    │
    ▼
Phase 1: Database Foundation (2-3d)
    │
    ▼
Phase 2: Auth Integration (1-2d)
    │
    ├────────────────────────────────────┐
    ▼                                     ▼
Phase 3: Public APIs (2-3d)      Phase 8: Edge Function Hardening (1d)
    │                                     │
    ▼                                     │
Phase 4: Blogger Dashboard (2-3d)        │
    │                                     │
    ├─────────────────────────────────────┤
    ▼                                     │
Phase 5: Admin Dashboard (2-3d)          │
    │                                     │
    ▼                                     │
Phase 6: Client Dashboard (0.5d)         │
    │                                     │
    ▼                                     │
Phase 7: Frontend Polish (1-2d)          │
    │                                     │
    ├─────────────────────────────────────┘
    │
    ▼
Phase 9: Media Storage (1d)
    │
    ▼
Phase 10: Notifications (1-2d)
    │
    ▼
Phase 11: AI News Engine (3-5d)
    │
    ▼
Phase 12: Social Automation (2-3d)
    │
    ▼
Phase 13: SEO & Performance (1d)
    │
    ▼
Phase 14: Deployment & Go-Live (0.5d)
```

## 4. Total Estimated Timeline

| Phase | Tasks | Days | Parallelizable |
|-------|-------|------|---------------|
| 0 | 8 | 1 | No |
| 1 | 16 | 3 | No (sequential tables) |
| 2 | 5 | 2 | No |
| 3 | 11 | 3 | Yes (within phase) |
| 4 | 6 | 3 | No |
| 5 | 14 | 3 | Yes (within phase) |
| 6 | 1 | 0.5 | No |
| 7 | 6 | 2 | Yes |
| 8 | 6 | 1 | Yes |
| 9 | 5 | 1 | No |
| 10 | 4 | 2 | Partial |
| 11 | 8 | 5 | Partial |
| 12 | 6 | 3 | Partial |
| 13 | 6 | 1 | Yes |
| 14 | 9 | 0.5 | No |
| **Total** | **111** | **~28 days** | |

## 5. Parallelization Strategy

| Track A (API + Frontend) | Track B (Media + Automation) | Track C (Infrastructure) |
|--------------------------|------------------------------|--------------------------|
| Phases 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 | Phase 9 → 10 → 11 → 12 | Phase 13 → 14 |

Once Phase 3 is complete, Track B can begin in parallel with Tracks A (Phase 4+) and C.

## 6. Milestone Gates

| Gate | Phase | Criteria |
|------|-------|----------|
| G1 | End of Phase 2 | Auth works end-to-end (login/logout/redirect) |
| G2 | End of Phase 3 | All public pages show live data |
| G3 | End of Phase 6 | All three dashboards fully functional |
| G4 | End of Phase 8 | Security hardening + error handling complete |
| G5 | End of Phase 11 | AI News Engine produces first auto-published article |
| G6 | End of Phase 14 | Site live in production |

---

## 7. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Supabase Auth limits | Low | Medium | Pro plan has higher rate limits; cache aggressively |
| AI model cost | Medium | Medium | Start with Workers AI (free tier), monitor usage |
| YouTube API quota exhausted | Medium | High | Cache results, stagger refresh intervals |
| Telegram API rate limits | Low | Low | Queue messages, respect 20 msg/min |
| R2 egress costs | Low | Low | Use CDN caching, estimate < 500GB/month |
| Migration conflicts | Low | High | Test migrations on staging first, never run on prod untested |
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTk2NzE3OTA3OCwtMTU4Mjc3ODg1NSwxOD
UzNTA2MTg3LC0xOTIzNzQ0Mzg5LDE3MjAzMDU2NzldfQ==
-->
