/**
 * LocalProcessExecutor — the real recorder adapter. It runs the external
 * prototype-recorder-cli engine as a child process (its own Chromium/Playwright/
 * FFmpeg install), so this repo stays free of heavy browser dependencies.
 *
 * - `inspect` runs the engine's `inspect` command and parses its report.
 * - `record` runs the engine's `record` command against a validated script.md
 *   in an isolated per-job workDir, streams scrubbed progress, enforces a
 *   timeout, supports cancellation, and returns the produced WebM + metrics.
 *
 * The engine is never handed shell strings: we spawn node with an argv array
 * and a restricted environment.
 */
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ExecutorError,
  type ExecutorProgress,
  type ExploredScreen,
  type InspectInput,
  type InspectionResult,
  type PreflightInput,
  type PreflightResult,
  type RecordInput,
  type RecordResult,
  type WalkthroughExecutor,
} from "./index";
import { makePoster } from "./poster";

export interface LocalExecutorOptions {
  /** Path to a prototype-recorder-cli checkout or install (contains bin/). */
  engineDir: string;
  nodeBin?: string;
}

function scrub(line: string): string {
  return line
    .replace(/(api[_-]?key|authorization|token|secret)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/gh[oprsu]_[A-Za-z0-9]{20,}/g, "[redacted]")
    .slice(0, 500);
}

interface SpawnOpts {
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  signal?: AbortSignal;
  jobId?: string;
  onLine?: (line: string) => void;
  /** Exit codes treated as success (defaults to [0]). */
  okExitCodes?: number[];
}

export class LocalProcessExecutor implements WalkthroughExecutor {
  private children = new Map<string, ChildProcess>();
  private enginePath: string;
  private nodeBin: string;

  constructor(opts: LocalExecutorOptions) {
    this.enginePath = path.join(opts.engineDir, "bin", "prototype-recorder-cli.mjs");
    this.nodeBin = opts.nodeBin ?? process.execPath;
    if (!fs.existsSync(this.enginePath)) {
      throw new ExecutorError(`Engine not found at ${this.enginePath} (set ENGINE_DIR).`, "unknown");
    }
  }

  private restrictedEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: process.env.NODE_ENV,
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      LANG: process.env.LANG,
    };
    if (process.env.PLAYWRIGHT_BROWSERS_PATH) env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH;
    return { ...env, ...extra };
  }

  async inspect(input: InspectInput): Promise<InspectionResult> {
    const workDir = input.workDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "ptw-inspect-"));
    fs.mkdirSync(workDir, { recursive: true });
    await this.spawnEngine(["inspect", input.url], {
      cwd: workDir,
      env: this.restrictedEnv({ HEADLESS: "1", PROTOTYPE_URL: input.url }),
      // Generous: inspection now opens several screens past the landing page.
      timeoutMs: input.timeoutMs ?? 180_000,
      signal: input.signal,
      jobId: input.jobId,
    });
    const reportPath = path.join(workDir, "test-results", "inspection-report.txt");
    if (!fs.existsSync(reportPath)) throw new ExecutorError("Inspection produced no report.", "unknown");
    return parseInspectionReport(fs.readFileSync(reportPath, "utf8"), input.url);
  }

  async record(input: RecordInput): Promise<RecordResult> {
    fs.mkdirSync(input.workDir, { recursive: true });
    const args = ["record", input.scriptPath, "--url", input.url];
    if (input.pace) args.push("--pace", String(input.pace));
    const emit = input.onProgress ?? (() => {});

    await this.spawnEngine(args, {
      cwd: input.workDir,
      env: this.restrictedEnv({ HEADLESS: "1", PROTOTYPE_URL: input.url }),
      timeoutMs: input.timeoutMs ?? 300_000,
      signal: input.signal,
      jobId: input.jobId,
      onLine: (line) => {
        const s = scrub(line);
        if (/SECTION:/.test(line)) {
          emit({ phase: "recording", fraction: 0.6, message: line.replace(/.*SECTION:\s*/, "").trim(), log: s });
        } else if (/optimized|Optimizing|VP9/i.test(line)) {
          emit({ phase: "optimizing", fraction: 0.9, log: s });
        } else {
          emit({ phase: "recording", fraction: 0.6, log: s });
        }
      },
    });

    const videoPath = path.join(input.workDir, "output", `${input.outputBaseName}.webm`);
    if (!fs.existsSync(videoPath)) {
      throw new ExecutorError(
        `Recording did not produce ${input.outputBaseName}.webm`,
        classifyFailure(input.workDir)
      );
    }
    const optimized = path.join(input.workDir, "output", `${input.outputBaseName}.vp9.webm`);
    const metrics = probe(videoPath, input.viewport);
    return {
      videoPath,
      optimizedVideoPath: input.includeOptimizedCopy && fs.existsSync(optimized) ? optimized : undefined,
      posterPath: makePoster(videoPath, metrics.durationSeconds),
      scriptPath: input.scriptPath,
      diagnosticsDir: input.keepDiagnostics ? path.join(input.workDir, "test-results") : undefined,
      metrics,
    };
  }

  async preflight(input: PreflightInput): Promise<PreflightResult> {
    fs.mkdirSync(input.workDir, { recursive: true });
    // Exit code 3 means "ran fine, some steps failed" — that is a valid report,
    // not an engine error, so it is tolerated here.
    await this.spawnEngine(["preflight", input.scriptPath, "--url", input.url], {
      cwd: input.workDir,
      env: this.restrictedEnv({ HEADLESS: "1", PROTOTYPE_URL: input.url }),
      timeoutMs: input.timeoutMs ?? 180_000,
      signal: input.signal,
      jobId: input.jobId,
      okExitCodes: [0, 3],
    });

    const reportPath = path.join(input.workDir, "test-results", "preflight-report.json");
    if (!fs.existsSync(reportPath)) throw new ExecutorError("Preflight produced no report.", "unknown");
    return JSON.parse(fs.readFileSync(reportPath, "utf8")) as PreflightResult;
  }

  async cancel(jobId: string): Promise<void> {
    const child = this.children.get(jobId);
    if (!child) return;
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 3000);
  }

  private spawnEngine(args: string[], opts: SpawnOpts): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(this.nodeBin, [this.enginePath, ...args], {
        cwd: opts.cwd,
        env: opts.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (opts.jobId) this.children.set(opts.jobId, child);

      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
        if (opts.jobId) this.children.delete(opts.jobId);
        fn();
      };
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish(() => reject(new ExecutorError("Recording timed out.", "timeout")));
      }, opts.timeoutMs);
      const onAbort = () => {
        child.kill("SIGKILL");
        finish(() => reject(new ExecutorError("Canceled.", "canceled")));
      };
      if (opts.signal) {
        if (opts.signal.aborted) return onAbort();
        opts.signal.addEventListener("abort", onAbort);
      }

      const handle = (buf: Buffer) => {
        for (const raw of buf.toString().split("\n")) {
          const line = raw.replace(/\s+$/, "");
          if (line) opts.onLine?.(line);
        }
      };
      child.stdout?.on("data", handle);
      child.stderr?.on("data", handle);
      child.on("error", (e) => finish(() => reject(new ExecutorError(`Engine failed to start: ${e.message}`, "unknown"))));
      const ok = opts.okExitCodes ?? [0];
      child.on("close", (code) => {
        if (code !== null && ok.includes(code)) finish(() => resolve());
        else finish(() => reject(new ExecutorError(`Engine exited with code ${code}.`, "unknown")));
      });
    });
  }
}

/* ------------------------------------------------------------- parsing utils */

function extractBalancedJson(text: string, afterLabel: string): unknown | null {
  const i = text.indexOf(afterLabel);
  if (i < 0) return null;
  const start = text.indexOf("{", i);
  if (start < 0) return null;
  let depth = 0;
  for (let j = start; j < text.length; j++) {
    if (text[j] === "{") depth++;
    else if (text[j] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, j + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function firstMatch(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m ? m[1].trim() : undefined;
}

/** Pull the balanced JSON array that follows a label. */
function extractJsonArray(text: string, afterLabel: string): unknown[] {
  const i = text.indexOf(afterLabel);
  if (i < 0) return [];
  const start = text.indexOf("[", i);
  if (start < 0) return [];
  let depth = 0;
  let inString = false;
  for (let j = start; j < text.length; j++) {
    const ch = text[j];
    if (inString) {
      if (ch === "\\") j++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(start, j + 1));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

function toScreen(raw: unknown): ExploredScreen | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.label !== "string") return null;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    label: o.label,
    url: typeof o.url === "string" ? o.url : "",
    buttons: strings(o.buttons),
    links: strings(o.links),
    textboxes: strings(o.textboxes),
    tabs: strings(o.tabs),
    headings: strings(o.headings),
    imgAlts: strings(o.imgAlts),
  };
}

export function parseInspectionReport(text: string, url: string): InspectionResult {
  const classification = (extractBalancedJson(text, "classification:") ?? {}) as Record<string, unknown>;
  const elements = (extractBalancedJson(text, "accessible elements:") ?? {}) as Record<string, string[]>;
  const visibleText = (text.split(/visible text \(truncated\):/i)[1] ?? "").trim().slice(0, 2000);
  return {
    finalUrl: firstMatch(text, /final url:\s*(.+)/) ?? url,
    title: firstMatch(text, /title:\s*(.+)/) ?? "",
    elements: {
      buttons: elements.buttons ?? [],
      links: elements.links ?? [],
      textboxes: elements.textboxes ?? [],
      tabs: elements.tabs ?? [],
      headings: elements.headings ?? [],
      imgAlts: (elements as Record<string, string[]>).images ?? [],
    },
    screens: extractJsonArray(text, "===== EXPLORED SCREENS =====")
      .map(toScreen)
      .filter((s): s is ExploredScreen => s !== null),
    visibleText,
    requiresAuthGuess: Boolean(classification.looksLikeSSOorAuth),
    inIframe: Boolean(classification.prototypeInIframe),
    redirects: [],
  };
}

function probe(videoPath: string, viewport: { width: number; height: number }): RecordResult["metrics"] {
  let durationSeconds = 0;
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", videoPath],
      { encoding: "utf8" }
    ).trim();
    durationSeconds = Number(out) || 0;
  } catch {
    /* ffprobe optional */
  }
  return {
    durationSeconds,
    fileSizeBytes: fs.statSync(videoPath).size,
    width: viewport.width,
    height: viewport.height,
  };
}

function classifyFailure(workDir: string): ExecutorError["kind"] {
  try {
    const report = fs.readFileSync(path.join(workDir, "test-results", "failure-report.txt"), "utf8").toLowerCase();
    if (/no element|not visible|no visible target|could not locate/.test(report)) return "element_not_found";
    if (/sign in|login|sso|auth/.test(report)) return "requires_auth";
    if (/timeout|timed out/.test(report)) return "timeout";
    if (/net::|err_|navigation|reach/.test(report)) return "url_not_reachable";
    return "unexpected_state";
  } catch {
    return "unknown";
  }
}
