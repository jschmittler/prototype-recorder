---
# Front-matter (all optional except name). Copy this file to scripts/<your>.md
name: My Prototype Walkthrough
url: https://your-prototype.figma.site/     # PROTOTYPE_URL env overrides this
viewport: 1440x900
target_seconds: 75                          # informational; runtime is logged vs. this
# storage_state: auth/figma-storage-state.json   # only if the URL needs Figma auth
# output: my-walkthrough.webm               # defaults to a slug of `name`
close_ignore: []                            # text of persistent chrome whose X should NOT be treated as a close
---

<!--
  STEP VOCABULARY
  ───────────────
  Targets (in priority order — prefer the earlier forms):
    "Sign In"                     bare name → tried as button, link, tab, then visible text
    role button "Products"        explicit ARIA role + accessible name
    text "Welcome back"           visible text (substring, case-insensitive)
    placeholder "Search"          form field by placeholder
    label "Email"                 form field by associated label
    alt "Autodesk"                image by alt text
    testid "submit"               data-testid
    css .some-selector            raw CSS (last resort; avoid generated Figma hashes)
    /Start.*workflow/i            a regex may replace any quoted name (case-insensitive by default)

  Verbs:
    goto ["url"]                  navigate (the runner already opens `url` first; rarely needed)
    waitFor <target>              wait until a target is visible  (use to confirm state changes)
    waitForHidden <target>        wait until a target is gone
    pause 2.5s / hold 4s          presentation pause (hold = same, reads as a deliberate hold)
    click <target> [1.2s]         move cursor + click once; optional trailing settle duration
    selectTab <target> [1s]       alias for click (reads better for tabs)
    clickIfPresent <target>       click only if visible (e.g. an optional cookie banner)
    clickEach ["A","B","C"] [1s]  click several names in order; optional per-item settle
    clickInRow "Fusion" "Manage"  click the control named "Manage" inside the smallest
                                  element also containing "Fusion" (row-scoped click when
                                  several identical buttons exist)
    fill <target> "text"          focus a field and type it one character at a time
    type "text"                   type into the already-focused field
    press Escape                  a keyboard key
    scrollTo <target> [1s]        smoothly centre an element in view
    scrollBy 700 [1.2s]           smooth window scroll by N px (negative = up)
    scrollToBottom [2s]           smooth window scroll to the bottom
    scrollToTop [1.3s]            smooth window scroll to the top
    scrollOverlayToBottom [2s]    smooth-scroll the dominant overlay/panel to its bottom
    closeOverlay                  close a modal/panel: accessible "close" first, else the visible ✕ icon
    moveCursor 720 450            move the visible cursor to x,y (viewport coords)
    log "message"                 print a note

  Notes:
    • Anything after `#` on a step line is a comment; `<!-- … -->` blocks are ignored.
    • closeOverlay skips any ✕ whose surrounding text matches a `close_ignore` entry
      (handy for a persistent banner that has its own dismiss ✕).
    • Section headers (## …) are just for logging/organisation.
    • Set PACE=0.85 (or 1.2) at runtime to uniformly speed up / slow down every pause & scroll.
-->

## 1. Landing
- waitFor "Sign In"
- pause 2.5s
- click "Sign In" 0.9s
- waitFor text "Welcome"

## 2. Explore
- scrollToBottom
- pause 1s
- scrollToTop

## 3. End
- hold 4s
