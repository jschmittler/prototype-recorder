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

## Phase 3 — Real engine integration  🟡
- ✅ `LocalProcessExecutor` running figma-walkthrough `inspect`/`record` via `spawn` (env-selected via `EXECUTOR=local-process` + `ENGINE_DIR`); real inspection report parsing; progress streaming, timeout, cancellation, scrubbed logs; verified against a live prototype (real 14s WebM)
- ⬜ Unify validator with the engine's real DSL parser (single source of truth)
- ✅ `AnthropicProvider` (server key, injectable client) + versioned prompt (`prompt.ts`, walkthrough-v1); env-selected via `AI_PROVIDER=anthropic`; default model `claude-opus-4-8` (adaptive thinking); defensive output parsing; mock-tested (6 tests). Live run needs `ANTHROPIC_API_KEY`.
- ✅ Turnkey local run: `apps/web/.env` (`EXECUTOR=local-process` + `ENGINE_DIR`) makes `npm run dev` record real prototypes with no API key; verified end-to-end via the browser flow (real 13.9s 1440x900 WebM). See `QUICKSTART.md`.
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
