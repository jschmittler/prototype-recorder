/**
 * LocalProcessExecutor — the real recorder adapter. It runs the external
 * figma-walkthrough engine as a child process (its own Chromium/Playwright/
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
  type InspectInput,
  type InspectionResult,
  type RecordInput,
  type RecordResult,
  type WalkthroughExecutor,
} from "./index";

export interface LocalExecutorOptions {
  /** Path to a figma-walkthrough checkout or install (contains bin/). */
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
}

export class LocalProcessExecutor implements WalkthroughExecutor {
  private children = new Map<string, ChildProcess>();
  private enginePath: string;
  private nodeBin: string;

  constructor(opts: LocalExecutorOptions) {
    this.enginePath = path.join(opts.engineDir, "bin", "figma-walkthrough.mjs");
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
      timeoutMs: input.timeoutMs ?? 90_000,
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
    return {
      videoPath,
      optimizedVideoPath: input.includeOptimizedCopy && fs.existsSync(optimized) ? optimized : undefined,
      scriptPath: input.scriptPath,
      diagnosticsDir: input.keepDiagnostics ? path.join(input.workDir, "test-results") : undefined,
      metrics: probe(videoPath, input.viewport),
    };
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
      child.on("close", (code) => {
        if (code === 0) finish(() => resolve());
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
