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

## Phase 2 — Functional vertical slice (fake adapters)  ⬜
- ⬜ `packages/database`: `JobStore` (in-memory) + `Queue` (in-process) abstractions
- ⬜ `apps/web`: Next.js App Router, Tailwind, shared UI
  - ⬜ Marketing/home page
  - ⬜ Creation page (URL + brief + basic/advanced settings, consent copy)
  - ⬜ Job progress page (SSE, stages, elapsed, cancel, technical details)
  - ⬜ Result page (preview, metadata, download video/script, create another)
  - ⬜ Failure page (friendly category, retry, edit, details)
- ⬜ API/BFF: create/get/stream/cancel/retry/download (+ idempotency, ownership)
- ⬜ `apps/worker`: consume queue, drive fake inspect→generate→validate→record→upload, emit progress
- ⬜ E2E: home → create → live progress (deterministic fake) → result/failure

## Phase 3 — Real engine integration  ⬜
- ⬜ `LocalProcessExecutor` running figma-walkthrough `inspect`/`record` via `spawn`
- ⬜ Unify validator with the engine's real DSL parser (single source of truth)
- ⬜ `AnthropicProvider` (server key) + versioned prompt file; verify model id/API via the claude-api reference
- ⬜ Prisma + Postgres `JobStore`; BullMQ + Redis queue; S3/MinIO storage with signed URLs

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

## Known limitations (current)
- No UI/worker yet (Phase 2). No real AI/engine/storage yet (Phase 3).
- DSL validator mirrors the engine grammar; to be unified with the engine parser
  in Phase 3.
