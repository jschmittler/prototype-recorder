# Front-door research — Frodotyping

Evidence gathered through the Mobbin MCP, then synthesised into the design
decisions implemented in this repository. Mobbin was used to learn patterns; no
screenshot or composition was reproduced.

## Product audit (before)

| Area | Finding |
| --- | --- |
| Routes | Only three: `/`, `/create`, `/jobs/[id]` |
| Visual system | Split identity — `/` was light mode (`bg-white`, `text-gray-600`), `/create` and `/jobs` were dark (`studio-*` tokens) |
| Intro animation | `HeroStoryGraphic`: six marketing panels, 16:10, ~720 px tall at desktop, auto-advancing every 5 s, **looping forever**, no reduced-motion handling |
| Shell | Header/footer in `app/layout.tsx` (light) plus a separate `StudioShell` (dark) — two competing shells |
| Tokens | `brand` (indigo) and `studio` (neutral grey) ramps only. No semantic, status, or motion tokens |
| Brand | Named "Prototype Walkthrough" throughout |
| Data model | Single job per run, in-memory store, no accounts, projects, teams, templates, or collaborators |

The last row is the constraint that shaped everything else.

### What the product can honestly support

The brief asks for recent work, templates, team, collaborators, pinning, and an
activity feed. Most of that has no backing data, and the brief also says *"avoid
fake interactions with no working behavior"* and *"every journey status must
correspond to real project conditions."* Those two instructions conflict, so the
data won.

Built, because it is real:

- **Recent work** — job IDs recorded client-side as you create them, then
  re-fetched live from `/api/jobs/[id]`. Real status, real stage, real time.
- **Journey stages** — mapped onto the actual pipeline (`QUEUED`, `INSPECTING`,
  `GENERATING_SCRIPT`, `VALIDATING_SCRIPT`, `RECORDING`, `UPLOADING`, `COMPLETE`,
  `FAILED`), not an invented ladder.
- **Command palette** — navigates real routes and real recent jobs.
- **Expired state** — jobs genuinely disappear when the server restarts or the
  TTL lapses, so that is designed for rather than hidden.

Deliberately not built: Teams, collaborators, template libraries, pinning,
notification feeds. Each would have been a dead control.

## Screens examined

34 screens across four searches (AI workspace homes, dark developer consoles,
command palettes, long-running task progress).

### Shortlist

| Reference | Lesson taken |
| --- | --- |
| [Langdock](https://mobbin.com/screens/fdd8e6dc-5f56-4236-acf1-95fae4203b4f) | Dark AI home that stays calm: greeting, one composer, action chips beneath it, project tree in a quiet left rail. The closest tonal match to what Frodotyping should feel like. |
| [Obvious](https://mobbin.com/screens/17b7482f-2f1f-4198-85cd-c059a89890cb) | Output-type chips sit directly under the composer, so intent and destination are chosen in one gesture. Adopted as the viewport/duration chips. |
| [Google AI Studio](https://mobbin.com/screens/d3212a1c-a0f1-49fb-835c-737c0117c3bd) | A `/` hint inside the input, with a command menu opening in place. Command access advertised where the user is already looking. |
| [Vercel — projects](https://mobbin.com/screens/9b397b77-fd80-4157-9867-2ae4010133a4) | Project cards carry genuinely useful metadata (branch, commit, relative time, status icon) instead of decorative thumbnails. |
| [Vercel — deployment](https://mobbin.com/screens/787123a5-8a85-4d1b-838f-705673a0c820) | The strongest long-running-job pattern found: named steps, per-step state icon, elapsed seconds, expandable logs, warning counts. Directly informs the job pipeline view. |
| [Linear](https://mobbin.com/screens/267d16a1-982b-4479-85b5-22294fdab01a) | Milestone list with real percentages and dates — progress tied to conditions, never a decorative bar. |
| [Modal](https://mobbin.com/screens/f4921a68-37e1-4a99-bba3-ffa9feced1fb) | Restrained dark density: filter pills that state their counts (`Live Apps 1`), one metadata row, generous quiet space. |
| [Render](https://mobbin.com/screens/76bf2ace-29c2-4e7d-8378-7dfbf5c3ef61) | Status / Runtime / Region / Deployed columns, and an empty state that tells you what to do next rather than apologising. |
| [Vapi — palette](https://mobbin.com/screens/593d7acd-2e16-4365-bcd6-02ce52f48f3b) | Grouped palette sections with a secondary label per row and a persistent keyboard legend in the footer. The model for our ⌘K. |
| [Bonsai](https://mobbin.com/screens/a686898a-983d-4731-9946-fd0c2c2d00b4) | "Recently Viewed" rows with a type badge on the right and status underneath — scannable without icons doing all the work. |
| [Replit](https://mobbin.com/screens/6d3bb3c3-ebbe-4376-a8c0-bd8a6727d3fc) | Per-row shortcuts shown inline, so the palette teaches the keyboard as you use it. |
| [Zillow](https://mobbin.com/screens/228656fd-d38f-4c46-ac78-6b5ee83981cd) | A waiting state that lists what has already been finished. Reassurance through specificity. |
| [Relevance AI](https://mobbin.com/screens/d0dc629f-1593-4454-bc1c-2f759c5777ff) | Named check steps during validation — the user learns the system's method by watching it work. |
| [Employment Hero](https://mobbin.com/screens/4852a8e5-f3d8-44fc-97ac-f94fd950b7f4) | A lifecycle table with an explicit **Owner** column, separating who is responsible for each step. |
| [Plane](https://mobbin.com/screens/719c3745-0d7d-44e0-bb49-2a30c194fcbe) | A scope selector attached to the composer (`Focus: …`), making AI context explicit before submission. |

## Recurring patterns worth adopting

1. **One composer, clearly scoped.** Every strong AI home has a single primary
   input with its context visible next to it — not a chatbot bolted onto a
   dashboard.
2. **Destination chosen with intent.** Obvious and Langdock both let you pick the
   output type at the moment you describe the work.
3. **Recents carry real metadata.** Vercel, Bonsai and Plane all show status,
   time and type per row. Identical decorative cards were absent from every
   strong reference.
4. **Progress is enumerated, not summarised.** Vercel, Zillow, Relevance AI and
   AWS all name each step and give it its own state.
5. **The palette teaches itself.** Vapi, Replit and Juicebox keep a keyboard
   legend permanently visible in the footer.
6. **Dark surfaces are layered by tone, not by glow.** Modal, Render and Linear
   separate surfaces with 3–6 % lightness steps and hairline borders.
7. **Empty states give an instruction.** Render's "Staging is empty — kickstart
   your environment" beats a shrug.

## Anti-patterns observed and rejected

- Oversized marketing heroes above the working surface (the previous `/` did
  exactly this).
- Progress bars with no unit or endpoint.
- Grids of identical thumbnails standing in for real project state.
- Palettes that open with no results and no guidance.
- Glow or gradient applied to every surface to imply "AI".

## Design principles for Frodotyping

1. **Work before marketing.** The composer is above the fold; explanation sits
   beneath it.
2. **Every status is earned.** Stage labels come from the pipeline, not decoration.
3. **Gold is a destination, not an accent.** Reserved for `COMPLETE` — a
   walkthrough ready to show someone. Never used for ordinary buttons or links.
4. **Calm density.** Hierarchy through spacing, tone and type scale; no oversized
   containers.
5. **Progressive technical depth.** Script, logs and encoding options stay behind
   disclosure; nothing is removed.
6. **Motion describes movement.** Short, directional, once. Never ambient.

## Information architecture

```
Home (/)            Trailhead — intro, intent composer, recent work, how it works
Create (/create)    Brief, settings, preflight check, script
Job (/jobs/[id])    Live pipeline, video, script, share
⌘K                  Navigate · recent jobs · actions
```

Four destinations, all backed by real capability. `Projects`, `Library`,
`Activity`, `Team`, `Templates` and `Settings` were considered and dropped —
none has data behind it.

## Journey model

Mapped one-to-one onto real pipeline states, with `Owner` borrowed from
Employment Hero to separate AI work from human work:

| Stage | Pipeline status | Owner |
| --- | --- | --- |
| Trailhead | `DRAFT`, `QUEUED` | You / — |
| Setting out | `PREPARING` | System |
| Surveying | `INSPECTING` | AI |
| Charting | `GENERATING_SCRIPT` | AI |
| Checking | `VALIDATING_SCRIPT` | System |
| Travelling | `RECORDING`, `OPTIMIZING` | System |
| Arriving | `UPLOADING` | System |
| Ready to show | `COMPLETED` | You |
| Blocked | `FAILED` | You |
| Stopped | `CANCELED` | You |
| Expired | `EXPIRED` | — |

Plain labels accompany every branded term, per the brief's instruction not to
make users decode metaphors before acting.

## Motion language

| Token | Duration | Use |
| --- | --- | --- |
| `--motion-fast` | 120 ms | Hover, focus, press |
| `--motion-base` | 200 ms | Standard transitions |
| `--motion-panel` | 320 ms | Panels, disclosure, palette |
| `--motion-page` | 420 ms | Route-level arrival |
| `--motion-intro` | 1400 ms | Compact intro, once per session |

All collapse to ~0 ms under `prefers-reduced-motion`.

## Compact intro

The six-panel loop is reduced to a single settling sequence: a route line
resolving to a gold waypoint behind the wordmark. It occupies `clamp(132px,
22vh, 208px)` — inside the 18–26 % desktop target and the 120–200 px mobile
target — plays once per session (`sessionStorage`), never loops, and is skipped
entirely under reduced motion, which renders the settled end state directly.

The strongest recognisable moment of the original — the arrival at "the work
speaks for itself" — is preserved as the gold waypoint lighting at the end of
the line.

## Responsive behaviour

Validated at 1600, 1440, 1280, 1024, 834, 768, 430, 390 and 360 px. The nav
collapses labels below 768 px, the composer keeps a 44 px touch target, recent
work moves from three columns to one, and the intro scales with `vh` while
staying above its minimum.

## Assumptions

- Recent work is per-browser, since there are no accounts. Documented in the UI
  rather than implied to be synced.
- Jobs vanish on server restart (in-memory store). Treated as a real, designed
  "expired" state.
