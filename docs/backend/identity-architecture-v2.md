# Identity Architecture v2 — Enterprise RBAC

## Overview

The Identity module provides production-ready Role-Based Access Control (RBAC) with multi-role support, granular permissions, soft-delete, and complete Row-Level Security.

### Core Tables

| Table | Purpose |
|-------|---------|
| `roles` | Role definitions with priority and system flag |
| `permissions` | Granular `resource.action` permission codes |
| `role_permissions` | Many-to-many: role ↔ permission assignments |
| `user_roles` | Many-to-many: profile ↔ role assignments (multi-role support) |
| `profiles` | User profiles linked to `auth.users` |

---

## 1. Architecture

### Table Relationships

```
auth.users (managed by Supabase Auth)
    │
    │ 1:1 (ON DELETE CASCADE)
    ▼
profiles
    │
    │ M:N via user_roles (ON DELETE CASCADE)
    ├────────────────────┐
    ▼                    ▼
user_roles ────────► roles
                        │
                        │ M:N via role_permissions (ON DELETE CASCADE)
                        ├────────────────────┐
                        ▼                    ▼
              role_permissions ────────► permissions
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `user_roles` replaces `profiles.role_id` | Enables multi-role support (e.g., editor+blogger) |
| Permission codes use `resource.action` | Consistent namespace, easy to parse, no ambiguity |
| `auth_role()` returns highest-priority role | Backward-compatible with frontend's single-role expectation |
| `auth_roles()` returns all roles | New function for backend permission checks |
| `profiles.email` denormalized | Avoids expensive auth.users joins; synced via trigger |
| Partial unique indexes with `WHERE deleted_at IS NULL` | Allows soft-delete without constraint conflicts |
| SECURITY DEFINER on helper functions | Bypasses RLS to prevent recursion in policy checks |

---

## 2. Role Hierarchy

```
Priority 100  super_admin ─── Full system access
Priority 80   admin       ─── Admin (excludes system-critical operations)
Priority 60   editor      ─── Content management
Priority 40   blogger     ─── Content creator (self-service)
Priority 20   company     ─── Partner representative (read-only)
Priority 10   user        ─── Basic authenticated user
```

### Multi-Role Combinations

| Combination | Use Case |
|-------------|----------|
| `editor + blogger` | Content manager who also creates content |
| `admin + editor` | Admin who manages content directly |
| `company + editor` | Partner rep who also manages their own content |
| `super_admin + admin` | Redundant but allowed (highest priority wins) |

### Role Assignment Rules

- Each user has at least one role (minimum: `user`)
- The `user` role is assigned automatically via the `handle_new_user()` trigger
- Additional roles are assigned by `super_admin` via `user_roles`
- `auth_role()` returns the highest-priority role for backward compatibility
- `auth_roles()` returns all roles for granular permission checks

---

## 3. Permission Matrix

### Convention: `resource.action`

All 71 permission codes use dot notation.

### Auth & Profile

| Code | super_admin | admin | editor | blogger | company | user |
|------|:-----------:|:-----:|:------:|:-------:|:-------:|:----:|
| `auth.login` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `auth.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `profiles.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `profiles.update` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `profiles.manage` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `profiles.roles` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

### Bloggers

| Code | super_admin | admin | editor | blogger | company | user |
|------|:-----------:|:-----:|:------:|:-------:|:-------:|:----:|
| `bloggers.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bloggers.create` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `bloggers.update` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `bloggers.delete` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `bloggers.status` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### Partners

| Code | super_admin | admin | editor | blogger | company | user |
|------|:-----------:|:-----:|:------:|:-------:|:-------:|:----:|
| `partners.read` | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| `partners.create` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `partners.update` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `partners.delete` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `partners.tasks` | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| `partners.clients` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### News

| Code | super_admin | admin | editor | blogger | company | user |
|------|:-----------:|:-----:|:------:|:-------:|:-------:|:----:|
| `news.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `news.create` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `news.update` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `news.delete` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `news.publish` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `news.archive` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

### Stats & Analytics

| Code | super_admin | admin | editor | blogger | company | user |
|------|:-----------:|:-----:|:------:|:-------:|:-------:|:----:|
| `stats.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `stats.update` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `analytics.read` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `analytics.export` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### Socials & Videos (Blogger Self-Service)

| Code | super_admin | admin | editor | blogger | company | user |
|------|:-----------:|:-----:|:------:|:-------:|:-------:|:----:|
| `socials.create` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| `socials.delete` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| `videos.create` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| `videos.delete` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |

### Media & Storage

| Code | super_admin | admin | editor | blogger | company | user |
|------|:-----------:|:-----:|:------:|:-------:|:-------:|:----:|
| `media.upload` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `media.delete` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `media.process` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `storage.buckets` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `storage.files` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### Settings & Feature Flags

| Code | super_admin | admin | editor | blogger | company | user |
|------|:-----------:|:-----:|:------:|:-------:|:-------:|:----:|
| `settings.read` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `settings.update` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `settings.manage` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `feature-flags.read` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `feature-flags.manage` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### System & Admin

| Code | super_admin | admin | editor | blogger | company | user |
|------|:-----------:|:-----:|:------:|:-------:|:-------:|:----:|
| `users.manage` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `roles.manage` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `permissions.manage` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `audit.read` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `system.config` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `system.backup` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `system.health` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### Infrastructure (AI, Workers, Queue, etc.)

| Code | super_admin | admin | editor | blogger | company | user |
|------|:-----------:|:-----:|:------:|:-------:|:-------:|:----:|
| `ai.trigger` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `ai.manage` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `ai.config` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `workers.restart` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `workers.logs` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `queue.view` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `queue.retry` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `queue.purge` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `queue.manage` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `monitoring.view` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `monitoring.alerts` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `social.publish` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `social.manage` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `cron.manage` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `cron.logs` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `functions.deploy` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `functions.logs` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `deployment.manage` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `deployment.rollback` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `notifications.manage` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `notifications.send` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

---

## 4. Identity Flow

### 4.1 User Registration (via Admin)

```
Admin creates user in Supabase Auth
    │
    ▼
Auth trigger: trg_profiles_after_auth_insert
    │
    ├── Creates profiles row (id, email, name, status='active')
    └── Inserts user_roles (profile_id, role_id='user')
    │
    ▼
Admin assigns additional roles via user_roles
    │
    ▼
User logs in → auth_role() returns highest-priority role
```

### 4.2 Authentication Flow

```
Login (auth-login Edge Function)
    │
    ├── 1. Validate email/password via Supabase Auth
    ├── 2. Fetch profiles + user_roles + roles
    ├── 3. Return JWT + user data (with primary role)
    │
    ▼
Frontend stores token
    │
    ▼
Subsequent API calls
    │
    ├── Edge Function: verifyAuth() → checks JWT → auth_role()
    └── Database: RLS → auth_role() checks in policies
```

### 4.3 Permission Check Flow

```
Edge Function receives request
    │
    ├── 1. Extract JWT from Authorization header
    ├── 2. Supabase Admin: auth.getUser(token)
    ├── 3. Fetch profile (SECURITY DEFINER bypasses RLS)
    ├── 4. Check auth_role() for role-based access
    ├── 5. Check role_permissions for action-level access
    │
    ▼
Database query
    │
    ├── RLS policy checks apply automatically
    └── Only permitted rows are returned
```

### 4.4 Email Sync Flow

```
User changes email in Supabase Auth
    │
    ▼
Trigger: trg_profiles_sync_email
    │
    ├── Detects email change (OLD.email IS DISTINCT FROM NEW.email)
    └── Updates profiles.email WHERE id = NEW.id AND deleted_at IS NULL
```

---

## 5. RLS Policy Summary

### Roles
- **SELECT**: Public (non-deleted)
- **INSERT/UPDATE/DELETE**: `super_admin` only

### Permissions
- **SELECT**: Public (non-deleted)
- **INSERT/UPDATE/DELETE**: `super_admin` only

### role_permissions
- **SELECT**: Public
- **INSERT/UPDATE/DELETE**: `super_admin` only

### user_roles
- **SELECT**: Own profile (`profile_id = auth.uid()`) or `super_admin`
- **INSERT/UPDATE/DELETE**: `super_admin` only

### profiles
- **SELECT**: Public (active bloggers) + own + `super_admin` (all)
- **INSERT**: `super_admin` only (auth trigger bypasses via SECURITY DEFINER)
- **UPDATE**: Self (non-sensitive fields only) + `super_admin` (all)
- **DELETE**: Not allowed at RLS (soft-delete via UPDATE)

---

## 6. Profiles Table Field Reference

| Field | Source of Truth | Reason | Status |
|-------|----------------|--------|--------|
| `id` | auth.users.id | Primary key, FK → auth.users | ✅ Stay |
| `email` | auth.users.email | Denormalized for query performance | ✅ Stay (synced via trigger) |
| `name` | profiles | Not stored in auth.users | ✅ Stay |
| `avatar` | profiles | Not stored in auth.users | ✅ Stay |
| `phone` | profiles | May duplicate auth.users.phone, but stored here for profile | ✅ Stay |
| `language` | profiles | UI language preference (not in auth.users) | ✅ Added |
| `timezone` | profiles | User timezone (not in auth.users) | ✅ Added |
| `bio` | profiles | Profile biography (not in auth.users) | ✅ Added |
| `status` | profiles | Custom status (not in auth.users) | ✅ Stay |
| `metadata` | profiles | JSONB extension point | ✅ Stay |
| `role_id` | user_roles | Replaced by user_roles table for multi-role support | ❌ Removed |
| Audit fields | profiles | created_at, updated_at, deleted_at, deleted_by, created_by, updated_by | ✅ Stay |

---

## 7. Trigger Summary

| Trigger | On | Event | Action |
|---------|-----|-------|--------|
| `trg_roles_updated_at` | roles | BEFORE UPDATE | Sets `updated_at = now()` |
| `trg_permissions_updated_at` | permissions | BEFORE UPDATE | Sets `updated_at = now()` |
| `trg_profiles_updated_at` | profiles | BEFORE UPDATE | Sets `updated_at = now()` |
| `trg_profiles_after_auth_insert` | auth.users | AFTER INSERT | Creates profile + user_roles entry |
| `trg_profiles_sync_email` | auth.users | AFTER UPDATE OF email | Syncs profiles.email when auth email changes |

### Safety Guarantees

- No duplicate profile creation: `id` is PK with FK → `auth.users(id)` with ON DELETE CASCADE
- Safe role assignment: `handle_new_user()` inserts the `user` role; no trigger conflicts
- Safe soft delete: `soft_delete()` function exists but is not bound to a trigger by default; Edge Functions call it explicitly

---

## 8. Index Strategy

| Index | Table | Type | Purpose |
|-------|-------|------|---------|
| `idx_roles_name` | roles | **UNIQUE** partial `WHERE deleted_at IS NULL` | Enforce unique active role names |
| `idx_roles_priority` | roles | btree | Order roles by priority |
| `idx_roles_deleted_at` | roles | btree | Filter soft-deleted roles |
| `idx_permissions_code` | permissions | **UNIQUE** partial `WHERE deleted_at IS NULL` | Enforce unique active permission codes |
| `idx_permissions_resource` | permissions | btree | Filter permissions by resource |
| `idx_permissions_action` | permissions | btree | Filter permissions by action |
| `idx_permissions_deleted_at` | permissions | btree | Filter soft-deleted permissions |
| `idx_role_permissions_unique` | role_permissions | **UNIQUE** `(role_id, permission_id)` | Prevent duplicate assignments |
| `idx_role_permissions_role_id` | role_permissions | btree | Fast role→permissions lookup |
| `idx_role_permissions_permission_id` | role_permissions | btree | Fast permission→roles lookup |
| `idx_user_roles_unique` | user_roles | **UNIQUE** `(profile_id, role_id)` | Prevent duplicate role assignments |
| `idx_user_roles_profile_id` | user_roles | btree | Fast user→roles lookup |
| `idx_user_roles_role_id` | user_roles | btree | Fast role→users lookup |
| `idx_profiles_email` | profiles | **UNIQUE** partial `WHERE deleted_at IS NULL` | Enforce unique active emails |
| `idx_profiles_status` | profiles | btree | Filter profiles by status |
| `idx_profiles_deleted_at` | profiles | btree | Filter soft-deleted profiles |
| `idx_profiles_language` | profiles | btree | Filter/sort by language preference |
| `idx_profiles_created_by` | profiles | btree | Audit trail lookups |

---

## 9. Constraint Summary

| Constraint | Table | Type | Behavior |
|------------|-------|------|----------|
| `profiles.id → auth.users.id` | profiles | FK | ON DELETE CASCADE |
| `profiles.deleted_by → profiles.id` | profiles | FK | ON DELETE SET NULL |
| `profiles.created_by → profiles.id` | profiles | FK | ON DELETE SET NULL |
| `profiles.updated_by → profiles.id` | profiles | FK | ON DELETE SET NULL |
| `user_roles.profile_id → profiles.id` | user_roles | FK | ON DELETE CASCADE |
| `user_roles.role_id → roles.id` | user_roles | FK | ON DELETE CASCADE |
| `role_permissions.role_id → roles.id` | role_permissions | FK | ON DELETE CASCADE |
| `role_permissions.permission_id → permissions.id` | role_permissions | FK | ON DELETE CASCADE |
| `chk_profiles_status` | profiles | CHECK | status IN ('active','inactive','pending','banned') |
| `idx_roles_name` | roles | UNIQUE (partial) | name unique where deleted_at IS NULL |
| `idx_permissions_code` | permissions | UNIQUE (partial) | code unique where deleted_at IS NULL |
| `idx_profiles_email` | profiles | UNIQUE (partial) | email unique where deleted_at IS NULL |
| `idx_user_roles_unique` | user_roles | UNIQUE | (profile_id, role_id) unique |
| `idx_role_permissions_unique` | role_permissions | UNIQUE | (role_id, permission_id) unique |

---

## 10. Audit Trail

| Field | Table | Purpose |
|-------|-------|---------|
| `created_at` | All | Row creation timestamp |
| `updated_at` | roles, permissions, profiles | Last update timestamp (auto-updated) |
| `deleted_at` | roles, permissions, profiles | Soft-delete timestamp |
| `deleted_by` | profiles | Who soft-deleted the row |
| `created_by` | profiles | Who created the row |
| `updated_by` | profiles | Who last updated the row |

---

## 11. Migration Risks & Backward Compatibility

### Breaking Changes from Phase 1.1

| Change | Risk | Mitigation |
|--------|------|------------|
| `profiles.role_id` removed | Any existing Edge Functions referencing this column will fail | Update all Edge Functions to use `user_roles` instead |
| Permission codes renamed (`:` → `.`) | Any hardcoded permission strings will not match | Update Edge Functions and frontend to use new format |
| `auth_role()` now uses `user_roles` | If called before `user_roles` data exists, returns NULL | Migration ensures all profiles have at least the `user` role |
| New tables (`user_roles`) | Additional FK constraints | No risk — tables are created in the same migration |

### Deployment Order

1. Apply this migration (creates all tables, drops `profiles.role_id`)
2. Deploy updated Edge Functions (updated `permissions.ts` shared module)
3. Verify `auth_role()` returns correct role for existing users
4. Assign additional roles via `user_roles` as needed

---

## 12. Future Expansion Strategy

| Feature | Approach | Phase |
|---------|----------|-------|
| Custom roles | Allow `is_system = false` in roles table; non-system roles manageable via API | Post-MVP |
| Permission groups | Group related permissions into sets (e.g., `content:write` = news.create + news.update + news.publish) | Post-MVP |
| API keys | New `api_keys` table linked to profiles with permission scoping | Post-MVP |
| Session management | Track active sessions; allow admin to revoke | Post-MVP |
| 2FA | Supabase Auth supports MFA natively — configure via dashboard | Production |
| Audit log for role changes | New `audit_log` table tracking all user_roles changes | Phase 12 |
| Role delegation | Allow admins to temporarily grant roles to other users | Post-MVP |
| LDAP/SSO integration | Supabase Auth supports SAML/OIDC — enterprise plan | Post-MVP |
