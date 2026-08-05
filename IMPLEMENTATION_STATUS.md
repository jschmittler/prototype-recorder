# Implementation status

Running checklist for the Prototype Walkthrough build. Milestone 1 = a runnable
vertical slice on fake adapters; later milestones swap in the real engine, AI,
storage, and hardening.

Legend: ✅ done · 🟡 in progress · ⬜ not started

## Phase 1 — Foundation  (this milestone)
- ✅ Repo strategy decided + `docs/architecture.md` (ADR-001: separate repo)
- ✅ Monorepo workspaces (`packages/*`, `apps/*`), TS project config, Vitest
- ✅ `@ptw/job-contracts`: statuses, stages, settings, limits, error model, `CreateJobInput`, `PublicJob`, events, helpers (zod)
- ✅ `@ptw/engine-adapter`: `WalkthroughExecutor` interface + `FakeExecutor` (synthesizes a real short WebM via ffmpeg)
- ✅ `@ptw/script-generator`: DSL grammar, strict `validateScript`, `AIProvider` interface, `FakeAIProvider`, generate→repair pipeline
- ✅ Unit tests: validator (verbs, goto, url match, viewport, dangerous content, size, steps) + repair pipeline
- ✅ `.env.example`, `docker-compose.yml` (postgres/redis/minio), `.gitignore`
- ⬜ `@ptw/database`: `JobStore` interface + in-memory impl (moves here in P2)
- ⬜ Keep the engine CLI working (N/A — engine lives in its own repo; we depend on it)

## Phase 2 — Functional vertical slice (fake adapters)  ✅ (runnable)
- ✅ In-memory `JobStore` + in-process runner + pub/sub (apps/web/lib/jobs.ts)
- ✅ `apps/web`: Next.js App Router + Tailwind
  - ✅ Marketing/home page (hero, 3 steps, benefits, FAQ, footer links)
  - ✅ Creation page (URL + brief + basic/advanced settings, consent copy)
  - ✅ Job progress page (SSE, staged checklist, elapsed, technical details)
  - ✅ Result page (video preview, metadata, download video/script, create another)
  - ✅ Failure page (friendly category, retry, edit, details)
- ✅ API/BFF: create (idempotency), get, SSE stream, video + script download
- ✅ In-process runner drives fake inspect→generate→validate→record→"upload", emits progress
- 🟡 Separate `apps/worker` (BullMQ) — deferred to Phase 3; slice runs in-process
- ⬜ Playwright e2e web tests (deterministic fake) — next

## Phase 3 — Real engine integration  ✅
- ✅ `LocalProcessExecutor` running prototype-recorder-cli `inspect`/`record` via `spawn` (env-selected via `EXECUTOR=local-process` + `ENGINE_DIR`); real inspection report parsing; progress streaming, timeout, cancellation, scrubbed logs; verified against a live prototype (real 14s WebM)
- ⬜ Unify validator with the engine's real DSL parser (single source of truth)
- ✅ `OpenAIProvider` (server key, injectable client) + versioned prompt (`prompt.ts`, walkthrough-v1); env-selected via `AI_PROVIDER=openai`; Responses API with default model `gpt-5.6-sol`; defensive output parsing; mock-tested. Live run needs `OPENAI_API_KEY`.
- ✅ Turnkey local run: `apps/web/.env` (`EXECUTOR=local-process` + `ENGINE_DIR`) makes `npm run dev` record real prototypes with no API key; verified end-to-end via the browser flow (real 13.9s 1440x900 WebM). See `QUICKSTART.md`.
- ✅ `@ptw/core`: JobStore (memory + **Prisma/Postgres**), Queue (in-process + **BullMQ/Redis**), Storage (local + **S3/MinIO**, presigned downloads); shared pipeline; env-selected adapters (globalThis-pinned singletons)
- ✅ Separate `apps/worker` (BullMQ consumer); web enqueues, worker/ in-process runs the same pipeline; SSE polls the store (works cross-process)
- ✅ Prisma schema + `db:push`; Dockerfiles (web + worker) + full `docker-compose` (postgres/redis/minio/migrate/web/worker); `docs/deployment.md`
- ✅ Real recorder inside the worker image: `worker.Dockerfile` installs Playwright Chromium + OS libs (`playwright install --with-deps chromium`); compose worker runs `EXECUTOR=local-process` + `ENGINE_DIR`. Verified in Docker against a live Figma Sites URL (real 7.56s 1440x900 VP8 WebM). ⬜ container-per-job adapter + retention/cleanup cron remain follow-ups.
- ✅ Docker full-stack verified via `docker compose up --build` (2026-07-29): postgres healthy, redis/BullMQ consuming, MinIO bucket provisioned, migrate (`prisma db push`) applied, web + worker healthy; create→inspect→record→optimize→download flow exercised end-to-end cross-process. Presigned downloads use `S3_PUBLIC_ENDPOINT` (browser-reachable `localhost:9000`) rather than the internal `minio:9000`.
- ⬜ Brief-driven scripts in Docker still need `OPENAI_API_KEY` (currently `AI_PROVIDER=fake` → generic canned script). One-env-var flip, no rebuild.

## Phase 4 — Security & reliability  ⬜
- ⬜ SSRF guard (DNS resolve + per-redirect recheck, private/metadata ranges)
- ⬜ Cancellation + timeouts (child process termination)
- ⬜ Rate limits + abuse controls
- ⬜ Retention/cleanup jobs; expiry
- ⬜ Log redaction; error categorization mapping from executor errors

## Phase 5 — Polish & docs  ⬜
- ⬜ Responsive/accessible UI; reduced-motion; empty/loading/failed/expired states
- ⬜ Tutorials + deployment docs + threat model + data-retention + privacy/terms
- ⬜ CI workflow (typecheck, unit, integration, e2e with fakes; no live API key)
- ⬜ Dockerfiles (web + worker with Chromium/FFmpeg); full-stack compose

## Verified so far
- `npm install` + `npm run typecheck` + `npm test` (see README). Fake executor
  produces a previewable WebM when ffmpeg is present.
- Full Docker stack (`docker compose up --build`): real recorder in the worker
  records a live Figma Sites URL end-to-end; presigned downloads work (2026-07-29).

## Known limitations (current)
- Brief-driven walkthroughs need `OPENAI_API_KEY`; with `AI_PROVIDER=fake` the
  script is a generic canned tour (real recording, generic journey).
- DSL validator mirrors the engine grammar; to be unified with the engine parser.
- Container-per-job isolation + retention/cleanup cron not yet implemented.
