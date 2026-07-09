# Queue System Architecture

Background job processing system using Supabase pg_net and database-backed queues.

### Queue Types
| Queue | Purpose | Consumers | Phase |
|-------|---------|-----------|-------|
| ai | AI news generation jobs | ai-news worker | 4 |
| social | Social media automation jobs | social worker | 7 |
| email | Email notification jobs | notification worker | 11 |
| media | Media processing jobs | media worker | 6 |
| retry | Failed job retries | scheduler worker | 8 |
| dead-letter | Unprocessable jobs | admin review | 8 |

### Architecture
- Database-backed queue tables
- pg_net for HTTP-based job dispatch
- Edge Functions as queue consumers
- Retry policy with exponential backoff
- Dead-letter after max retries

### Job Lifecycle
1. enqueue → pending
2. dequeue → processing
3. success → completed
4. failure → retry/dead-letter

### Future Implementation Phase: 8
