# Playbook — recording a new prototype

This is the repeatable process for turning **a prototype URL + a `script.md`** into a
finished WebM. It is the exact procedure to follow every time (whether run by you or by
Claude). The reusable engine never changes; only the `script.md` does.

## TL;DR

```bash
# 1. Put your journey in scripts/<name>.md  (copy script.template.md)
# 2. Confirm the prototype is reachable and capture real selector names:
PROTOTYPE_URL="https://your.figma.site/" npm run walkthrough:inspect
# 3. Record:
SCRIPT=scripts/<name>.md PROTOTYPE_URL="https://your.figma.site/" npm run walkthrough:record
# 4. Check output/<name>.webm  (duration/size/cursor); tune pauses or PACE if needed.
```

## The process, step by step

### 1. Write (or receive) `script.md`
- Start from `script.template.md`; keep it in `scripts/`.
- Set `name`, `url` (or pass `PROTOTYPE_URL`), `viewport`, and a `target_seconds`.
- Express the journey with the step vocabulary. **Prefer accessible targets**
  (`"Sign In"`, `role button "Products"`, `placeholder "Search"`, `text "…"`) over CSS.
- Use `waitFor …` after any action that changes state — this is what makes the run
  reliable on a hosted SPA (never rely on fixed sleeps alone).

### 2. Inspect first (always)
```bash
PROTOTYPE_URL="https://your.figma.site/" npm run walkthrough:inspect
```
This classifies the page (direct prototype / editor / auth wall / iframe / cookie banner)
and dumps the **accessible element names** and visible text to
`test-results/inspection-report.txt`, plus screenshots. Use those exact names in the
script. If the report shows an **iframe**, target inside it (the engine currently assumes
a top-level published `figma.site`; a cross-origin iframe needs a `FrameLocator` — see
"Extending the engine").

If the report shows an **auth wall / SSO redirect**, run `npm run auth:setup` once
(headed, manual sign-in), which saves `auth/figma-storage-state.json`; the recorder
reuses it automatically. Never enter credentials in an automated step.

### 3. Resolve the tricky selectors
Most controls have accessible names. Two things usually don't:
- **Icon-only close/clear buttons (✕):** use `closeOverlay`. It clicks an accessible
  "close" if present, otherwise the visible ✕ icon, skipping any ✕ whose surrounding
  text matches a `close_ignore` entry (set that for a persistent banner that has its own
  dismiss ✕ — e.g. `close_ignore: ["payment failed"]`).
- **CSS-uppercased tab labels:** the accessible name uses the raw DOM text, so match with
  a regex (case-insensitive by default), e.g. `click /expiring/`.

If something still won't resolve, add a tiny discovery probe (a throwaway script that
opens the page, performs the steps so far, and prints candidate buttons/positions) — the
same technique used to build the reference script — then encode the finding as a stable
selector or, as a documented last resort, a `css` target / `moveCursor`+coordinates.

### 4. Dry-run and debug
```bash
SCRIPT=scripts/<name>.md npm run walkthrough:record
# watch it live:
HEADED=1 SCRIPT=scripts/<name>.md npm run walkthrough:record
```
On failure the runner writes to `test-results/`:
`failure-screenshot.png`, `failure-report.txt` (failing step, selector, URL, page text,
console/page errors) and `trace.zip` (open with `npx playwright show-trace test-results/trace.zip`).

### 5. Tune the runtime
- Runtime is logged and compared to `target_seconds`.
- Adjust individual `pause`/`hold` values and the optional trailing durations on
  `click`/`scroll*`, or scale everything at once with `PACE` (e.g. `PACE=0.85` = 15% faster).

### 6. Verify and hand off
- Confirm `output/<name>.webm` exists, is non-empty, plays, and shows the visible cursor.
- `ffprobe` duration is printed automatically; an optimized VP9 copy is written to
  `output/<name>.vp9.webm` without ever overwriting the good raw file.

## What Claude does when you say "here's a URL and a script.md"
1. Runs `walkthrough:inspect` against the URL and reads the accessibility dump.
2. Reconciles your `script.md` targets with the real accessible names (fixing casing /
   wording, adding `waitFor`s, setting `close_ignore`), doing a short discovery probe for
   any icon-only or ambiguous control.
3. Records, reads `test-results/` on any failure, fixes the script, and re-runs.
4. Tunes pacing to `target_seconds`, then reports duration, size, file list, and the exact
   rerun command.

## Extending the engine (rare)
Add a new verb in `src/journey/steps.ts` (`execute()` switch) and document it in
`script.template.md`. For a cross-origin iframe prototype, thread a `FrameLocator`
through `resolveTarget` (build candidates from `page.frameLocator(<selector>)` instead of
`page`). Keep the cursor overlay in the parent page and translate coordinates into the
iframe, as noted in the original design.
