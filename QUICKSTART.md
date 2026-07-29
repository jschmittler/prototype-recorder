# Quickstart — run Prototype Walkthrough locally

The app runs locally with **no database, queue, or object storage** — it uses
in-memory adapters and (optionally) the real recording engine. Two levels:

## 1. Simplest — instant, fake everything

```bash
npm install
npx playwright install chromium   # only needed for the real recorder (level 2)
npm run dev
```

Open http://localhost:3000 → **Create walkthrough** → paste any URL + a
description → **Generate**. You'll see the full flow (live progress → result)
with a placeholder video, no external services and no API key.

## 2. Real recordings of real prototypes (recommended)

Point the app at a local checkout of the recording engine and it will produce an
actual screen recording. Create `apps/web/.env` (git-ignored):

```bash
# apps/web/.env
EXECUTOR=local-process
ENGINE_DIR=/absolute/path/to/figma-walkthrough   # the engine repo
AI_PROVIDER=fake                                  # builds a script from real inspection
```

Then:

```bash
npm run dev
```

Now a walkthrough of a **published figma.site** URL is really recorded (visible
cursor, smooth scrolling) and previewable/downloadable on the result page.

### 2b. Real AI script generation

Add your Anthropic key to `apps/web/.env` to have the model write the script:

```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-5   # optional: cheaper than the default claude-opus-4-8
```

## Notes

- **Engine repo:** the real recorder shells out to the published
  [figma-walkthrough](https://github.com/jschmittler/figma-walkthrough) engine,
  which brings its own Chromium/FFmpeg. Clone it and set `ENGINE_DIR` to it.
- **Auth-gated prototypes** aren't supported in the hosted flow — use published
  `figma.site` links.
- **Full production stack** (Postgres + Redis/BullMQ + a separate worker +
  S3/MinIO) is not required for local use; `docker-compose.yml` provisions those
  services when you switch the adapter env vars. That wiring is the next
  milestone (see `IMPLEMENTATION_STATUS.md`).
- Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build:web`.
