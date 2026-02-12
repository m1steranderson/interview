# Task Manager

Minimal production-minded system: SSR web app (Hono + Cloudflare Workers) + background microservice (NestJS 11 + Bun) + NATS core + Cloudflare KV.

## Architecture

```
                          NATS (core pub/sub)
                          ┌────────────────┐
   nats pub               │  tasks.created │
   ─────────────────────► │  tasks.updated │
                          │  tasks.deleted │
                          └───────┬────────┘
                                  │ subscribe
                                  ▼
                       ┌──────────────────────┐
                       │   Microservice       │
                       │   (NestJS + Bun)     │
                       │                      │
                       │ Controller → CQRS    │
                       │ CommandBus → Handler │
                       │ Saga (retry/backoff) │
                       └──────┬──────┬────────┘
                              │      │
              CF REST API v4  │      │ POST /api/cache/purge (HMAC)
              (KV write)      │      │
                              ▼      ▼
               ┌──────────┐     ┌────────────────────┐
               │          │     │   Web Worker (Hono)│
               │ CF KV    │◄────│  SSR read-only     │
               │          │ RPC │                    │
               └──────────┘     │  GET /             │
                    ▲           │  GET /tasks/:id    │
                    │           │  GET /api/tasks    │
                    │           │  GET /api/tasks/:id│
                    │           │  POST /api/cache/  │
               ┌────┴────┐      │      purge (HMAC)  │
               │ KV Svc  │◄─────└────────────────────┘
               │ Worker  │ Service Binding (RPC)
               └─────────┘
```

### Data Flow

1. **Create**: `nats pub tasks.created '{"id":"...","title":"..."}'` → Microservice subscribes → `CreateTaskHandler` builds `TaskEntity` → `KvTaskRepository.save()` writes to CF KV via REST API → `CachePurgeService` invalidates web cache
2. **Update**: `nats pub tasks.updated '{"id":"...","title":"New"}'` → `UpdateTaskHandler` fetches existing task from KV → merges fields → saves back → purges cache
3. **Delete**: `nats pub tasks.deleted '{"id":"..."}'` → `DeleteTaskHandler` deletes KV key → purges cache
4. **Read**: Browser → `GET /` or `/tasks/:id` → Web Worker → Service Binding RPC to KV Service Worker → reads from CF KV → SSR renders HTML

### NATS Subjects

| Subject | Payload | Action |
|---|---|---|
| `tasks.created` | `{ id, title, description?, status?, correlationId }` | PUT new task to KV |
| `tasks.updated` | `{ id, title?, description?, status?, correlationId }` | GET + merge + PUT |
| `tasks.deleted` | `{ id, correlationId }` | DELETE from KV |

### Retry / Backoff

KV write failures trigger a CQRS Saga that retries with backoff: **1s → 3s → 10s → 20s → 30s** (max 5 attempts). Each attempt is logged with `X-Correlation-Id`.

```
CommandHandler fails → KvWriteFailedEvent → Saga → timer(delay) → re-dispatch with attempt+1
```

### Observability

`X-Correlation-Id` propagated across the entire pipeline:
- **Web Worker**: correlation middleware generates/reads header, logs `[cid] → METHOD /path` and `[cid] ← STATUS (ms)`
- **KV Service (RPC)**: receives correlationId as parameter from web worker, logs `[cid] RPC getTask/listTasks`
- **KV Service (HTTP)**: reads `X-Correlation-Id` header, logs `[cid] GET /tasks/... → STATUS`
- **Cache middleware**: logs HIT/MISS/PUT with correlation ID
- **Microservice**: NATS payload carries `correlationId`, logged at every handler, retry attempt, and KV verification
- **Cache purge**: correlation ID forwarded in header from microservice → web worker
- **KV verification**: correlation ID forwarded in header from microservice → kv-service

#### Tracing a request end-to-end

```
# 1. Publish a NATS message with explicit correlationId
nats pub tasks.created '{"id":"t-1","title":"Test","correlationId":"trace-42"}'

# 2. Watch logs across all three services — filter by the same ID:

# Microservice (NestJS):
#   [trace-42] CREATE task=t-1 attempt=1
#   [trace-42] KV PUT task:t-1 — OK
#   [trace-42] KV verify GET /tasks/t-1 → 200        ← read-back verification
#   [trace-42] create succeeded → purging cache

# KV Service (wrangler):
#   [trace-42] GET /tasks/t-1 → 200                  ← HMAC-verified HTTP

# Web Worker (wrangler):
#   [trace-42] Cache purged: .../tasks/t-1, .../
```

Tracing a browser read:

```
# Pass a custom correlation ID via header:
curl -H 'X-Correlation-Id: my-trace' http://localhost:8787/api/tasks/t-1

# Web Worker log:
#   [my-trace] → GET /api/tasks/t-1
#   [my-trace] GET /api/tasks/t-1 — found

# KV Service log:
#   [my-trace] RPC getTask(t-1) → found               ← via Service Binding
```

### Security

- KV Service HTTP endpoints and web cache purge endpoint are protected by HMAC-SHA256 signatures with 5-second TTL
- HMAC signing (`signHmac`) and verification (`verifyHmac`) both live in the `shared` package (Web Crypto API — works in Workers, Node 18+, Bun)
- Secrets managed via `wrangler secret put` (production) and `.dev.vars` (local)

## Mono-repo Structure

```
packages/
├── shared/          # Types, constants, HMAC verification
├── web/             # Hono SSR web app (CF Worker)
├── kv-service/      # KV read service (CF Worker, Service Binding)
└── microservice/    # NestJS + Bun + NATS consumer
```

## Prerequisites

- [Bun](https://bun.sh) (v1.3+)
- [Docker](https://www.docker.com) & Docker Compose
- [Cloudflare account](https://dash.cloudflare.com) with:
  - API Token (KV edit permissions)
  - KV Namespace created
- [NATS CLI](https://github.com/nats-io/natscli) (optional, for `nats pub`)

## Local Development

### 1. Install dependencies

```bash
bun install
```

### 2. Configure secrets

Create `.dev.vars` in each worker package:

```bash
# packages/web/.dev.vars
# packages/kv-service/.dev.vars
KV_SECRET=your-secret-here
```

Create `.dev.vars` for microservice:

```bash
# packages/microservice/.dev.vars
CF_ACCOUNT_ID=your_account_id
CF_API_TOKEN=your_api_token
CF_NAMESPACE_ID=your_kv_namespace_id
KV_SECRET=your-secret-here
NATS_URL=nats://localhost:4222
WEB_APP_URL=http://localhost:8787
```

### 3. Start workers (use `--remote` for real KV access)

In separate terminals:

```bash
# Terminal 1: KV Service Worker
bun run dev:kv

# Terminal 2: Web Worker
bun run dev:web
```

### 4. Start NATS + Microservice via Docker

```bash
# Create .env for Docker
cp packages/microservice/.dev.vars packages/microservice/.env
# Edit .env: set WEB_APP_URL=http://host.docker.internal:8787

bun run docker:up
```

### 5. Publish events

```bash
# Create
nats pub tasks.created '{"id":"task-001","title":"Buy milk","description":"2% milk"}'

# Update
nats pub tasks.updated '{"id":"task-001","title":"Buy oat milk","status":"in_progress"}'

# Delete
nats pub tasks.deleted '{"id":"task-001"}'
```

### 6. View results

- Task list: http://localhost:8787/
- Task detail: http://localhost:8787/tasks/task-001
- JSON API: http://localhost:8787/api/tasks

## Deploy to Cloudflare

### 1. Create KV namespace

```bash
npx wrangler kv namespace create TASKS_KV
```

Update `packages/kv-service/wrangler.toml` with the returned namespace ID.

### 2. Set secrets

```bash
cd packages/kv-service && npx wrangler secret put KV_SECRET
cd packages/web && npx wrangler secret put KV_SECRET
```

### 3. Deploy workers

```bash
bun run deploy
```

### 4. Deploy microservice

The microservice runs as a Docker container. Set environment variables (`CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_NAMESPACE_ID`, `NATS_URL`, `KV_SECRET`, `WEB_APP_URL`) and run:

```bash
docker compose up --build
```

## Tests

```bash
bun run test
```

Runs:
- **Microservice** (Jest): retry/backoff saga, TaskEntity domain logic
- **Shared** (Bun): HMAC-SHA256 signature verification
