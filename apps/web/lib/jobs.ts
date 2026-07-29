/**
 * In-memory job store + in-process runner for the vertical slice.
 *
 * This is the "deterministic development adapter" the spec allows: it exercises
 * the real contracts, script-generation pipeline, and executor interface using
 * the FAKE providers, entirely inside the web server process — no Postgres,
 * Redis, or separate worker required. Phase 3 swaps these for Prisma + BullMQ +
 * a separate worker behind the same shapes.
 */
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  CreateJobInputSchema,
  STATUS_PROGRESS,
  STAGES,
  toPublicJob,
  viewportDims,
  targetSeconds,
  sanitizeFilename,
  type CreateJobInput,
  type ErrorCategory,
  type Job,
  type JobEvent,
  type JobStatus,
  type PublicJob,
  LIMITS,
} from "@ptw/job-contracts";
import {
  FakeAIProvider,
  generateValidatedScript,
  ScriptGenerationError,
  type ValidateOptions,
} from "@ptw/script-generator";
import { FakeExecutor, ExecutorError } from "@ptw/engine-adapter";
import { checkUrl } from "./ssrf";

/* --------------------------------------------------- process-wide singletons */

interface Store {
  jobs: Map<string, Job>;
  bus: EventEmitter;
  idempotency: Map<string, string>;
}

const g = globalThis as unknown as { __ptwStore?: Store };
const store: Store =
  g.__ptwStore ??
  (g.__ptwStore = { jobs: new Map(), bus: new EventEmitter(), idempotency: new Map() });
store.bus.setMaxListeners(0);

const STORAGE_ROOT = path.join(os.tmpdir(), "ptw-jobs");
fs.mkdirSync(STORAGE_ROOT, { recursive: true });

const ALLOWED_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
];

/* ----------------------------------------------------------------- helpers */

function now() {
  return new Date().toISOString();
}

function emit(job: Job, extra?: Partial<JobEvent>) {
  const stage = STAGES.find((s) => s.key === (job.status as string));
  const ev: JobEvent = {
    type: "status",
    status: job.status,
    progress: job.progress,
    stageLabel: stage?.label ?? job.status,
    stageMessage: stage?.message ?? "",
    at: now(),
    ...(extra as object),
  } as JobEvent;
  store.bus.emit(job.id, ev);
}

function setStatus(job: Job, status: JobStatus) {
  job.status = status;
  job.progress = STATUS_PROGRESS[status];
  store.jobs.set(job.id, job);
  emit(job);
}

function fail(job: Job, category: ErrorCategory, internal: string) {
  job.errorCategory = category;
  job.errorDetailInternal = internal;
  job.status = "FAILED";
  job.progress = 1;
  job.completedAt = now();
  store.jobs.set(job.id, job);
  store.bus.emit(job.id, { type: "error", category, at: now() } satisfies JobEvent);
}

/* -------------------------------------------------------------- public API */

export function getJob(id: string): Job | undefined {
  return store.jobs.get(id);
}

export function getPublicJob(id: string): PublicJob | undefined {
  const j = store.jobs.get(id);
  return j ? toPublicJob(j) : undefined;
}

export function subscribe(id: string, cb: (ev: JobEvent) => void): () => void {
  store.bus.on(id, cb);
  return () => store.bus.off(id, cb);
}

export function jobArtifactPath(id: string, kind: "video" | "script" | "optimized"): string | undefined {
  const j = store.jobs.get(id);
  if (!j) return undefined;
  if (kind === "video") return j.artifacts.videoKey;
  if (kind === "optimized") return j.artifacts.optimizedVideoKey;
  return j.artifacts.scriptKey;
}

export interface CreateResult {
  ok: boolean;
  job?: PublicJob;
  errors?: string[];
}

export function createJob(raw: unknown, ownerId: string): CreateResult {
  const parsed = CreateJobInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const input: CreateJobInput = parsed.data;

  const urlCheck = checkUrl(input.url);
  if (!urlCheck.ok) return { ok: false, errors: [urlCheck.reason ?? "URL is not allowed."] };

  // Idempotency: same key returns the existing job.
  if (input.idempotencyKey && store.idempotency.has(input.idempotencyKey)) {
    const existing = store.jobs.get(store.idempotency.get(input.idempotencyKey)!);
    if (existing) return { ok: true, job: toPublicJob(existing) };
  }

  const id = randomUUID();
  const job: Job = {
    id,
    ownerId,
    status: "QUEUED",
    progress: STATUS_PROGRESS.QUEUED,
    url: input.url,
    instructions: input.instructions,
    settings: input.settings,
    artifacts: {},
    metrics: {},
    createdAt: now(),
    retryCount: 0,
  };
  store.jobs.set(id, job);
  if (input.idempotencyKey) store.idempotency.set(input.idempotencyKey, id);

  // Fire-and-forget in-process run.
  void runJob(id);

  return { ok: true, job: toPublicJob(job) };
}

/* ------------------------------------------------------------- the pipeline */

async function runJob(id: string): Promise<void> {
  const job = store.jobs.get(id);
  if (!job) return;

  const ai = new FakeAIProvider();
  const executor = new FakeExecutor({ stepMs: 500 });
  const dims = viewportDims(job.settings);
  const workDir = path.join(STORAGE_ROOT, id);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    job.startedAt = now();
    setStatus(job, "PREPARING");
    await delay(400);

    // Inspect
    setStatus(job, "INSPECTING");
    const inspection = await executor.inspect({ url: job.url, viewport: dims });

    // Generate + validate + repair
    setStatus(job, "GENERATING_SCRIPT");
    const baseName = sanitizeFilename(job.settings.outputName || job.settings.title || "walkthrough");
    const validateOpts: ValidateOptions = {
      expectedUrl: job.url,
      allowedViewports: ALLOWED_VIEWPORTS,
      maxBytes: LIMITS.scriptBytesMax,
      maxSteps: LIMITS.scriptStepsMax,
    };
    const gen = await generateValidatedScript(
      ai,
      {
        url: job.url,
        instructions: job.instructions,
        viewport: dims,
        outputBaseName: baseName,
        targetSeconds: targetSeconds(job.settings),
        closeIgnore: job.settings.ignoreOverlayText,
        inspection: {
          finalUrl: inspection.finalUrl,
          title: inspection.title,
          elements: {
            buttons: inspection.elements.buttons,
            links: inspection.elements.links,
            textboxes: inspection.elements.textboxes,
            tabs: inspection.elements.tabs,
            headings: inspection.elements.headings,
          },
          requiresAuthGuess: inspection.requiresAuthGuess,
        },
      },
      validateOpts
    );

    setStatus(job, "VALIDATING_SCRIPT");
    const scriptPath = path.join(workDir, `${baseName}.md`);
    fs.writeFileSync(scriptPath, gen.script);
    job.artifacts.scriptKey = scriptPath;
    job.metrics.modelTokensIn = gen.tokensIn;
    job.metrics.modelTokensOut = gen.tokensOut;
    await delay(300);

    // Record
    setStatus(job, "RECORDING");
    const rec = await executor.record({
      workDir,
      scriptPath,
      url: job.url,
      viewport: dims,
      outputBaseName: baseName,
      includeOptimizedCopy: job.settings.includeOptimizedCopy,
      keepDiagnostics: job.settings.keepDiagnostics,
      pace: undefined,
      onProgress: (e) => {
        if (e.phase === "optimizing" && job.status !== "OPTIMIZING") setStatus(job, "OPTIMIZING");
        if (e.log) store.bus.emit(job.id, { type: "log", line: e.log, at: now() } satisfies JobEvent);
      },
    });

    setStatus(job, "UPLOADING");
    job.artifacts.videoKey = rec.videoPath;
    job.artifacts.optimizedVideoKey = rec.optimizedVideoPath;
    job.metrics.durationSeconds = rec.metrics.durationSeconds;
    job.metrics.fileSizeBytes = rec.metrics.fileSizeBytes;
    job.metrics.width = rec.metrics.width;
    job.metrics.height = rec.metrics.height;
    await delay(300);

    job.status = "COMPLETED";
    job.progress = 1;
    job.completedAt = now();
    store.jobs.set(job.id, job);
    store.bus.emit(job.id, { type: "done", job: toPublicJob(job), at: now() } satisfies JobEvent);
  } catch (err) {
    if (err instanceof ScriptGenerationError) return fail(job, "INVALID_SCRIPT", err.validationErrors.join("; "));
    if (err instanceof ExecutorError) {
      const map: Record<string, ErrorCategory> = {
        url_not_reachable: "URL_NOT_REACHABLE",
        requires_auth: "REQUIRES_AUTH",
        blocked: "BLOCKED_AUTOMATION",
        element_not_found: "ELEMENT_NOT_FOUND",
        unexpected_state: "UNEXPECTED_STATE",
        timeout: "RECORDING_TIMEOUT",
        encoding: "ENCODING_FAILED",
        canceled: "CANCELED",
        unknown: "UNKNOWN",
      };
      return fail(job, map[err.kind] ?? "UNKNOWN", err.message);
    }
    return fail(job, "UNKNOWN", err instanceof Error ? err.message : String(err));
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
