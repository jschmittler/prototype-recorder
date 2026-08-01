/**
 * Preflight — dry-run a walkthrough script against the live prototype without
 * recording video, and report per-step whether each target actually resolves.
 *
 * Clicks are still performed (later screens are unreachable otherwise), but the
 * visible cursor, presentation pauses and video capture are skipped, so a full
 * script is checked in seconds instead of minutes. A failing step does not abort
 * the run: it is recorded with the interactive controls that *are* on screen so
 * the author can see what to write instead.
 *
 * Run:  prototype-recorder-cli preflight scripts/foo.md --url https://x.figma.site
 */
import { chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPrototypeUrl, NAV_TIMEOUT, TEST_RESULTS_DIR, VIDEO_DIR } from "./config.js";
import { ensureCursor, installCursor } from "./helpers/cursor.js";
import { parseScript, type ParsedScript, type Step } from "./journey/parse.js";
import { Executor } from "./journey/steps.js";

/** Verbs that only pass time — never worth checking or reporting on. */
const TIMING_VERBS = new Set(["pause", "hold", "settle", "log"]);

/** Verbs that are allowed to find nothing by design. */
const OPTIONAL_VERBS = new Set(["clickIfPresent", "tryClick", "tryClickIntent"]);

export type PreflightStatus = "ok" | "failed" | "skipped";

export interface PreflightStepResult {
  section: string;
  line: number;
  verb: string;
  raw: string;
  status: PreflightStatus;
  /** True when an earlier failure may have left the page in the wrong state. */
  cascaded?: boolean;
  error?: string;
  /** Visible controls on screen at the time of failure, closest match first. */
  suggestions?: string[];
}

export interface PreflightReport {
  name: string;
  url: string;
  finalUrl: string;
  generatedAt: string;
  totalSteps: number;
  checkedSteps: number;
  okCount: number;
  failedCount: number;
  durationSeconds: number;
  results: PreflightStepResult[];
}

/** The quoted/regex name a step is looking for, used to rank suggestions. */
function intendedName(step: Step): string | undefined {
  for (const t of step.tokens) {
    if (t.kind === "string") return t.value;
    if (t.kind === "regex") return t.source.replace(/[.*+?^${}()|[\]\\]/g, " ").trim();
  }
  return undefined;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Icon glyphs and one-letter labels are noise in a "did you mean" list. */
function isMeaningfulName(name: string): boolean {
  return name.length <= 80 && /[a-z]{3}/i.test(name);
}

/** Rank candidate control names by how closely they match what the step wanted. */
function rankSuggestions(candidates: string[], wanted: string | undefined, limit = 8): string[] {
  const unique = Array.from(new Set(candidates.filter(isMeaningfulName)));
  if (!wanted) return unique.slice(0, limit);

  const target = normalize(wanted);
  const targetWords = new Set(target.split(" ").filter((w) => w.length > 2));

  const scored = unique.map((name, index) => {
    const n = normalize(name);
    let score = 0;
    if (n === target) score = 100;
    else if (n.includes(target) || target.includes(n)) score = 50;
    else {
      for (const w of new Set(n.split(" "))) {
        if (targetWords.has(w)) score += 10;
        // Catch near-misses like "Assinged" vs "Assigned".
        else if (w.length > 3 && [...targetWords].some((t) => sharePrefix(t, w))) score += 4;
      }
    }
    return { name, score, index };
  });

  // Ties keep DOM order — the top of the page is more useful than the shortest label.
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, limit).map((s) => s.name);
}

/** True when two words agree on their first four characters. */
function sharePrefix(a: string, b: string): boolean {
  return a.slice(0, 4) === b.slice(0, 4);
}

/** Accessible names of every interactive control currently visible on screen. */
async function visibleControls(page: Page): Promise<string[]> {
  return page
    .evaluate(() => {
      const seen: string[] = [];
      const isVisible = (el: Element): boolean => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
      };
      const name = (el: Element): string => {
        const aria = el.getAttribute("aria-label");
        if (aria) return aria.trim();
        const placeholder = (el as HTMLInputElement).placeholder;
        if (placeholder) return placeholder.trim();
        const alt = el.getAttribute("alt");
        if (alt) return alt.trim();
        return ((el as HTMLElement).innerText || "").replace(/\s+/g, " ").trim().slice(0, 80);
      };
      const selector =
        'button, [role=button], a, [role=link], [role=tab], [role=menuitem], input, textarea, h1, h2, h3';
      document.querySelectorAll(selector).forEach((el) => {
        if (!isVisible(el)) return;
        const n = name(el);
        if (n) seen.push(n);
      });
      return seen.slice(0, 120);
    })
    .catch(() => []);
}

export async function preflight(scriptPathArg?: string, urlOverride?: string): Promise<PreflightReport> {
  const scriptPath = resolveScript(scriptPathArg);
  const parsed: ParsedScript = parseScript(fs.readFileSync(scriptPath, "utf8"));
  const { config, sections } = parsed;
  const url = urlOverride ?? getPrototypeUrl(config.url);

  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });

  const allSteps = sections.flatMap((s) => s.steps);
  const checkable = allSteps.filter((s) => !TIMING_VERBS.has(s.verb));

  console.log(`[preflight] script   : ${path.basename(scriptPath)}`);
  console.log(`[preflight] url      : ${url}`);
  console.log(`[preflight] steps    : ${allSteps.length} (${checkable.length} to verify)`);

  // Presentation timing is irrelevant for a dry run — collapse every pause.
  process.env.PACE = "0.05";

  const startedAt = Date.now();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1 });
  // tsx/esbuild "keepNames" injects __name() into page.evaluate payloads.
  await context.addInitScript(() => {
    // @ts-expect-error runtime shim
    globalThis.__name = globalThis.__name || ((fn: unknown) => fn);
  });
  const page = await context.newPage();

  const results: PreflightStepResult[] = [];
  let sawFailure = false;
  let finalUrl = url;

  try {
    // The cursor overlay must exist: the click path drives it, so a preflight
    // without it would fail every click for reasons a recording never hits.
    await installCursor(page);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(2500);
    await ensureCursor(page);
    finalUrl = page.url();

    // Short resolve timeout: a target that is not there should fail fast.
    const exec = new Executor(page, config, () => {}, { resolveTimeoutMs: 4000 });

    for (const section of sections) {
      for (const step of section.steps) {
        if (TIMING_VERBS.has(step.verb)) continue;

        const base = { section: section.title, line: step.line, verb: step.verb, raw: step.raw };
        try {
          await exec.execute(step);
          results.push({ ...base, status: "ok", cascaded: sawFailure || undefined });
          console.log(`  ok    ${section.title} › ${step.raw}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const status: PreflightStatus = OPTIONAL_VERBS.has(step.verb) ? "skipped" : "failed";
          const suggestions =
            status === "failed" ? rankSuggestions(await visibleControls(page), intendedName(step)) : undefined;

          results.push({ ...base, status, error: message, suggestions, cascaded: sawFailure || undefined });
          if (status === "failed") {
            sawFailure = true;
            console.log(`  FAIL  ${section.title} › ${step.raw}`);
            console.log(`        ${message}`);
            if (suggestions?.length) console.log(`        on screen: ${suggestions.slice(0, 5).join(" · ")}`);
          } else {
            console.log(`  skip  ${section.title} › ${step.raw} (optional)`);
          }
        }
      }
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    // A context without recordVideo still creates the dir via config defaults.
    fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
  }

  const report: PreflightReport = {
    name: config.name,
    url,
    finalUrl,
    generatedAt: new Date().toISOString(),
    totalSteps: allSteps.length,
    checkedSteps: results.length,
    okCount: results.filter((r) => r.status === "ok").length,
    failedCount: results.filter((r) => r.status === "failed").length,
    durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
    results,
  };

  const reportPath = path.join(TEST_RESULTS_DIR, "preflight-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(
    `\n[preflight] ${report.okCount}/${report.checkedSteps} steps resolved` +
      (report.failedCount ? ` — ${report.failedCount} failed` : " — all clear") +
      ` (${report.durationSeconds}s)`
  );
  console.log(`[preflight] report: ${reportPath}`);

  return report;
}

function resolveScript(override?: string): string {
  const candidate = override ?? process.env.SCRIPT ?? path.join(process.cwd(), "script.md");
  const abs = path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate);
  if (!fs.existsSync(abs)) throw new Error(`No script found at ${abs}`);
  return abs;
}

const invokedDirectly = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  preflight().catch((err) => {
    console.error("[preflight] FATAL:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
