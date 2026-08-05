/**
 * The job pipeline, shared by the in-process runner (web) and the worker.
 * Uses the JobStore + Storage abstractions and the executor/AI factories.
 * Progress is persisted to the store (the web SSE endpoint polls it), so this
 * works identically whether it runs in the web process or a separate worker.
 */
import fs from "node:fs";
import path from "node:path";
import {
  STATUS_PROGRESS,
  toPublicJob,
  viewportDims,
  targetSeconds,
  sanitizeFilename,
  PACING,
  LIMITS,
  type ErrorCategory,
  type Job,
  type JobStatus,
} from "@ptw/job-contracts";
import { getExecutor, ExecutorError } from "@ptw/engine-adapter";
import {
  getAIProvider,
  generateValidatedScript,
  ScriptGenerationError,
  validateScript,
  withOutputName,
  type ValidateOptions,
} from "@ptw/script-generator";
import { ALLOWED_VIEWPORTS, LOG_TAIL_MAX, WORKDIR_ROOT, log } from "./config";
import type { JobStore } from "./store";
import type { Storage } from "./storage";

export interface PipelineDeps {
  store: JobStore;
  storage: Storage;
}

const now = () => new Date().toISOString();

export async function runPipeline(jobId: string, deps: PipelineDeps): Promise<void> {
  const { store, storage } = deps;
  const job = await store.get(jobId);
  if (!job) return;

  const logTail: string[] = job.logTail ? [...job.logTail] : [];
  const pushLog = async (line: string) => {
    logTail.push(line);
    while (logTail.length > LOG_TAIL_MAX) logTail.shift();
    await store.update(jobId, { logTail: [...logTail] });
  };
  const setStatus = async (status: JobStatus) => {
    await store.update(jobId, { status, progress: STATUS_PROGRESS[status] });
    log("pipeline", `${jobId} -> ${status}`);
  };
  const fail = async (category: ErrorCategory, internal: string) => {
    await store.update(jobId, {
      status: "FAILED",
      progress: 1,
      errorCategory: category,
      errorDetailInternal: internal.slice(0, 2000),
      completedAt: now(),
      logTail: [...logTail],
    });
    log("pipeline", `${jobId} FAILED (${category}): ${internal.slice(0, 300)}`);
  };

  const dims = viewportDims(job.settings);
  const workDir = path.join(WORKDIR_ROOT, jobId);
  fs.mkdirSync(workDir, { recursive: true });
  const baseName = sanitizeFilename(job.settings.outputName || job.settings.title || "walkthrough");

  try {
    await store.update(jobId, { startedAt: now() });
    await setStatus("PREPARING");

    const executor = await getExecutor();
    const validateOpts: ValidateOptions = {
      expectedUrl: job.url,
      allowedViewports: ALLOWED_VIEWPORTS,
      maxBytes: LIMITS.scriptBytesMax,
      maxSteps: LIMITS.scriptStepsMax,
    };

    let gen: { script: string; tokensIn?: number; tokensOut?: number };

    if (job.scriptOverride?.trim()) {
      await setStatus("VALIDATING_SCRIPT");
      const checked = validateScript(job.scriptOverride, validateOpts);
      if (!checked.ok) {
        throw new ScriptGenerationError(
          "The supplied walkthrough script did not pass validation.",
          checked.errors,
          job.scriptOverride
        );
      }
      gen = { script: job.scriptOverride, tokensIn: 0, tokensOut: 0 };
    } else {
      const ai = await getAIProvider();

      await setStatus("INSPECTING");
      const inspection = await executor.inspect({ url: job.url, viewport: dims, workDir, jobId });

      await setStatus("GENERATING_SCRIPT");
      gen = await generateValidatedScript(
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
              imgAlts: inspection.elements.imgAlts,
            },
            screens: inspection.screens.map((s) => ({
              label: s.label,
              buttons: s.buttons,
              links: s.links,
              textboxes: s.textboxes,
              tabs: s.tabs,
              headings: s.headings,
              imgAlts: s.imgAlts,
            })),
            requiresAuthGuess: inspection.requiresAuthGuess,
          },
        },
        validateOpts
      );
    }

    await setStatus("VALIDATING_SCRIPT");
    const scriptPath = path.join(workDir, `${baseName}.md`);
    // Pin the engine's output name to this job's, so a reused script recorded
    // under a different title still lands where the upload step looks for it.
    const script = withOutputName(gen.script, baseName);
    fs.writeFileSync(scriptPath, script);
    const scriptKey = `${jobId}/${baseName}.md`;
    await storage.putFile(scriptKey, scriptPath, "text/markdown; charset=utf-8");

    await setStatus("RECORDING");
    const rec = await executor.record({
      workDir,
      scriptPath,
      url: job.url,
      viewport: dims,
      outputBaseName: baseName,
      includeOptimizedCopy: job.settings.includeOptimizedCopy,
      keepDiagnostics: job.settings.keepDiagnostics,
      pace: PACING[job.settings.pacing].pace,
      jobId,
      onProgress: (e) => {
        if (e.phase === "optimizing") void setStatus("OPTIMIZING");
        if (e.log) void pushLog(e.log);
      },
    });

    await setStatus("UPLOADING");
    const videoKey = `${jobId}/${baseName}.webm`;
    await storage.putFile(videoKey, rec.videoPath, "video/webm");
    let optimizedVideoKey: string | undefined;
    if (rec.optimizedVideoPath) {
      optimizedVideoKey = `${jobId}/${baseName}.vp9.webm`;
      await storage.putFile(optimizedVideoKey, rec.optimizedVideoPath, "video/webm");
    }
    let posterKey: string | undefined;
    if (rec.posterPath) {
      posterKey = `${jobId}/${baseName}.poster.jpg`;
      await storage.putFile(posterKey, rec.posterPath, "image/jpeg");
    }

    const done = await store.update(jobId, {
      status: "COMPLETED",
      progress: 1,
      completedAt: now(),
      artifacts: { scriptKey, videoKey, optimizedVideoKey, posterKey },
      metrics: {
        durationSeconds: rec.metrics.durationSeconds,
        fileSizeBytes: rec.metrics.fileSizeBytes,
        width: rec.metrics.width,
        height: rec.metrics.height,
        modelTokensIn: gen.tokensIn,
        modelTokensOut: gen.tokensOut,
      },
      logTail: [...logTail],
    });
    log("pipeline", `${jobId} COMPLETED (${toPublicJob(done).metrics.durationSeconds}s)`);
  } catch (err) {
    if (err instanceof Error && /OPENAI_API_KEY|not configured/i.test(err.message))
      return fail("SERVICE_CONFIG", err.message);
    if (err instanceof ScriptGenerationError) return fail("INVALID_SCRIPT", err.validationErrors.join("; "));
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
      return fail(map[err.kind] ?? "UNKNOWN", err.message);
    }
    return fail("UNKNOWN", err instanceof Error ? err.message : String(err));
  }
}

/** Unused re-export guard so `Job` import isn't flagged when tree-shaking. */
export type { Job };
