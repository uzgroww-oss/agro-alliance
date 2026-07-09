# Backend Folder Structure

```
supabase/
├── functions/              # Supabase Edge Functions
│   ├── _shared/            # Shared infrastructure libraries
│   ├── auth/               # Auth domain group (docs)
│   ├── public/             # Public API domain groups (docs)
│   │   ├── bloggers/
│   │   ├── companies/
│   │   └── news/
│   ├── media/              # Media domain group (docs)
│   ├── notifications/      # Notification domain group (docs)
│   ├── analytics/          # Analytics domain group (docs)
│   ├── settings/           # Settings domain group (docs)
│   ├── social/             # Social domain group (docs)
│   ├── ai/                 # AI domain group (docs)
│   ├── workers/            # Worker function group (docs)
│   ├── cron/               # Cron job group (docs)
│   ├── queue/              # Queue function group (docs)
│   ├── system/             # System function group (docs)
│   ├── health/             # Health check function group (docs)
│   ├── auth-login/         # Edge Function: login
│   ├── auth-me/            # Edge Function: me
│   ├── public-bloggers-list/
│   ├── public-bloggers-profile/
│   ├── public-news-list/
│   ├── public-news-detail/
│   ├── public-news-popular/
│   ├── public-news-related/
│   ├── public-partners/
│   ├── public-stats/
│   ├── admin-bloggers-create/
│   ├── admin-bloggers-delete/
│   ├── admin-bloggers-list/
│   ├── admin-bloggers-status/
│   ├── admin-partners-create/
│   ├── admin-partners-delete/
│   ├── admin-partners-list/
│   ├── admin-partners-client-create/
│   ├── admin-partners-client-delete/
│   ├── admin-partners-tasks-add/
│   ├── admin-partners-tasks-cycle/
│   ├── admin-partners-tasks-delete/
│   ├── admin-stats-get/
│   ├── admin-stats-update/
│   ├── me-profile/
│   ├── me-profile-update/
│   ├── me-partner/
│   ├── me-socials-add/
│   ├── me-socials-delete/
│   ├── me-videos-add/
│   ├── me-videos-delete/
│   ├── contact-submit/
│   ├── newsletter-subscribe/
│   └── newsletter-unsubscribe/
├── workers/                # Worker architecture (docs)
│   ├── ai-news/
│   ├── social/
│   ├── analytics/
│   ├── notifications/
│   ├── cleanup/
│   ├── scheduler/
│   └── media/
├── queues/                 # Queue architecture (docs)
│   ├── ai/
│   ├── social/
│   ├── email/
│   ├── media/
│   ├── retry/
│   └── dead-letter/
├── health/                 # Monitoring architecture (docs)
│   ├── system/
│   ├── workers/
│   ├── queues/
│   └── storage/
├── config.toml             # Supabase project config
├── seed.sql                # Seed data placeholder
└── .gitignore              # Supabase gitignore

docs/backend/               # Backend architecture docs
    ├── folders.md          # This file
    ├── workers.md          # Worker system docs
    ├── queues.md           # Queue system docs
    ├── shared.md           # Shared library docs
    ├── deployment.md       # Deployment guide
    └── architecture.md     # Overall architecture
```

### Convention
- Edge Functions are flat under `functions/` (Supabase requirement)
- Domain group directories under `functions/` contain only README.md documentation
- Worker, Queue, and Health systems are siblings to `functions/`
- All documentation is markdown with no executable code
