# Environment Setup Runbook

## Prerequisites

- [Bun](https://bun.sh/) installed
- [Cloudflare](https://dash.cloudflare.com/) account
- Docker (for NATS + microservice)

```bash
bun install
```

---

## 1. Create KV Namespace (required)

```bash
npx wrangler kv namespace create TASKS_KV
# → note the id

npx wrangler kv namespace create TASKS_KV --preview
# → note the preview_id
```

Paste both IDs into `packages/kv-service/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "TASKS_KV"
id = "<your id>"
preview_id = "<your preview_id>"
```

The same production `id` is used as `CF_NAMESPACE_ID` in the microservice `.env` (step 4).

---

## 2. Fill in .dev.vars (local worker secrets)

Wrangler auto-loads `.dev.vars` during `wrangler dev`. Create two identical files:

**`packages/web/.dev.vars`**

```
KV_SECRET=your-shared-hmac-secret
```

**`packages/kv-service/.dev.vars`**

```
KV_SECRET=your-shared-hmac-secret
```

> `KV_SECRET` must be the **same value** in all three packages (web, kv-service, microservice).

---

## 3. Deploy kv-service (required before running web)

The web worker calls kv-service via a Service Binding (RPC). The binding resolves by **deployed worker name**, so kv-service must be deployed at least once — even for local `dev:web --remote`.

```bash
bun run deploy:kv
```

---

## 4. Fill in microservice .env (for Docker)

```bash
cp packages/microservice/.env.example packages/microservice/.env
```

Edit **`packages/microservice/.env`**:

```
CF_ACCOUNT_ID=<your Cloudflare Account ID>
CF_API_TOKEN=<your API token with Edit KV permissions>
CF_NAMESPACE_ID=<namespace id from step 1>
NATS_URL=nats://localhost:4222
KV_SECRET=your-shared-hmac-secret
WEB_APP_URL=http://host.docker.internal:8787
```

To create the API token: Cloudflare Dashboard → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers KV Storage**.

For local dev without Docker, create **`packages/microservice/.dev.vars`** with the same `KV_SECRET` value (used by `bun run dev:microservice`).

---

## 5. Set remote secrets (for deployed workers)

Each worker needs `KV_SECRET` as a production secret:

```bash
cd packages/kv-service && npx wrangler secret put KV_SECRET
cd packages/web && npx wrangler secret put KV_SECRET
```

The CLI will prompt for the value interactively — enter the same shared secret.

---

## 6. Run the stack

### Option A — Docker (NATS + microservice) + local workers

```bash
# Terminal 1: kv-service on port 8786
bun run dev:kv

# Terminal 2: web on port 8787
bun run dev:web

# Terminal 3: NATS + microservice via Docker Compose
bun run docker:up
```

### Option B — Everything local (no Docker for microservice)

```bash
# Start NATS
docker run -p 4222:4222 -p 8222:8222 nats:2-alpine --http_port 8222

# Terminal 1: kv-service
bun run dev:kv

# Terminal 2: web
bun run dev:web

# Terminal 3: microservice (uses .dev.vars for KV_SECRET)
bun run dev:microservice
```

---

## 7. Verify

```bash
# NATS health
curl http://localhost:8222/healthz

# Web app
curl http://localhost:8787
curl http://localhost:8787/api/tasks?offset=1&limit=1
# Send a test NATS message and verify it reached KV
nats pub tasks.created '{"id":"test-001","title":"Hello world"}'

# More test cases
nats pub tasks.created '{"id":"test-002","title":"Buy milk"}'
nats pub tasks.created '{"id":"test-003","title":"Make sport"}'
nats pub tasks.updated '{"id":"test-001","status":"done"}'
nats pub tasks.created '{"id":"test-001","title":"Hello world with replace via PUT(drop the status, etc)"}'
nats pub tasks.updated '{"id":"test-001","status":"wrong_status"}'
nats pub tasks.created '{"id":"#?test-002","title":"wrong id"}'
nats pub tasks.deleted '{"id":"test-002"}'
```
---

## Quick Reference

| Step | What | Why |
|------|------|-----|
| KV namespace | `wrangler kv namespace create TASKS_KV` | kv-service needs a KV store to bind to |
| Deploy kv-service | `bun run deploy:kv` | Web worker's Service Binding requires a deployed worker |
| `.dev.vars` (web, kv-service) | `KV_SECRET=...` | HMAC verification between services |
| `.env` (microservice) | `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_NAMESPACE_ID`, `KV_SECRET` | Microservice talks to KV via REST API |
| Remote secrets | `wrangler secret put KV_SECRET` per worker | Production HMAC secret |
