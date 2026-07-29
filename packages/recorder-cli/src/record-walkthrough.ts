/**
 * Generic, script-driven walkthrough recorder.
 *
 * Reads a `script.md` file (structured steps + front-matter), drives the hosted
 * prototype with a visible cursor and smooth motion, records the browser
 * viewport, and exports a high-quality WebM (plus an optional optimized VP9
 * copy). The journey is entirely defined by the script — this file is the
 * reusable engine.
 *
 * Run:
 *   npm run walkthrough:record                       # uses SCRIPT or ./script.md
 *   SCRIPT=scripts/foo.md npm run walkthrough:record
 *   npm run walkthrough:record -- scripts/foo.md
 *   PROTOTYPE_URL="https://x.figma.site" SCRIPT=scripts/foo.md npm run walkthrough:record
 *   HEADED=1 ... (watch live)   PACE=0.85 ... (scale all pauses/scrolls)
 */
import { chromium, type BrowserContext, type Page, type Video } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  getPrototypeUrl,
  STORAGE_STATE_PATH,
  VIDEO_DIR,
  OUTPUT_DIR,
  TEST_RESULTS_DIR,
  PROJECT_ROOT,
  WORK_DIR,
  NAV_TIMEOUT,
  ACTION_TIMEOUT,
  outputPathsFor,
} from "./config.js";
import { installCursor, ensureCursor, moveCursorTo } from "./helpers/cursor.js";
import { attachErrorCollectors, captureFailure } from "./helpers/interactions.js";
import { parseScript, type ParsedScript } from "./journey/parse.js";
import { Executor } from "./journey/steps.js";

const HEADED = process.env.HEADED === "1";

function log(msg: string) {
  console.log(msg);
}

function section(title: string) {
  console.log(`\n────────────────────────────────────────`);
  console.log(`[record] SECTION: ${title}`);
  console.log(`────────────────────────────────────────`);
}

/** Locate the script.md: explicit arg, CLI positional, SCRIPT env, ./script.md, else example. */
function resolveScriptPath(override?: string): string {
  const argPath =
    override ?? (process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : undefined);
  const candidates = [
    argPath,
    process.env.SCRIPT,
    path.join(process.cwd(), "script.md"),
    path.join(PROJECT_ROOT, "script.md"),
    path.join(PROJECT_ROOT, "scripts", "autodesk-post-purchase-onboarding.md"),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const abs = path.isAbsolute(c) ? c : path.resolve(process.cwd(), c);
    if (fs.existsSync(abs)) return abs;
  }
  throw new Error(
    `No script found. Pass a path (npm run walkthrough:record -- scripts/foo.md), set SCRIPT=…, or create ./script.md`
  );
}

async function gotoWithRetry(page: Page, url: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`[record] navigation attempt ${attempt} failed, retrying…`);
      await page.waitForTimeout(1500);
    }
  }
  throw lastErr;
}

export async function run(scriptPathArg?: string): Promise<void> {
  const scriptPath = resolveScriptPath(scriptPathArg);
  const parsed: ParsedScript = parseScript(fs.readFileSync(scriptPath, "utf8"));
  const { config, sections } = parsed;

  const url = getPrototypeUrl(config.url);
  const viewport = config.viewport;
  const outputs = outputPathsFor(config.output || config.name);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });

  const totalSteps = sections.reduce((n, s) => n + s.steps.length, 0);
  console.log(`[record] script       : ${path.relative(process.cwd(), scriptPath)}`);
  console.log(`[record] name         : ${config.name}`);
  console.log(`[record] prototype url : ${url}`);
  console.log(`[record] mode          : ${HEADED ? "headed" : "headless"}`);
  console.log(`[record] viewport      : ${viewport.width}x${viewport.height}`);
  console.log(`[record] sections      : ${sections.length}  (${totalSteps} steps)`);
  if (config.targetSeconds) console.log(`[record] target        : ~${config.targetSeconds}s`);
  console.log(`[record] output        : ${path.relative(process.cwd(), outputs.final)}`);

  const browser = await chromium.launch({
    headless: !HEADED,
    args: [
      "--disable-notifications",
      "--disable-save-password-bubble",
      "--disable-features=Translate,AutofillServerCommunication,PasswordManagerOnboarding",
      "--force-color-profile=srgb",
      "--start-maximized",
    ],
  });

  const storageState = config.storageState
    ? path.resolve(WORK_DIR, config.storageState)
    : STORAGE_STATE_PATH;
  const contextOptions: Parameters<typeof browser.newContext>[0] = {
    viewport,
    deviceScaleFactor: 1,
    recordVideo: { dir: VIDEO_DIR, size: viewport },
    permissions: [],
  };
  if (fs.existsSync(storageState)) {
    console.log(`[record] reusing storage state: ${storageState}`);
    contextOptions.storageState = storageState;
  }

  const context: BrowserContext = await browser.newContext(contextOptions);
  context.setDefaultTimeout(ACTION_TIMEOUT);
  context.setDefaultNavigationTimeout(NAV_TIMEOUT);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const page = await context.newPage();
  const { errors } = attachErrorCollectors(page);
  const video: Video | null = page.video();

  let currentStep = "startup";
  let currentSelector: string | undefined;
  const startedAt = Date.now();

  try {
    await installCursor(page);

    currentStep = "navigate";
    console.log(`\n[record] navigating to prototype…`);
    await gotoWithRetry(page, url);
    await ensureCursor(page);
    await moveCursorTo(page, Math.round(viewport.width / 2), Math.round(viewport.height * 0.48), 600);

    const exec = new Executor(page, config, log);

    for (const sec of sections) {
      section(sec.title);
      for (const step of sec.steps) {
        currentStep = `${sec.title} › ${step.verb} ${step.raw}`;
        currentSelector = step.raw;
        await exec.execute(step);
      }
    }

    const elapsed = (Date.now() - startedAt) / 1000;
    console.log(`\n[record] ✅ journey complete in ~${elapsed.toFixed(1)}s`);
    if (config.targetSeconds && (elapsed < config.targetSeconds - 20 || elapsed > config.targetSeconds + 15)) {
      console.warn(
        `[record] note: runtime ${elapsed.toFixed(0)}s is outside ~${config.targetSeconds}s target — ` +
          `tune pauses in the script or set PACE=<factor>.`
      );
    }
    await context.tracing.stop().catch(() => {});
  } catch (err) {
    currentSelector && console.error(`[record] failing step/selector: ${currentSelector}`);
    await context.tracing.stop({ path: path.join(TEST_RESULTS_DIR, "trace.zip") }).catch(() => {});
    await captureFailure(page, { step: currentStep, selector: currentSelector, errors, error: err });
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    throw err;
  }

  console.log("\n[record] finalizing video (closing context)…");
  await context.close();
  await browser.close();

  if (!video) throw new Error("No video was recorded (page.video() was null)");
  const rawPath = await video.path();
  console.log(`[record] raw video: ${rawPath}`);
  fs.copyFileSync(rawPath, outputs.final);
  verifyOutput(outputs.final);
  optimizeIfPossible(outputs.final, outputs.optimized);

  console.log("\n[record] DONE");
  console.log(`[record] output: ${outputs.final}`);
}

function verifyOutput(file: string): void {
  if (!fs.existsSync(file)) throw new Error(`Expected output missing: ${file}`);
  const size = fs.statSync(file).size;
  if (size <= 0) throw new Error(`Output file is empty: ${file}`);
  console.log(`[record] verified ${path.basename(file)} — ${(size / 1_000_000).toFixed(2)} MB`);
  try {
    const dur = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file],
      { encoding: "utf8" }
    ).trim();
    console.log(`[record] duration (ffprobe): ${Number(dur).toFixed(1)}s`);
  } catch {
    console.log("[record] ffprobe not available — skipping duration check");
  }
}

function optimizeIfPossible(input: string, output: string): void {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    console.log("[record] ffmpeg not available — skipping VP9 optimization");
    return;
  }
  try {
    console.log("[record] creating optimized VP9 copy…");
    execFileSync(
      "ffmpeg",
      ["-y", "-i", input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-pix_fmt", "yuv420p", "-deadline", "good", "-cpu-used", "2", "-an", output],
      { stdio: "ignore" }
    );
    if (fs.existsSync(output) && fs.statSync(output).size > 0) {
      console.log(`[record] optimized copy: ${output} — ${(fs.statSync(output).size / 1_000_000).toFixed(2)} MB`);
    } else {
      console.warn("[record] optimization produced no output; keeping raw only");
    }
  } catch (e) {
    console.warn(`[record] VP9 optimization failed (${String(e).slice(0, 120)}); keeping raw output`);
  }
}

// Auto-run only when invoked directly (e.g. `tsx src/record-walkthrough.ts`),
// not when imported by the CLI.
const invokedDirectly = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  run().catch((err) => {
    console.error("[record] FATAL:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
