# Portfolio Walkthrough — script-driven Figma prototype recorder

Automated, portfolio-quality browser walkthroughs of remotely hosted **Figma Make**
prototypes, recorded with a visible cursor and smooth scrolling, and exported as
high-quality **WebM**.

**Repeatable by design:** the journey is defined entirely by a `script.md` file that a
generic engine executes. To record a new prototype you write a `script.md` and point the
recorder at a URL — you do **not** edit any TypeScript.

```bash
# record any prototype from a script:
SCRIPT=scripts/<name>.md PROTOTYPE_URL="https://your.figma.site/" npm run walkthrough:record
```

- **Reference journey:** `scripts/autodesk-post-purchase-onboarding.md`
  → `output/autodesk-post-purchase-onboarding-walkthrough.webm` (~81 s, 1440 × 900,
  VP8 raw + VP9 optimized)
- **Authoring a script:** copy `script.template.md` (full step vocabulary inside).
- **Process for a new prototype:** see **`PLAYBOOK.md`**.

The default/reference prototype is a **published `figma.site`** rendered at the top level
— **no iframe, no Figma editor chrome, no authentication** — so the recording contains
only the prototype.

---

## Requirements

- Node.js ≥ 18 (developed on Node 26)
- Chromium for Playwright (installed via `npx playwright install chromium`)
- FFmpeg / ffprobe (optional — enables duration checks and the VP9 optimized copy)

## Install

```bash
npm install
npx playwright install chromium
```

## Commands

```bash
# 1. Inspect a hosted prototype (classification + accessible-element dump + screenshots)
PROTOTYPE_URL="https://your.figma.site/" npm run walkthrough:inspect

# 2. Record from a script and export the WebM
SCRIPT=scripts/<name>.md npm run walkthrough:record

# 3. (Only if the URL is auth-gated) headed manual Figma auth setup
npm run auth:setup
```

### Choosing the script and URL

The recorder resolves the script from (in order): a CLI arg, `SCRIPT=…`, `./script.md`,
then the bundled reference script. The URL resolves from `PROTOTYPE_URL` → the script's
`url:` front-matter → the built-in default.

```bash
# explicit script + URL
SCRIPT=scripts/acme.md PROTOTYPE_URL="https://acme.figma.site" npm run walkthrough:record
# or pass the script as an argument
npm run walkthrough:record -- scripts/acme.md
# reproduce the reference Autodesk video (no args needed)
npm run walkthrough:record
```

### Live / pacing / windowless

```bash
HEADED=1 SCRIPT=scripts/acme.md npm run walkthrough:record   # watch it run
PACE=0.85 SCRIPT=scripts/acme.md npm run walkthrough:record   # 15% faster (scales all pauses/scrolls)
HEADLESS=1 npm run walkthrough:inspect                        # windowless inspect
```

### CLI (`prototype-recorder-cli`)

Installed globally or run via `npx`, the same engine is available as a command
(outputs are written to your **current directory**):

```bash
prototype-recorder-cli record  scripts/acme.md --url https://acme.figma.site [--headed] [--pace 0.9]
prototype-recorder-cli inspect https://acme.figma.site [--headed]
prototype-recorder-cli auth        # headed Figma auth setup (only for gated URLs)
prototype-recorder-cli setup       # install the Chromium browser
prototype-recorder-cli list        # list bundled scripts
prototype-recorder-cli help | version
```

To package and share this with a team (standalone repo and/or npm/npx), see
**`DISTRIBUTION.md`**.

## Authoring a `script.md`

Copy `script.template.md` — it contains the full step vocabulary. In short:

```md
---
name: Acme Onboarding
url: https://acme.figma.site/
viewport: 1440x900
target_seconds: 75
close_ignore: ["cookie banner text"]   # optional: ✕s to ignore in closeOverlay
---

## 1. Landing
- waitFor "Sign In"
- pause 2.5s
- click "Sign In" 0.9s
- waitFor text "Welcome"

## 2. Search
- fill placeholder "Search" "Fusion"
- pause 2s
- closeOverlay
```

Targets follow the required priority — accessible role/name, label, placeholder,
alt/testid, visible text, then CSS as a last resort (regexes match case-insensitively).
Use `waitFor`/`waitForHidden` to gate on real state changes. See `PLAYBOOK.md` for the
end-to-end process (inspect → resolve selectors → record → debug → tune → verify).

---

## Reference journey (the bundled Autodesk script)

`scripts/autodesk-post-purchase-onboarding.md` records:

1. **Signed-out landing** — orient, then click **Sign In** (the sign-in is part of the
   prototype; no real credentials are ever entered).
2. **Survey the homepage** — smooth scroll to the bottom and back to the top.
3. **Search** — type `Fusion` one character at a time, view results, close via the
   in-bar **✕**.
4. **Maya profile** — open the profile and step through the left-nav in order
   (Home → Apps → Files → Benefits → Start → Marketplace), then **Close**.
5. **Starter Path** — open the full-screen experience, scroll to the bottom, close.
6. **Your Alerts** — select the **Expiring** and **Opportunities** tabs.
7. **Recommended workflow** — open the side panel, hold, close.
8. **Products** — open the Products page, show **Products I own** with **Fusion**, then
   toggle to **AutoCAD**, and scroll to the bottom.
9. **Assistant** — open the floating Autodesk Assistant, hold, close.
10. **Return home** — click the **Autodesk logo**; the session stays signed in and
    returns to the home dashboard; hold the final state ~4 s.

> Note on step 10: in this prototype the logo returns to the signed-in home dashboard
> (it does not sign the user out), so the recording ends on the signed-in landing.

---

## How it works

| Concern | Approach |
| --- | --- |
| **Visible cursor** | A professional arrow cursor is injected into the page (`src/helpers/cursor.ts`) on `<html>` at the maximum z-index with `pointer-events: none`. Motion is eased in-page via `requestAnimationFrame`, with a subtle click ripple. It survives SPA re-renders. |
| **Smooth scrolling** | All visible scrolling is `requestAnimationFrame`-eased (`src/helpers/scrolling.ts`) — window *and* overlay scroll containers. `scrollIntoViewIfNeeded` is used only to locate elements, never as the visible motion. |
| **Human-like input** | Cursor travel is 300–800 ms scaled by distance; typing is one character at a time at 80–150 ms/char (`src/helpers/interactions.ts`). |
| **Script-driven journey** | The journey lives in `script.md`; a generic engine (`src/journey/parse.ts` + `src/journey/steps.ts`) executes it. Adding a prototype means writing a script, not code. |
| **Resilient selectors** | The step resolver tries accessible role/name → label → placeholder → alt/testid → visible text → CSS, in that order (`src/journey/steps.ts`). Bare names are tried as button/link/tab/text; regexes are case-insensitive by default. |
| **Icon-only controls** | `closeOverlay` handles no-accessible-name ✕ controls: it prefers an accessible "close", otherwise clicks the visible ✕ icon (`svg.lucide-x` or an X glyph), skipping any ✕ whose surrounding text matches a `close_ignore` entry (e.g. a persistent banner's own dismiss). |
| **Hosted-page reliability** | Generous navigation/action timeouts, `domcontentloaded` + `waitFor` content assertions (never `networkidle` alone), safe navigation retries only, each click performed exactly once. |
| **Clean recording** | Headless Chromium, clean context, notifications and password-manager prompts disabled, 100% zoom, script `viewport`, sRGB. No terminal or dev-tools are captured. |
| **Failure artifacts** | On failure the run saves a screenshot, page text, current URL, failing step, failing selector, console/page errors (`test-results/failure-*`), and a Playwright trace (`test-results/trace.zip`). |

---

## Output & verification

After recording, the engine:

1. closes the context to finalize the video,
2. copies the raw WebM to `output/<name>.webm` (from the script's `output:` or a slug of
   `name`),
3. verifies it exists and is non-empty,
4. reports its duration via `ffprobe` (when available),
5. creates an optimized **VP9** copy `output/<name>.vp9.webm` **without** overwriting the
   known-good raw output.

Verify manually:

```bash
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height \
  -of default=noprint_wrappers=1 output/<name>.webm
```

---

## Authentication

The default prototype needs **no authentication**. `npm run auth:setup` exists only for
auth-gated `PROTOTYPE_URL`s: it opens a headed browser, lets you sign in manually, and
saves a reusable storage state to `auth/figma-storage-state.json`, which the recording
command reuses automatically. That file is **git-ignored and must never be committed**.
The scripts never request, store, print, or hard-code passwords, and never attempt to
bypass MFA/SSO/org policy — if a URL redirects to Autodesk/Figma SSO, complete it
yourself in the headed window.

## Project structure

```
prototype-recorder-cli/
├── package.json                # name, version, bin, files, deps
├── bin/
│   ├── prototype-recorder-cli.mjs   # CLI entry (runs src/cli.ts via tsx)
│   └── postinstall.mjs         # best-effort Chromium download
├── playwright.config.ts        # canonical settings (viewport, WebM, timeouts)
├── tsconfig.json
├── README.md
├── PLAYBOOK.md                 # process for recording a new prototype
├── DISTRIBUTION.md             # how to share (git repo / npm / npx)
├── LICENSE  ·  CHANGELOG.md
├── script.template.md          # copy me → scripts/<name>.md (full step vocabulary)
├── scripts/
│   ├── autodesk-post-purchase-onboarding.md   # reference journey (DSL)
│   └── trajectory-click-through.md            # second example
├── src/
│   ├── cli.ts                  # argument parser for the prototype-recorder-cli command
│   ├── config.ts               # URL precedence, viewport, package vs. work dir
│   ├── inspect-prototype.ts    # inspect command / walkthrough:inspect
│   ├── record-walkthrough.ts   # record command / walkthrough:record (engine)
│   ├── setup-auth.ts           # auth command / auth:setup
│   ├── journey/
│   │   ├── parse.ts            # script.md → sections + steps
│   │   └── steps.ts            # step executor + target resolver
│   └── helpers/
│       ├── cursor.ts           # injected visible cursor
│       ├── scrolling.ts        # eased scrolling
│       └── interactions.ts     # click / type / wait / failure capture
├── auth/                       # storage state (git-ignored, written to CWD)
├── output/                     # final WebM(s), named per script (written to CWD)
└── test-results/               # inspection + failure artifacts (written to CWD)
```

## Rerun command

```bash
# reference Autodesk journey:
npm run walkthrough:record
# any prototype from a script:
SCRIPT=scripts/<name>.md PROTOTYPE_URL="https://example.figma.site" npm run walkthrough:record
```
