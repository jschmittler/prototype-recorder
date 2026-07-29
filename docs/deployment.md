# Deployment

Prototype Walkthrough is a **web (BFF)** + **worker** system backed by Postgres,
Redis (BullMQ), and S3-compatible storage. Adapters are selected by env, so the
same code runs locally on in-memory adapters or in production on the real stack.

## Services

| Service | What it does | Notes |
|---|---|---|
| **web** | Next.js UI + API/BFF. Creates jobs, enqueues, serves SSE + downloads. | Stateless; scale horizontally behind a proxy. |
| **worker** | Consumes the BullMQ queue and runs the recording pipeline. | Needs CPU/RAM for Chromium; writable `/tmp`; FFmpeg. Scale by replicas / `MAX_CONCURRENT_JOBS`. |
| **postgres** | Job store. | `DATABASE_URL`. |
| **redis** | BullMQ queue. | `REDIS_URL`. |
| **S3 / MinIO** | Private artifact storage; time-limited signed downloads. | `S3_*`. |

## Environment (see `.env.example`)

Production selects the real adapters:

```
JOB_STORE=postgres   QUEUE_DRIVER=redis   STORAGE_DRIVER=s3
DATABASE_URL=...     REDIS_URL=...         S3_ENDPOINT/REGION/BUCKET/keys...
AI_PROVIDER=anthropic  ANTHROPIC_API_KEY=...   # or fake
EXECUTOR=local-process ENGINE_DIR=/path/to/figma-walkthrough   # or fake
MAX_CONCURRENT_JOBS=2  JOB_RETENTION_HOURS=72  URL_ALLOWLIST=
```

Keep `ANTHROPIC_API_KEY` and S3 credentials in a secrets manager — never in the
image or client.

## Local full stack (Docker Compose)

```bash
docker compose up --build         # postgres + redis + minio + migrate + web + worker
# open http://localhost:3000  (MinIO console: http://localhost:9001)
```

The `migrate` one-shot runs `prisma db push` to create the schema before web/worker
start. The stack defaults to the **fake** recorder + AI so it runs with no engine
or key; flip `AI_PROVIDER`/`EXECUTOR` (and provide the key / engine) for real output.

## Database

- Local: `prisma db push` (no migration history) via the `migrate` service, or
  `npm run db:push`.
- Production: generate migrations with `prisma migrate dev` in development, commit
  them, and run `prisma migrate deploy` (`npm run db:migrate -w @ptw/core`) on release.

## Real recording in the worker

The worker shells out to the figma-walkthrough engine (its own Chromium/FFmpeg).
For real recordings in a container, add the engine to the worker image (clone +
`npm ci` + `npx playwright install chromium`) and set `EXECUTOR=local-process` +
`ENGINE_DIR`. A container-per-job execution adapter is the recommended hardening
step (the `WalkthroughExecutor` interface already allows swapping it in).

## Production notes

- Do **not** run the recorder on serverless/edge — it needs a long-running worker
  with Chromium, memory, and writable temp storage.
- Put the SSE endpoint behind a proxy configured for streaming (disable buffering).
- Private buckets only; downloads via signed URLs with a short TTL (`S3_SIGNED_TTL`).
- Add retention/cleanup (delete artifacts + rows past `JOB_RETENTION_HOURS`) as a
  scheduled task — interface hooks are in place; the cron job is a follow-up.
