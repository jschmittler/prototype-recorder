# Prototype Walkthrough

Turn a Figma prototype into a polished walkthrough video. Paste a published
prototype URL, describe the journey in plain English, and get a downloadable
video — no Node, Playwright, Chromium, or FFmpeg to install on your machine
(all execution happens server-side).

Built on the [figma-walkthrough](https://github.com/jschmittler/figma-walkthrough)
recording engine.

> **Status:** Phase 1 (foundation) — shared contracts, adapter interfaces with
> deterministic fakes, the AI script validator + repair pipeline, and local
> infra. The web UI and worker (the clickable flow) are the next milestone. See
> `IMPLEMENTATION_STATUS.md` and `docs/architecture.md`.

## Repository layout

```
apps/       web (Next.js UI+API) · worker (job consumer)        [coming in Phase 2]
packages/   job-contracts · engine-adapter · script-generator   [built]
docs/       architecture, threat model, tutorials, deployment
docker/     Dockerfiles (web + worker)                          [coming]
```

## Local development

> **Just want to run it?** See **`QUICKSTART.md`** — `npm run dev` (add `apps/web/.env` for real recordings).

Requires Node ≥ 18. The vertical slice runs on **fake adapters + in-memory
infra**, so no database/queue/storage is needed to start.

```bash
npm install
cp .env.example .env
npm run typecheck     # typecheck all packages
npm test              # unit tests (validator + repair pipeline)
```

Optional full infrastructure (only when switching to real adapters):

```bash
docker compose up -d postgres redis minio
```

## How it will work (product flow)

1. Enter a published prototype URL.
2. Describe the walkthrough in plain English.
3. Adjust a few simple settings (duration, viewport, pacing) if you like.
4. Click **Generate walkthrough**.
5. Watch friendly progress; preview and download the video (and the generated
   script) when it's done.

## Documentation

- `docs/architecture.md` — system design + repo-strategy ADR
- `IMPLEMENTATION_STATUS.md` — phase-by-phase checklist
- Engine docs: figma-walkthrough `README.md` / `PLAYBOOK.md`

## Security & privacy (summary)

The service opens the URL you submit in an automated browser, may process page
structure/screenshots to build the walkthrough, and sends your instructions to
Anthropic (hosted mode). It never asks for or stores Figma passwords. Full
SSRF/threat details land with Phase 4 in `docs/threat-model.md`.

## License

MIT. The bundled engine remains under its own MIT license; see the engine repo.
