# Architecture

Prototype Walkthrough is a SaaS front-end around the **prototype-recorder-cli**
recording engine. A non-technical user submits a published prototype URL and a
plain-English brief; the system inspects the prototype, uses an Anthropic model
to author a script in the engine's Markdown DSL, deterministically validates it,
records it headlessly, and returns a downloadable WebM.

## Repository strategy (ADR-001)

**Decision:** a **separate repository** (`prototype-recorder`) that consumes
the engine (`prototype-recorder-cli`) as a dependency, rather than restructuring the
engine repo into a monorepo.

**Why:** the engine is already published to npm and pushed to
`github.com/jschmittler/prototype-recorder`; keeping it small, stable, and
independently versioned avoids churning a shipped artifact. This app evolves on
its own cadence and pins the engine by version (or a local `file:`/workspace
link during development).

**Consequences:** the app never edits engine internals; it depends on the
engine's public surface (`inspect`, `record`, the DSL parser). Where the app
needs the DSL grammar for validation, it currently mirrors it in
`@ptw/script-generator` and will unify against the engine's exported parser in
Phase 3 (see IMPLEMENTATION_STATUS.md).

## Monorepo layout

```
apps/
  web/        Next.js (App Router) UI + API/BFF
  worker/     asynchronous job worker (queue consumer)
packages/
  job-contracts/     shared types, statuses, settings, events, error model (zod)
  engine-adapter/    WalkthroughExecutor interface + FakeExecutor (+ LocalProcess in P3)
  script-generator/  AIProvider interface + FakeAIProvider + DSL validator + repair loop
  database/          JobStore interface + in-memory (dev) + Prisma (prod)   [P2/P3]
  ui/                shared UI primitives (optional)                         [P2]
docs/  docker/  scripts/
```

## Key seams (swap without touching job logic)

| Concern | Interface | Dev default | Production |
| --- | --- | --- | --- |
| Model | `AIProvider` | `FakeAIProvider` | `AnthropicProvider` (server key; BYOK later) |
| Recorder | `WalkthroughExecutor` | `FakeExecutor` | `LocalProcessExecutor` → container adapter |
| Queue | `Queue` | in-process | BullMQ + Redis |
| Job store | `JobStore` | in-memory | Prisma + Postgres |
| Storage | `Storage` | local fs | S3-compatible (MinIO/S3), signed URLs |

Adapters are selected by environment variables (see `.env.example`), so the
vertical slice runs with **zero external services** while the production path is
fully wired behind the same interfaces.

## Request → video flow

1. `POST /api/jobs` validates `CreateJobInput` (zod) + SSRF-checks the URL, then
   creates a job (idempotency key dedupes double-clicks) and enqueues it.
2. The worker runs the job through statuses: `PREPARING → INSPECTING →
   GENERATING_SCRIPT → VALIDATING_SCRIPT → RECORDING → OPTIMIZING → UPLOADING →
   COMPLETED`, emitting progress events.
3. Inspection produces a scrubbed, summarized `InspectionResult`.
4. `AIProvider` proposes a script; `validateScript` enforces the grammar,
   viewport allowlist, URL match, size/step caps, and rejects navigation /
   shell / script-ish content. Up to two repair round-trips.
5. `WalkthroughExecutor.record` runs in an isolated per-job workspace and yields
   a WebM (+ optional VP9) and metrics.
6. Artifacts upload to private storage; the UI streams status (SSE) and offers
   time-limited signed downloads.

## Security posture (summary)

- SSRF: only http/https, no credentials, block private/loopback/link-local/
  metadata ranges, re-check every redirect. (Details in `docs/threat-model.md`.)
- User input is never interpolated into a shell; the executor uses `spawn` with
  an argument array and a restricted env.
- Model output is data, never executed; it passes deterministic validation
  first.
- Secrets and browser-session data never reach the client or logs (redaction).

## Status

This repository currently contains **Phase 1 (foundation)**: contracts,
adapter interfaces + deterministic fakes, the script validator + repair
pipeline, and local infra. Phases 2–5 are tracked in `IMPLEMENTATION_STATUS.md`.
