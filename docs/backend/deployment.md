# Deployment Guide

## Prerequisites

1. Supabase CLI v2.109+
2. Supabase project (production)
3. Cloudflare R2 bucket configured
4. AI Worker deployed
5. All environment variables set

## Steps

### 1. Link Project
```bash
supabase link --project-ref <project-ref>
```

### 2. Deploy Database Migrations (Phase 1+)
```bash
supabase db push
```

### 3. Deploy Edge Functions
```bash
# Deploy all functions
supabase functions deploy --project-ref <project-ref>

# Or deploy individually
supabase functions deploy auth-login --project-ref <project-ref>
supabase functions deploy public-stats --project-ref <project-ref>
```

### 4. Apply Seed Data
```bash
supabase db execute --file supabase/seed.sql
```

### 5. Configure Cron Jobs
Cron schedules are defined in `supabase/config.toml`:
```toml
[functions.cron_jobs]
"ai-news-sync" = "0 */6 * * *"
"social-stats" = "0 0 * * *"
"analytics-agg" = "0 * * * *"
"db-cleanup" = "0 3 * * 0"
```

### 6. Configure Auth Settings
- Enabled providers: email
- JWT expiry: 86400s (24h)
- Public signup: disabled
- Redirect URLs: configured in `config.toml`

## Environment Variables

| Variable | Source | Required |
|----------|--------|----------|
| SUPABASE_URL | Supabase Dashboard | ✓ |
| SUPABASE_ANON_KEY | Supabase Dashboard | ✓ |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Dashboard | ✓ |
| R2_ENDPOINT | Cloudflare R2 | ✓ |
| R2_ACCESS_KEY_ID | Cloudflare R2 | ✓ |
| R2_SECRET_ACCESS_KEY | Cloudflare R2 | ✓ |
| R2_PUBLIC_BUCKET | Cloudflare R2 | ✓ |
| R2_PRIVATE_BUCKET | Cloudflare R2 | ✓ |
| R2_PUBLIC_URL | Cloudflare R2 | ✓ |
| AI_WORKER_URL | AI Worker | ✓ |
| AI_WORKER_API_KEY | AI Worker | ✓ |
| YOUTUBE_API_KEY | Google Cloud | ✓ |
| YOUTUBE_CHANNEL_ID | YouTube | ✓ |
| TELEGRAM_BOT_TOKEN | BotFather | ✓ |
| TELEGRAM_CHAT_ID | Telegram | ✓ |
| GOOGLE_CLIENT_ID | Google Cloud | ✓ |
| GOOGLE_CLIENT_SECRET | Google Cloud | ✓ |
| VITE_API_URL | Custom | ✓ |

## CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
      - run: supabase db push
      - run: supabase functions deploy
      - run: supabase db execute --file supabase/seed.sql
```

## Branch Deployments

| Branch | Supabase Branch | Environment |
|--------|----------------|-------------|
| main | main | production |
| dev | dev | staging |
| feature/* | preview | development |

**Phase: 13 (Production Readiness)**
