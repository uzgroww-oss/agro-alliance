# Production Readiness Checklist

## Agro Alliance Platform — Go-Live Requirements & Verification

---

## 1. Infrastructure

### 1.1 Supabase Project
- [ ] Project created on Supabase (pro plan or above)
- [ ] Custom SMTP configured (email delivery for auth)
- [ ] Custom domain configured (`api.agroalliance.uz`)
- [ ] Database size estimation complete (< 500MB → free tier OK)
- [ ] Point-in-time recovery enabled
- [ ] SSL enforce mode enabled
- [ ] Branching configured for dev/staging/prod

### 1.2 Cloudflare R2
- [ ] R2 bucket `agro-alliance-media` created
- [ ] Custom domain (`media.agroalliance.uz`) connected via Cloudflare
- [ ] Cache rules configured (1 year for public assets)
- [ ] Signed URL generation implemented for private bucket
- [ ] CORS policy configured for frontend domain
- [ ] Lifecycle rules: temp/ → delete after 24h, backups/ → archive after 90d

### 1.3 Cloudflare Workers / AI
- [ ] Workers AI enabled for LLM inference
- [ ] Worker scripts deployed for AI News Engine pipeline
- [ ] Workers.dev subdomain configured or custom domain
- [ ] KV namespace created for AI queue state (optional)
- [ ] Cron triggers configured for all scheduled jobs

### 1.4 Frontend Hosting
- [ ] Vite build passes (`npm run build`)
- [ ] TypeScript build passes (`tsc -b`)
- [ ] Lint passes (`npm run lint`)
- [ ] Deployed to Cloudflare Pages / Vercel / Netlify
- [ ] Custom domain (`agroalliance.uz`) configured
- [ ] SSL certificate valid
- [ ] `render.yaml` removed or updated (references nonexistent `server/` dir)
- [ ] Vite proxy (`/api → localhost:3001`) removed for production
- [ ] Environment variables set (no hardcoded URLs/keys)

---

## 2. Security

### 2.1 Authentication & Authorization
- [ ] All Edge Functions validate JWT for protected routes
- [ ] RLS policies enabled on ALL tables (no table accessible without policy)
- [ ] Role-based middleware: `requireRole('superadmin')` enforced on admin endpoints
- [ ] Demo credentials removed from Login.tsx (`admin@.../admin123`)
- [ ] Password reset flow end-to-end tested
- [ ] Rate limiting: 5 login attempts/15 min per IP
- [ ] Rate limiting: 3 contact form submissions/email/hour
- [ ] Rate limiting: 10 uploads/hour per user

### 2.2 Data Protection
- [ ] All API tokens stored in Supabase Vault (not hardcoded)
- [ ] Platform API keys (YouTube, Telegram, etc.) not exposed to frontend
- [ ] EXIF data stripped from image uploads
- [ ] File upload validation: magic bytes + extension whitelist
- [ ] No secrets in frontend code or environment
- [ ] `robots.txt` configured (public pages indexable, dashboards blocked)
- [ ] Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options

### 2.3 Audit & Logging
- [ ] Admin actions logged to `audit_log` table
- [ ] API error logging to Supabase Logs or external service
- [ ] Failed login attempts logged
- [ ] AI pipeline errors logged with context
- [ ] Log retention policy defined: 90 days

---

## 3. Database

### 3.1 Schema
- [ ] All 35+ tables created
- [ ] All foreign key constraints defined
- [ ] All unique constraints defined (email, slug, etc.)
- [ ] Indexes created for frequently queried columns:
  - `profiles`: email (unique), role, status, niche, region
  - `news`: slug (unique), category, status, published_at, views
  - `social_accounts`: blogger_id, platform
  - `videos`: blogger_id, platform
  - `partners`: status, client_id
  - `partner_tasks`: partner_id, status
  - `site_stats`: key (unique)
- [ ] Full-text search index on news (title + description)
- [ ] Full-text search index on profiles (name + tag)
- [ ] `created_at` indexes for sorting on all entity tables

### 3.2 Data Integrity
- [ ] `auth.users` ↔ `profiles` sync via trigger/hook
- [ ] Cascade deletes configured where appropriate
- [ ] Soft-delete pattern for critical entities (optional)
- [ ] No orphaned foreign key references possible

---

## 4. Edge Functions

### 4.1 Deployment
- [ ] All 34 Edge Functions deployed
- [ ] Function size < 10MB each (verify bundled size)
- [ ] Cold start < 500ms (warm via cron pings)
- [ ] Import maps configured for shared dependencies
- [ ] CORS headers set on all functions (`Access-Control-Allow-Origin: *`)

### 4.2 Error Handling
- [ ] Try/catch wrapping on all function handlers
- [ ] Consistent error response format: `{ error, code?, details? }`
- [ ] HTTP status codes correct: 200, 201, 400, 401, 403, 404, 409, 429, 500
- [ ] Validation errors return 400 with field-level details
- [ ] Auth errors return 401 with "Token kerak" or "Token notog'ri"
- [ ] Role errors return 403 with "Ruxsat yo'q"

### 4.3 Performance
- [ ] Database connection pooling configured (pg_bouncer)
- [ ] Query optimization: SELECT only needed columns
- [ ] Pagination limits enforced (max 50 per page)
- [ ] CORS preflight (OPTIONS) handled efficiently

---

## 5. Frontend

### 5.1 Mock Data Removal
- [ ] `src/lib/bloggers.ts` mock data replaced with API calls
- [ ] `src/lib/news.ts` mock data replaced with API calls
- [ ] `src/lib/ui.ts` static stats replaced with live `/public/stats`
- [ ] `src/pages/Bloggers.tsx` client-side filter/search → server-side
- [ ] `src/pages/News.tsx` client-side filter → server-side
- [ ] `src/pages/BloggerProfile.tsx` static sections → live from API
- [ ] `src/pages/BloggerProfile.tsx` mock videos → live from API
- [ ] `src/pages/Contact.tsx` client-side mock form → POST `/api/contact`
- [ ] `src/pages/Login.tsx` mock API → Supabase Auth

### 5.2 API Client Update
- [ ] `src/lib/api.ts` base URL from proxy to production Supabase URL
- [ ] Token management compatible with Supabase JWT
- [ ] Error handling: parse Supabase error format

### 5.3 Auth Migration
- [ ] `src/lib/auth.tsx` → Supabase Auth SDK
- [ ] Session refresh handling
- [ ] OAuth providers (Google, Telegram) integrated
- [ ] `RequireRole` component works with Supabase user data

### 5.4 Dead Code Removal
- [ ] `public/icons.svg` — unused, remove
- [ ] `src/assets/hero.png`, `react.svg`, `vite.svg` — unused, remove
- [ ] `render.yaml` — outdated, remove or update

### 5.5 SEO
- [ ] Meta tags on all public pages (title, description, OG)
- [ ] Semantic HTML: proper heading hierarchy
- [ ] Alt text on all images
- [ ] `sitemap.xml` generated
- [ ] Canonical URLs configured

### 5.6 Performance
- [ ] Image lazy loading via `<img loading="lazy">`
- [ ] Code splitting via React Router lazy imports
- [ ] Bundle analysis (< 200KB initial JS)
- [ ] Lighthouse score targets: >90 Performance, >90 Accessibility, >90 SEO

---

## 6. CI/CD

- [ ] GitHub Actions workflow for:
  - [ ] TypeScript type checking (`tsc -b`)
  - [ ] Lint (`npm run lint`)
  - [ ] Build (`npm run build`)
  - [ ] Supabase Edge Function deploy (`supabase functions deploy`)
  - [ ] DB migrations apply
- [ ] Staging environment: `staging.agroalliance.uz`
- [ ] Production environment: `agroalliance.uz`
- [ ] Automated test suite running on PR
- [ ] Deploy gate: all checks must pass before merge to main

---

## 7. Monitoring & Observability

### 7.1 Logs
- [ ] Supabase Logs: API errors, Edge Function invocations
- [ ] Database query performance monitoring
- [ ] Edge Function error rate alerting
- [ ] 4xx/5xx error rate dashboard

### 7.2 Metrics
- [ ] Daily active users (DAU)
- [ ] API request count by endpoint
- [ ] Edge Function cold start frequency
- [ ] Average response time per endpoint
- [ ] P99 latency for critical endpoints
- [ ] Database query performance (slow queries)
- [ ] Storage usage (R2 bucket size)
- [ ] AI pipeline success/failure rate

### 7.3 Alerts
- [ ] Edge Function error rate > 1% → notify admin
- [ ] Database CPU > 80% → notify admin
- [ ] AI pipeline failure → notify admin (email + in-app)
- [ ] API key quota > 80% → notify admin
- [ ] Storage usage > 80% capacity → notify admin
- [ ] Failed login spike > 100/hour → security alert

---

## 8. Testing

### 8.1 Edge Function Tests
- [ ] Each public endpoint returns correct data
- [ ] Each protected endpoint rejects unauthenticated requests
- [ ] Each role-gated endpoint rejects wrong roles
- [ ] Pagination works correctly on list endpoints
- [ ] Search/filter parameters work correctly
- [ ] Error cases return correct status codes

### 8.2 Integration Tests
- [ ] Auth flow: login → token → dashboard → logout
- [ ] Blogger flow: profile update → add social → add video → delete
- [ ] Admin flow: create blogger → toggle status → delete
- [ ] Admin flow: create partner → add tasks → cycle → create client
- [ ] Client flow: login → view partner data (read-only)
- [ ] Contact form: submit → message received
- [ ] Newsletter: subscribe → duplicate → unsubscribe

### 8.3 Load Tests
- [ ] Public endpoints sustain 1000 req/min
- [ ] Dashboard endpoints sustain 100 req/min
- [ ] Simultaneous AI pipeline run doesn't degrade API
- [ ] Database handles concurrent RLS queries

---

## 9. Content & Data

### 9.1 Seed Data
- [ ] 5 default site stats entries
- [ ] 9 news categories
- [ ] 8 blogger categories (niches)
- [ ] At least 5 sample bloggers with profiles
- [ ] At least 5 news articles
- [ ] Sample partner data with tasks
- [ ] FAQ entries

### 9.2 Production Data Migration
- [ ] `auth.users` → `profiles` sync trigger active
- [ ] Existing mock data backed up (if any)
- [ ] No residual test data in production

---

## 10. Legal & Compliance

- [ ] Privacy policy page published
- [ ] Terms of service page published
- [ ] Cookie consent banner implemented
- [ ] GDPR compliance: data deletion request process
- [ ] Data retention policy documented
- [ ] User data export capability (profile download)
- [ ] Contact info for data protection inquiries

---

## 11. Pre-Launch Verification

### 11.1 Functional Verification
- [ ] All public pages load correctly
- [ ] All dashboard pages load for correct roles
- [ ] Auth flow works (login, logout, session persistence)
- [ ] Bloggers page shows live data from database
- [ ] News page shows live data from database
- [ ] Blogger profile loads live data
- [ ] Partner management CRUD works
- [ ] Client dashboard shows correct partner data
- [ ] Stats editor updates public stats
- [ ] Contact form submits and notifies admin
- [ ] Newsletter subscription flow complete

### 11.2 Smoke Test
- [ ] Home page → StatsBar shows live numbers
- [ ] Bloggers → filter by category → results update
- [ ] News → filter by category → results update
- [ ] Blogger login → dashboard loads → profile editable
- [ ] Admin login → full CRUD operations
- [ ] Client login → read-only partner view

### 11.3 Rollback Plan
- [ ] Database backup taken before launch
- [ ] Previous frontend build available for rollback
- [ ] Edge Function versioning: can revert to prev version
- [ ] DNS TTL lowered to 5 minutes prior to cutover

---

## 12. Post-Launch

- [ ] Monitor error rates for first 24 hours
- [ ] Verify all analytics counters accumulating
- [ ] Check newsletter delivery rate
- [ ] Verify AI pipeline first run produces valid articles
- [ ] Check R2 storage costs after first week
- [ ] Collect user feedback and prioritize fixes
- [ ] Schedule first retrospective: 2 weeks post-launch
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTk2NzE3OTA3OCwtMTU4Mjc3ODg1NSwxOD
UzNTA2MTg3LC0xOTIzNzQ0Mzg5LDEzMjgyNTQ1NDksMTU3NzIx
Mjc3OF19
-->
