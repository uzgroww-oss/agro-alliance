# Backend Architecture

## Overview

The Agro Alliance backend uses Supabase as the core platform with Edge Functions for serverless compute, Cloudflare R2 for media storage, and Cloudflare AI Workers for AI-powered features.

## Architecture Diagram

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│  Supabase Auth   │────▶│  PostgreSQL DB  │
│  (Vite/React)│     │  (JWT, RLS)      │     │  (public schema)│
└──────┬───────┘     └──────────────────┘     └────────┬────────┘
       │                                               │
       ▼                                               ▼
┌──────────────┐                              ┌─────────────────┐
│ Edge Functions│◀─────────────────────────────│  pg_net Queue   │
│ (API Layer)  │                              │  (async jobs)   │
└──────┬───────┘                              └────────┬────────┘
       │                                               │
       ▼                                               ▼
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Cloudflare R2│     │  AI Workers      │     │  Background     │
│ (Media Store)│     │  (News Gen)      │     │  Workers        │
└──────────────┘     └──────────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │  External APIs   │
                    │  YouTube,        │
                    │  Telegram,       │
                    │  Social Platforms│
                    └──────────────────┘
```

## Layers

### 1. API Layer (Edge Functions)
- 34 Edge Functions mapped to API contracts
- Every function: CORS → Auth → Parse → Validate → Execute → Respond
- Shared libraries for cross-cutting concerns
- Organized by domain (auth, public, admin, me)

### 2. Database Layer (PostgreSQL)
- Public schema with tables for all entities
- Row Level Security (RLS) for data access control
- Migrations managed via Supabase CLI
- Seed data for initial state

### 3. Storage Layer (Cloudflare R2)
- Public bucket: images, thumbnails, static assets
- Private bucket: documents, reports
- Signed URLs for temporary access
- CDN delivery via Cloudflare

### 4. Compute Layer (AI Workers)
- Cloudflare Workers for AI processing
- News generation from agro data
- Content summarization and translation
- Trend analysis

### 5. Queue Layer
- Database-backed job queue
- pg_net for HTTP dispatch
- Retry and dead-letter handling
- Background worker consumption

### 6. Integration Layer
- YouTube Data API for video sync
- Telegram Bot API for notifications
- Social platform APIs for automation
- OAuth providers (Google)

## Data Flow

### Request Flow
```
Client → Supabase Auth (JWT) → Edge Function → Validate → DB Query → Response
                                                     │
                                          ┌──────────▼──────────┐
                                          │ Storage (R2) / Cache│
                                          └─────────────────────┘
```

### Background Job Flow
```
Edge Function → enqueue → Queue → Worker → Process → DB Update
                                         │
                              ┌──────────▼──────────┐
                              │ External API / AI    │
                              └─────────────────────┘
```

## Security Model

- JWT-based authentication via Supabase Auth
- Row Level Security on all tables
- Role-based permissions (superadmin, blogger, client)
- CORS restricted to frontend origin
- Input sanitization on all endpoints
- Rate limiting on auth and public endpoints

## Error Handling

- Typed error classes (`AppError`, `ValidationError`, `NotFoundError`)
- Consistent error response format
- Structured JSON logging
- Error tracking via logger

## Scalability

- Edge Functions scale horizontally (Supabase managed)
- Database connection pooling (Supabase managed)
- R2 CDN for static/media content
- Queue system for async processing
- Caching layer for frequently accessed data
