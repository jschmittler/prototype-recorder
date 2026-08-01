/**
 * @ptw/engine-adapter — the boundary between the job worker and the actual
 * recording engine (prototype-recorder-cli).
 *
 * `WalkthroughExecutor` is the seam the spec calls for: a local-process adapter
 * is used first and a container-per-job adapter can be added later without
 * touching job logic. This package ships the interface, shared types, and a
 * deterministic `FakeExecutor` used by the vertical slice and by tests. The
 * real `LocalProcessExecutor` (spawning the engine's inspect/record) lands in
 * Phase 3.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { makePoster } from "./poster";

/* --------------------------------------------------------------------- types */

export interface AccessibleElements {
  buttons: string[];
  links: string[];
  textboxes: string[];
  tabs: string[];
  headings: string[];
  imgAlts: string[];
}

/** A screen reached by clicking a primary nav control on the landing page. */
export interface ExploredScreen {
  /** The control that was clicked to get here. */
  label: string;
  url: string;
  buttons: string[];
  links: string[];
  textboxes: string[];
  tabs: string[];
  headings: string[];
  imgAlts: string[];
}

export interface InspectionResult {
  finalUrl: string;
  title: string;
  elements: AccessibleElements;
  /** Screens beyond the landing page, so later steps aren't authored blind. */
  screens: ExploredScreen[];
  visibleText: string;
  /** Heuristic: the page looks like it redirected to a login/SSO screen. */
  requiresAuthGuess: boolean;
  /** Heuristic: the prototype renders inside a cross-origin iframe. */
  inIframe: boolean;
  redirects: string[];
  screenshotPath?: string;
}

export interface InspectInput {
  url: string;
  viewport: { width: number; height: number };
  /** Isolated working directory (the engine writes its report here). */
  workDir?: string;
  jobId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface RecordInput {
  /** Isolated per-job working directory (owns output/ and test-results/). */
  workDir: string;
  /** Absolute path to the validated script.md written into workDir. */
  scriptPath: string;
  url: string;
  viewport: { width: number; height: number };
  outputBaseName: string;
  includeOptimizedCopy: boolean;
  keepDiagnostics: boolean;
  pace?: number;
  jobId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (evt: ExecutorProgress) => void;
}

export interface RecordResult {
  videoPath: string;
  optimizedVideoPath?: string;
  /** Representative frame for thumbnails. Absent when ffmpeg is unavailable. */
  posterPath?: string;
  scriptPath: string;
  diagnosticsDir?: string;
  metrics: { durationSeconds: number; fileSizeBytes: number; width: number; height: number };
}

export interface PreflightInput {
  workDir: string;
  /** Absolute path to the validated script.md written into workDir. */
  scriptPath: string;
  url: string;
  viewport: { width: number; height: number };
  jobId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface PreflightStepResult {
  section: string;
  line: number;
  verb: string;
  raw: string;
  status: "ok" | "failed" | "skipped";
  cascaded?: boolean;
  error?: string;
  suggestions?: string[];
}

export interface PreflightResult {
  url: string;
  finalUrl: string;
  totalSteps: number;
  checkedSteps: number;
  okCount: number;
  failedCount: number;
  durationSeconds: number;
  results: PreflightStepResult[];
}

export interface ExecutorProgress {
  /** Coarse phase for mapping to job status. */
  phase: "inspecting" | "recording" | "optimizing";
  /** 0..1 within the record()/inspect() call. */
  fraction: number;
  message?: string;
  /** Optional already-scrubbed log line. */
  log?: string;
}

export class ExecutorError extends Error {
  constructor(
    message: string,
    /** Maps to a friendly ErrorCategory upstream. */
    public readonly kind:
      | "url_not_reachable"
      | "requires_auth"
      | "blocked"
      | "element_not_found"
      | "unexpected_state"
      | "timeout"
      | "encoding"
      | "canceled"
      | "unknown" = "unknown"
  ) {
    super(message);
    this.name = "ExecutorError";
  }
}

export interface WalkthroughExecutor {
  inspect(input: InspectInput): Promise<InspectionResult>;
  record(input: RecordInput): Promise<RecordResult>;
  /** Dry-run a script against the live page (no video) to verify every target. */
  preflight(input: PreflightInput): Promise<PreflightResult>;
  cancel(jobId: string): Promise<void>;
}

/* --------------------------------------------------------------- fake adapter */

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new ExecutorError("canceled", "canceled"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new ExecutorError("canceled", "canceled"));
    });
  });

/**
 * Deterministic executor for local development, the vertical slice, and tests.
 * It emits realistic staged progress and, when ffmpeg is available, synthesizes
 * a short genuinely-previewable WebM so the result page shows real media.
 */
export class FakeExecutor implements WalkthroughExecutor {
  constructor(private opts: { stepMs?: number; ffmpegPath?: string } = {}) {}

  async inspect(input: InspectInput): Promise<InspectionResult> {
    const step = this.opts.stepMs ?? 250;
    await sleep(step, input.signal);
    return {
      finalUrl: input.url,
      title: "Example prototype",
      elements: {
        buttons: ["Sign In", "Products", "Learn", "Community", "Search"],
        links: [],
        textboxes: ["Search"],
        tabs: ["Overview", "Benefits", "Usage"],
        headings: ["Welcome", "Explore products"],
        imgAlts: ["Logo"],
      },
      screens: [
        {
          label: "Products",
          url: `${input.url}#products`,
          buttons: ["Manage", "Compare"],
          links: [],
          textboxes: [],
          tabs: ["Overview", "Benefits"],
          headings: ["Products"],
          imgAlts: [],
        },
      ],
      visibleText: "Welcome. Sign In. Products. Learn. Community.",
      requiresAuthGuess: false,
      inIframe: false,
      redirects: [],
    };
  }

  async preflight(input: PreflightInput): Promise<PreflightResult> {
    await sleep(this.opts.stepMs ?? 250, input.signal);
    const steps = fs.existsSync(input.scriptPath)
      ? fs
          .readFileSync(input.scriptPath, "utf8")
          .split("\n")
          .map((l, i) => ({ text: l.trim(), line: i + 1 }))
          .filter((l) => /^[-*]\s+\S/.test(l.text))
      : [];
    const results: PreflightStepResult[] = steps.map(({ text, line }) => {
      const raw = text.replace(/^[-*]\s+/, "");
      return { section: "Walkthrough", line, verb: raw.split(/\s+/)[0], raw, status: "ok" as const };
    });
    return {
      url: input.url,
      finalUrl: input.url,
      totalSteps: results.length,
      checkedSteps: results.length,
      okCount: results.length,
      failedCount: 0,
      durationSeconds: 0.3,
      results,
    };
  }

  async record(input: RecordInput): Promise<RecordResult> {
    const step = this.opts.stepMs ?? 400;
    const emit = input.onProgress ?? (() => {});
    const outputDir = path.join(input.workDir, "output");
    fs.mkdirSync(outputDir, { recursive: true });

    for (let i = 1; i <= 5; i++) {
      await sleep(step, input.signal);
      emit({ phase: "recording", fraction: i / 6, message: `Recording section ${i} of 5`, log: `section ${i} ok` });
    }
    emit({ phase: "optimizing", fraction: 0.9, message: "Encoding video" });

    const videoPath = path.join(outputDir, `${input.outputBaseName}.webm`);
    const durationSeconds = 6;
    const made = synthesizeWebm(videoPath, input.viewport, input.outputBaseName, durationSeconds, this.opts.ffmpegPath);
    if (!made) {
      // No ffmpeg available: write a small placeholder so downstream flow still works.
      fs.writeFileSync(videoPath, Buffer.from("FAKE-WEBM-PLACEHOLDER\n"));
    }
    await sleep(step, input.signal);

    let optimizedVideoPath: string | undefined;
    if (input.includeOptimizedCopy && made) {
      optimizedVideoPath = path.join(outputDir, `${input.outputBaseName}.vp9.webm`);
      fs.copyFileSync(videoPath, optimizedVideoPath);
    }

    return {
      videoPath,
      optimizedVideoPath,
      posterPath: made ? makePoster(videoPath, durationSeconds, this.opts.ffmpegPath) : undefined,
      scriptPath: input.scriptPath,
      diagnosticsDir: input.keepDiagnostics ? path.join(input.workDir, "test-results") : undefined,
      metrics: {
        durationSeconds,
        fileSizeBytes: fs.statSync(videoPath).size,
        width: input.viewport.width,
        height: input.viewport.height,
      },
    };
  }

  async cancel(): Promise<void> {
    /* AbortSignal handles cancellation for the fake executor. */
  }
}

/** Best-effort short test clip via ffmpeg; returns true if it produced a file. */
function synthesizeWebm(
  outPath: string,
  viewport: { width: number; height: number },
  label: string,
  seconds: number,
  ffmpegPath = "ffmpeg"
): boolean {
  try {
    const res = spawnSync(
      ffmpegPath,
      [
        "-y",
        "-f", "lavfi",
        "-i", `testsrc=size=${viewport.width}x${viewport.height}:rate=25:duration=${seconds}`,
        "-c:v", "libvpx-vp9",
        "-b:v", "0",
        "-crf", "34",
        "-pix_fmt", "yuv420p",
        "-an",
        outPath,
      ],
      { stdio: "ignore" }
    );
    void label;
    return res.status === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch {
    return false;
  }
}


/* ------------------------------------------------------------- executor factory */

/**
 * Select the executor from the environment:
 *   EXECUTOR=local-process  → real engine (requires ENGINE_DIR)
 *   otherwise               → FakeExecutor (default; used by the slice + tests)
 * The local executor is imported lazily to avoid a module cycle.
 */
function resolveEngineDir(): string | undefined {
  const hasEngine = (dir: string) => fs.existsSync(path.join(dir, "bin", "prototype-recorder-cli.mjs"));

  if (process.env.ENGINE_DIR?.trim()) {
    const configured = path.resolve(process.env.ENGINE_DIR.trim());
    return hasEngine(configured) ? configured : undefined;
  }

  const candidates = [
    path.resolve(process.cwd(), "packages/recorder-cli"),
    path.resolve(process.cwd(), "../packages/recorder-cli"),
    path.resolve(process.cwd(), "../../packages/recorder-cli"),
  ];
  try {
    const req = createRequire(import.meta.url);
    candidates.push(path.dirname(req.resolve("prototype-recorder-cli/package.json")));
  } catch {
    /* require.resolve may be unavailable under bundlers */
  }
  return candidates.find(hasEngine);
}

export async function getExecutor(): Promise<WalkthroughExecutor> {
  if ((process.env.EXECUTOR ?? "fake") === "local-process") {
    const engineDir = resolveEngineDir();
    if (!engineDir) {
      if ((process.env.APP_MODE ?? "demo") === "demo") {
        console.warn(
          "[engine-adapter] EXECUTOR=local-process but prototype-recorder-cli is unavailable; " +
            "using FakeExecutor for demo. Hostinger/shared hosts cannot run Playwright — " +
            "set EXECUTOR=fake or use a Docker worker for real recordings.",
        );
        return new FakeExecutor({ stepMs: 500 });
      }
      throw new ExecutorError(
        "Could not locate prototype-recorder-cli; set ENGINE_DIR or EXECUTOR=fake.",
        "unknown",
      );
    }
    const { LocalProcessExecutor } = await import("./local");
    return new LocalProcessExecutor({ engineDir });
  }
  return new FakeExecutor({ stepMs: 500 });
}
