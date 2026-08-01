/**
 * Versioned prompt for turning a plain-English brief + prototype inspection
 * into the prototype-recorder-cli Markdown DSL. Kept as a dedicated file (not an
 * inline string in application code) so it can be reviewed and versioned.
 */
import type { GenerateScriptInput } from "./provider";

export const PROMPT_VERSION = "walkthrough-v3";

export const WALKTHROUGH_SYSTEM_PROMPT = `You convert a user's plain-English description of a product walkthrough into a
Markdown "walkthrough script" that an automation engine executes against a
hosted web prototype. Output ONLY the script — no explanation, no code fences.

The script has YAML-style front-matter between --- fences, then "## N. Title"
sections, then "- <verb> <args>" step lines. Blank lines and "#" comments are ok.

FRONT-MATTER (use the exact values provided in the user message; do not invent):
  name, url, viewport (e.g. 1440x900), output, and optionally target_seconds and
  close_ignore: ["text", ...]. Do NOT add a storage_state key.

TARGETS (prefer earlier forms; these mirror how the engine finds elements):
  "Sign In"                bare name -> button, link, tab, menuitem, text, label, alt, aria-label
  role button "Products"   explicit ARIA role + accessible name
  text "Welcome back"      visible text
  placeholder "Search"     form field placeholder
  label "Email"            form field label
  alt "Autodesk"           image alt text — ONLY if listed under image alts in inspection
  /Start.*workflow/i       a regex may replace any quoted name (case-insensitive)
  css .selector            raw CSS — LAST RESORT only

INTENT CLICKS (engine resolves these smartly — prefer over guessing selectors):
  clickIntent close|dismiss     close modal/panel (same heuristics as closeOverlay)
  clickIntent home              logo / home link in the header chrome
  clickIntent back              back / previous navigation control
  tryClickIntent close|home|back|dismiss   same as clickIntent but skip if nothing found

STEP VERBS (only these are allowed):
  waitFor <target>              wait until visible (use after actions that change screen)
  waitForHidden <target>
  pause 2s | hold 4s            presentation pause / final hold
  click <target> [1.2s]         move cursor + click once; optional settle duration
  selectTab <target> [1s]       alias for click (reads well for tabs)
  clickIfPresent <target>       click only if present (e.g. a cookie banner)
  tryClick <target> [1.2s]      click if found; otherwise skip (use for optional/wrap-up steps)
  clickIntent close|home|back|dismiss [1.2s]
  tryClickIntent close|home|back|dismiss [1.2s]
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
  that appear in the provided inspection; do NOT invent buttons, tabs, or alt text.
- When the user says "close", "dismiss", or "exit", use closeOverlay or clickIntent close —
  NOT a guessed alt/text selector.
- For wrap-up / optional steps (logo, accept banners, final navigation), use tryClick,
  tryClickIntent, or clickIfPresent — never a strict click on something that may not exist.
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
  lines.push("  " + list("image alts", el?.imgAlts));
  if (input.inspection?.requiresAuthGuess)
    lines.push("  NOTE: the prototype looks like it may require sign-in; do not enter credentials.");

  const screens = input.inspection?.screens ?? [];
  if (screens.length) {
    lines.push("");
    lines.push("SCREENS REACHED FROM THE LANDING PAGE (clicking the named control opens each one).");
    lines.push("Steps that run after that click may only use controls listed under that screen:");
    for (const s of screens) {
      lines.push(`  after clicking ${JSON.stringify(s.label)}:`);
      lines.push("    " + list("headings", s.headings));
      lines.push("    " + list("buttons", s.buttons));
      lines.push("    " + list("links", s.links));
      lines.push("    " + list("tabs", s.tabs));
      lines.push("    " + list("textboxes/placeholders", s.textboxes));
    }
  }
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

  if (input.previousScript && input.preflightFailures?.length) {
    lines.push("");
    lines.push(
      "THE SCRIPT BELOW WAS RUN AGAINST THE REAL PROTOTYPE AND THESE STEPS COULD NOT BE FOUND."
    );
    lines.push("For each one, the controls that WERE on screen at that moment are listed.");
    lines.push("Rewrite ONLY the broken steps — keep every step that is not listed here exactly as it is:");
    for (const f of input.preflightFailures.slice(0, 20)) {
      lines.push(`  - step: ${f.step}`);
      lines.push(`    problem: ${f.error}`);
      lines.push(`    ${list("on screen", f.suggestions)}`);
    }
    lines.push("");
    lines.push("Replace a broken step with the closest listed control, or drop the step if nothing fits.");
    lines.push("Prefer tryClick / clickIfPresent / tryClickIntent when a control may not always be present.");
    lines.push("");
    lines.push("SCRIPT TO REPAIR:");
    lines.push(input.previousScript.slice(0, 8000));
  }

  lines.push("");
  lines.push("Output ONLY the script (start with ---).");
  return lines.join("\n");
}
