/**
 * Versioned prompt for turning a plain-English brief + prototype inspection
 * into the prototype-recorder-cli Markdown DSL. Kept as a dedicated file (not an
 * inline string in application code) so it can be reviewed and versioned.
 */
import type { GenerateScriptInput } from "./provider";

export const PROMPT_VERSION = "walkthrough-v1";

export const WALKTHROUGH_SYSTEM_PROMPT = `You convert a user's plain-English description of a product walkthrough into a
Markdown "walkthrough script" that an automation engine executes against a
hosted web prototype. Output ONLY the script — no explanation, no code fences.

The script has YAML-style front-matter between --- fences, then "## N. Title"
sections, then "- <verb> <args>" step lines. Blank lines and "#" comments are ok.

FRONT-MATTER (use the exact values provided in the user message; do not invent):
  name, url, viewport (e.g. 1440x900), output, and optionally target_seconds and
  close_ignore: ["text", ...]. Do NOT add a storage_state key.

TARGETS (prefer earlier forms; these mirror how the engine finds elements):
  "Sign In"                bare name -> tried as button, link, tab, then visible text
  role button "Products"   explicit ARIA role + accessible name
  text "Welcome back"      visible text
  placeholder "Search"     form field placeholder
  label "Email"            form field label
  alt "Logo"               image alt text
  /Start.*workflow/i       a regex may replace any quoted name (case-insensitive)
  css .selector            raw CSS — LAST RESORT only

STEP VERBS (only these are allowed):
  waitFor <target>              wait until visible (use after actions that change screen)
  waitForHidden <target>
  pause 2s | hold 4s            presentation pause / final hold
  click <target> [1.2s]         move cursor + click once; optional settle duration
  selectTab <target> [1s]       alias for click (reads well for tabs)
  clickIfPresent <target>       click only if present (e.g. a cookie banner)
  clickEach ["A","B","C"] [1s]  click several names in order
  clickInRow "Fusion" "Manage"  click a control inside the row containing some text
  fill <target> "text"          focus a field and type it character by character
  type "text"                   type into the already-focused field
  press Escape                  a keyboard key
  scrollTo <target> [1s]        smoothly bring an element into view
  scrollBy 700 [1.2s]           smooth window scroll by N px (negative = up)
  scrollToBottom [2s] | scrollToTop [1.3s]
  scrollOverlayToBottom [2s]    scroll a modal/panel that has its own scroll region
  closeOverlay                  close a modal/panel (accessible "close" or the X icon)
  log "message"

RULES:
- Use ONLY the verbs above. Never emit "goto" or any navigation verb — the engine
  opens the prototype URL itself.
- Never include shell commands, JavaScript, backticks, $(...), file paths, or URLs
  other than the provided one.
- Prefer accessible roles/names/labels/placeholders over CSS. Only use controls
  that appear in the provided inspection; do NOT invent buttons or tabs.
- Put a waitFor (or waitForHidden) around meaningful screen transitions.
- Use realistic pauses (1-3s) so the video is readable, but keep the whole thing
  close to target_seconds when one is given; don't pad.
- Never enter real credentials and never attempt to bypass authentication.
- Begin the output with the "---" front-matter line and end after the last step.`;

function list(label: string, items: string[] | undefined): string {
  const v = (items ?? []).filter(Boolean).slice(0, 40);
  return v.length ? `${label}: ${v.map((s) => JSON.stringify(s)).join(", ")}` : `${label}: (none found)`;
}

export function buildUserPrompt(input: GenerateScriptInput): string {
  const el = input.inspection?.elements;
  const lines: string[] = [];
  lines.push("Create a walkthrough script with EXACTLY this front-matter:");
  lines.push(`  name: ${(input.inspection?.title || "Walkthrough").slice(0, 100)}`);
  lines.push(`  url: ${input.url}`);
  lines.push(`  viewport: ${input.viewport.width}x${input.viewport.height}`);
  lines.push(`  output: ${input.outputBaseName}`);
  if (input.targetSeconds) lines.push(`  target_seconds: ${input.targetSeconds}`);
  if (input.closeIgnore && input.closeIgnore.length)
    lines.push(`  close_ignore: [${input.closeIgnore.map((s) => JSON.stringify(s)).join(", ")}]`);
  lines.push("");
  lines.push("PROTOTYPE INSPECTION (only use controls that appear here):");
  lines.push("  " + list("buttons", el?.buttons));
  lines.push("  " + list("links", el?.links));
  lines.push("  " + list("textboxes/placeholders", el?.textboxes));
  lines.push("  " + list("tabs", el?.tabs));
  lines.push("  " + list("headings", el?.headings));
  if (input.inspection?.requiresAuthGuess)
    lines.push("  NOTE: the prototype looks like it may require sign-in; do not enter credentials.");
  lines.push("");
  lines.push("USER'S DESCRIPTION OF THE WALKTHROUGH:");
  lines.push(input.instructions);

  if (input.previousScript && input.validationErrors?.length) {
    lines.push("");
    lines.push("YOUR PREVIOUS ATTEMPT FAILED VALIDATION. Fix these errors and output a corrected script:");
    for (const e of input.validationErrors.slice(0, 20)) lines.push(`  - ${e}`);
    lines.push("");
    lines.push("PREVIOUS ATTEMPT:");
    lines.push(input.previousScript.slice(0, 6000));
  }

  lines.push("");
  lines.push("Output ONLY the script (start with ---).");
  return lines.join("\n");
}
