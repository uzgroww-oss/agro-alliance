# Shared Libraries

The `_shared/` directory under `supabase/functions/_shared/` contains reusable infrastructure modules shared by all Edge Functions.

## Module Index

| Module | Purpose | Phase Implemented | Dependencies |
|--------|---------|-------------------|--------------|
| auth.ts | JWT verification, role-based authorization | 0 | supabase.ts, response.ts |
| cache.ts | In-memory caching abstraction | 0 (placeholder) | constants.ts |
| config.ts | Environment variable loader | 0 | none |
| constants.ts | App-wide constants and enums | 0 | none |
| cors.ts | CORS headers and preflight handler | 0 | none |
| environment.ts | Environment detection | 0 | none |
| errors.ts | Typed error classes | 0 | none |
| feature-flags.ts | Feature flag toggling | 0 | none |
| helpers.ts | General-purpose utility functions | 0 | none |
| logger.ts | Structured JSON logging | 0 | none |
| pagination.ts | URL param parsing and pagination meta | 0 | constants.ts |
| permissions.ts | Role-based permission checking | 0 | auth.ts |
| queue.ts | Queue job abstraction | 0 (placeholder) | none |
| response.ts | Standardized HTTP responses | 0 | cors.ts |
| search.ts | Full-text search query building | 0 (placeholder) | none |
| security.ts | Input sanitization and rate limiting | 0 | none |
| storage.ts | File storage abstraction | 0 (placeholder) | none |
| supabase.ts | Supabase admin client singleton | 0 | supabase-js |
| time.ts | Date/time formatting utilities | 0 | none |
| types.ts | Shared TypeScript interfaces | 0 | none |
| validation.ts | Input validation functions | 0 | none |

## Usage

```ts
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { verifyAuth, requireRole } from "../_shared/auth.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import { logger } from "../_shared/logger.ts"
import { AppError } from "../_shared/errors.ts"
import { loadConfig } from "../_shared/config.ts"
import { isFeatureEnabled } from "../_shared/feature-flags.ts"
import { hasPermission } from "../_shared/permissions.ts"
```

## Module Dependencies

```
auth.ts         → supabase.ts, response.ts
response.ts     → cors.ts
pagination.ts   → constants.ts
permissions.ts  → auth.ts
```

All other modules are dependency-free or depend only on Deno built-ins.

## Implementation Status

- **Phase 0:** All modules created as skeletons
- **Phases 2-12:** Individual modules get real implementations as features are built
- **Phase 5:** cache.ts, search.ts get real impl
- **Phase 6:** storage.ts gets real impl
- **Phase 8:** queue.ts gets real impl
