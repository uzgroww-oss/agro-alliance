# Role & Permission Workflow

## Agro Alliance Platform — Role Hierarchy, Permissions & Access Control

---

## 1. Role Architecture

### 1.1 Role Hierarchy

```
                ┌──────────────┐
                │  superadmin  │  ← Full system access
                └──────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
   ┌──────────────┐          ┌──────────────┐
   │   blogger    │          │    client    │  ← Limited, per-partner access
   └──────────────┘          └──────────────┘
```

### 1.2 Role Definitions

| Role | ID | Description | Dashboard Path | Base Path |
|------|----|-------------|----------------|-----------|
| superadmin | 0 | System administrator with full platform control | `/admin` | `/api/*` |
| blogger | 1 | Content creator registered on the platform | `/dashboard` | `/api/me/*` |
| client | 2 | Partner/company representative (read-only) | `/mijoz` | `/api/me/partner` |

### 1.3 Status Sub-states

```
superadmin → active (only state)
blogger    → pending | active | banned
client     → active | suspended
```

---

## 2. Permission Matrix

### 2.1 API Endpoint Permissions

| # | Endpoint | Method | superadmin | blogger | client | Public |
|---|----------|--------|------------|---------|--------|--------|
| 1 | `/api/public/stats` | GET | ✓ | ✓ | ✓ | ✓ |
| 2 | `/api/public/bloggers` | GET | ✓ | ✓ | ✓ | ✓ |
| 3 | `/api/public/bloggers/:slug` | GET | ✓ | ✓ | ✓ | ✓ |
| 4 | `/api/public/news` | GET | ✓ | ✓ | ✓ | ✓ |
| 5 | `/api/public/news/:slug` | GET | ✓ | ✓ | ✓ | ✓ |
| 6 | `/api/public/news/popular` | GET | ✓ | ✓ | ✓ | ✓ |
| 7 | `/api/public/news/:slug/related` | GET | ✓ | ✓ | ✓ | ✓ |
| 8 | `/api/public/partners` | GET | ✓ | ✓ | ✓ | ✓ |
| 9 | `/api/contact` | POST | — | — | — | ✓ |
| 10 | `/api/newsletter` | POST | — | — | — | ✓ |
| 11 | `/api/newsletter/unsubscribe` | GET | — | — | — | ✓ |
| 12 | `/api/auth/login` | POST | — | — | — | ✓ |
| 13 | `/api/auth/me` | GET | ✓ | ✓ | ✓ | — |
| 14 | `/api/me` | GET | — | ✓ | — | — |
| 15 | `/api/me/profile` | PUT | — | ✓ | — | — |
| 16 | `/api/me/socials` | POST | — | ✓ | — | — |
| 17 | `/api/me/socials/:id` | DELETE | — | ✓ | — | — |
| 18 | `/api/me/videos` | POST | — | ✓ | — | — |
| 19 | `/api/me/videos/:id` | DELETE | — | ✓ | — | — |
| 20 | `/api/me/partner` | GET | — | — | ✓ | — |
| 21 | `/api/bloggers` | GET | ✓ | — | — | — |
| 22 | `/api/bloggers` | POST | ✓ | — | — | — |
| 23 | `/api/bloggers/:id` | DELETE | ✓ | — | — | — |
| 24 | `/api/bloggers/:id/status` | PATCH | ✓ | — | — | — |
| 25 | `/api/partners` | GET | ✓ | — | — | — |
| 26 | `/api/partners` | POST | ✓ | — | — | — |
| 27 | `/api/partners/:id` | DELETE | ✓ | — | — | — |
| 28 | `/api/partners/:pid/tasks` | POST | ✓ | — | — | — |
| 29 | `/api/partners/:pid/tasks/:tid` | PATCH | ✓ | — | — | — |
| 30 | `/api/partners/:pid/tasks/:tid` | DELETE | ✓ | — | — | — |
| 31 | `/api/partners/:pid/client` | POST | ✓ | — | — | — |
| 32 | `/api/partners/:pid/client` | DELETE | ✓ | — | — | — |
| 33 | `/api/stats` | GET | ✓ | — | — | — |
| 34 | `/api/stats` | PUT | ✓ | — | — | — |

### 2.2 Frontend Route Permissions

| Route | superadmin | blogger | client | Public |
|-------|------------|---------|--------|--------|
| `/` | ✓ | ✓ | ✓ | ✓ |
| `/about` | ✓ | ✓ | ✓ | ✓ |
| `/blogerlar` | ✓ | ✓ | ✓ | ✓ |
| `/blogerlar/:slug` | ✓ | ✓ | ✓ | ✓ |
| `/platforma` | ✓ | ✓ | ✓ | ✓ |
| `/yangiliklar` | ✓ | ✓ | ✓ | ✓ |
| `/yangiliklar/:slug` | ✓ | ✓ | ✓ | ✓ |
| `/hamkorlar` | ✓ | ✓ | ✓ | ✓ |
| `/aloqa` | ✓ | ✓ | ✓ | ✓ |
| `/kirish` | ✓ | ✓ | ✓ | ✓ |
| `/dashboard` | — | ✓ | — | — |
| `/admin` | ✓ | — | — | — |
| `/mijoz` | — | — | ✓ | — |

---

## 3. Row-Level Security (RLS) Policies

### 3.1 `profiles` Table

| Operation | Policy | Description |
|-----------|--------|-------------|
| SELECT (own) | `auth.uid() = id` | Blogger can read own profile |
| SELECT (public) | `role = 'blogger' AND status = 'active'` | Anyone can list active bloggers |
| SELECT (admin) | `auth.role() = 'superadmin'` | Admin can read all profiles |
| INSERT | `auth.role() = 'superadmin'` | Only admin creates accounts |
| UPDATE (own) | `auth.uid() = id AND auth.role() = 'blogger'` | Blogger updates own profile |
| UPDATE (admin) | `auth.role() = 'superadmin'` | Admin can update any profile |
| DELETE | `auth.role() = 'superadmin'` | Only admin deletes profiles |

### 3.2 `social_accounts` Table

| Operation | Policy |
|-----------|--------|
| SELECT (own) | `blogger_id = auth.uid()` |
| SELECT (public) | Blogger's status = 'active' |
| INSERT | `blogger_id = auth.uid()` |
| DELETE | `blogger_id = auth.uid()` |
| UPDATE | `blogger_id = auth.uid()` |

### 3.3 `videos` Table

| Operation | Policy |
|-----------|--------|
| SELECT (own) | `blogger_id = auth.uid()` |
| SELECT (public) | Blogger's status = 'active' |
| INSERT | `blogger_id = auth.uid()` |
| DELETE | `blogger_id = auth.uid()` |

### 3.4 `partners` Table

| Operation | Policy |
|-----------|--------|
| All operations | `auth.role() = 'superadmin'` |
| SELECT (client) | `auth.role() = 'client' AND id = auth.user().partner_id` |

### 3.5 `partner_tasks` Table

| Operation | Policy |
|-----------|--------|
| All CRUD | `auth.role() = 'superadmin'` |
| SELECT (client) | `partner_id IN (SELECT partner_id FROM profiles WHERE id = auth.uid())` |

### 3.6 `news` Table

| Operation | Policy |
|-----------|--------|
| SELECT (published) | `status = 'published'` (public) |
| SELECT (admin) | `auth.role() = 'superadmin'` (includes drafts) |
| INSERT/UPDATE/DELETE | `auth.role() = 'superadmin'` |

### 3.7 `site_stats` Table

| Operation | Policy |
|-----------|--------|
| SELECT | Public (no auth) |
| UPDATE | `auth.role() = 'superadmin'` |

### 3.8 `contact_messages` Table

| Operation | Policy |
|-----------|--------|
| INSERT | Public (no auth) |
| SELECT | `auth.role() = 'superadmin'` |

### 3.9 `newsletter_subscribers` Table

| Operation | Policy |
|-----------|--------|
| INSERT | Public (no auth) |
| SELECT | `auth.role() = 'superadmin'` |

---

## 4. Auth Flow Diagrams

### 4.1 Login Flow
```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐
│  Login  │ → │ Supabase │ → │ Profile  │ → │  Redirect  │
│  Form   │    │  Auth    │    │  Lookup  │    │ roleHome() │
└─────────┘    └──────────┘    └──────────┘    └───────────┘
     │              │               │               │
     │  email+pass  │  validate     │  get role     │  /admin | /dashboard | /mijoz
     └──────────────┴───────────────┴───────────────┘
```

### 4.2 Auth Guard Flow
```
┌──────────┐    ┌────────┐    ┌───────────┐    ┌──────────┐
│  Route   │ → │ Check  │ → │  Match    │ → │  Render  │
│  Access  │    │ Token  │    │  Role?    │    │  Page    │
└──────────┘    └────────┘    └───────────┘    └──────────┘
     │              │               │               │
     │              │               ├── No ──────→ Redirect to roleHome(role)
     │              └── No Token ──→ Redirect to /kirish
     │                             or other dashboard
```

### 4.3 Session Refresh Flow
```
┌──────────┐    ┌──────────────┐    ┌──────────┐
│  API     │ → │ Token Expired│ → │  Refresh │
│  Request │    │ (401)        │    │  Token   │
└──────────┘    └──────────────┘    └──────────┘
                                          │
                                          ▼
                                    ┌──────────┐
                                    │  Retry   │
                                    │  Request │
                                    └──────────┘
                                          │
                                    ┌──────────┐
                                    │ Refresh  │
                                    │  Failed  │ → Redirect to /kirish
                                    └──────────┘
```

---

## 5. Edge Function Auth Middleware

Every Edge Function (for protected routes) must:

```typescript
// Shared Middleware Pattern
async function handle(req: Request, handler: (user: User) => Response) {
  // 1. Extract JWT from Authorization header
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Token kerak' }), { status: 401 })
  }
  const token = auth.slice(7)

  // 2. Verify JWT with Supabase Admin client
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Token notog\'ri' }), { status: 401 })
  }

  // 3. Fetch profile with role
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return new Response(JSON.stringify({ error: 'Profil topilmadi' }), { status: 404 })
  }

  // 4. Check status
  if (profile.status !== 'active') {
    return new Response(JSON.stringify({ error: 'Hisobingiz faollashtirilmagan' }), { status: 403 })
  }

  // 5. Call handler with user+profile context
  return handler({ ...user, ...profile })
}
```

### Role-Specific Middleware Wrappers

```
requireAuth(handler)          → Any authenticated user
requireRole('blogger', handler) → Only bloggers
requireRole('superadmin', handler) → Only admins
requireRole('client', handler)   → Only clients
```

---

## 6. Permission Enforcement Points

| Layer | Enforcement | Responsibility |
|-------|-------------|---------------|
| Frontend Routes | `RequireRole` component | React Router guard |
| Frontend UI | Conditional rendering by role | Hide admin buttons from bloggers |
| API Gateway | Supabase Auth middleware | Reject unauthenticated requests |
| Edge Functions | Middleware role check | Reject unauthorized roles |
| Database | RLS policies | Row-level data access |
| Database | Foreign key constraints | Referential integrity |

---

## 7. Audit Logging (Admin Activity)

All admin actions are logged to `audit_log`:

| Action | Log Entry |
|--------|-----------|
| Create blogger | `{ actor_id, action: "blogger.create", target_id, metadata }` |
| Delete blogger | `{ actor_id, action: "blogger.delete", target_id, metadata }` |
| Toggle status | `{ actor_id, action: "blogger.status", target_id, metadata: { from, to } }` |
| Create partner | `{ actor_id, action: "partner.create", target_id }` |
| Delete partner | `{ actor_id, action: "partner.delete", target_id }` |
| Update stats | `{ actor_id, action: "stats.update", metadata: { before, after } }` |

`audit_log` is viewable only by superadmin.

---

## 8. Future Permission Enhancements

| Feature | Description | Priority |
|---------|-------------|----------|
| Custom roles | Allow admin to define custom roles with granular permissions | Deferred |
| Permission groups | Group endpoints into permission sets (e.g., "content:write", "users:read") | Deferred |
| API keys | Allow programmatic access via API keys for partners | Deferred |
| 2FA enforcement | Optional two-factor authentication for admin accounts | Deferred |
| Session management | View and revoke active sessions from admin panel | Deferred |
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTk2NzE3OTA3OCwtMTU4Mjc3ODg1NSwxOD
UzNTA2MTg3LC0xOTIzNzQ0Mzg5LDE1MjI2OTUxNDldfQ==
-->
