/**
 * Preflight: check that a walkthrough script actually resolves against the live
 * prototype before spending a full recording on it, and repair it when it
 * doesn't. Runs the same executor and validation the pipeline uses, so a clean
 * preflight is a strong signal that `record` will succeed.
 *
 * A script may be supplied directly (the fast path used when re-running a known
 * good script); otherwise one is generated from the brief. Either way the final
 * script is returned so the caller can save and reuse it.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  LIMITS,
  PreflightInputSchema,
  sanitizeFilename,
  targetSeconds,
  viewportDims,
  type PreflightInput,
} from "@ptw/job-contracts";
import { getExecutor, type InspectionResult, type PreflightResult } from "@ptw/engine-adapter";
import {
  generateValidatedScript,
  getAIProvider,
  validateScript,
  type AIProvider,
  type GenerateScriptInput,
  type PreflightFailure,
  type ValidateOptions,
} from "@ptw/script-generator";
import { ALLOWED_VIEWPORTS, log } from "./config";
import { checkUrl } from "./ssrf";

/** Repair rounds are a live browser run plus a model call each — keep it small. */
const MAX_REPAIRS = 2;

export interface PreflightOutcome {
  ok: boolean;
  errors?: string[];
  /** The script that was checked — save this to re-run the exact same journey. */
  script?: string;
  /** True when the script was written by the model during this call. */
  generated?: boolean;
  /** How many repair rounds ran (0 when the first check was already clean). */
  repairs?: number;
  /** Steps that failed before repair, when repair improved things. */
  repairedFrom?: number;
  report?: PreflightResult;
}

export async function runPreflight(raw: unknown): Promise<PreflightOutcome> {
  const parsed = PreflightInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const input: PreflightInput = parsed.data;

  const allowlist = (process.env.URL_ALLOWLIST || "").split(",").map((s) => s.trim()).filter(Boolean);
  const urlCheck = checkUrl(input.url, allowlist);
  if (!urlCheck.ok) return { ok: false, errors: [urlCheck.reason ?? "URL is not allowed."] };

  const dims = viewportDims(input.settings);
  const baseName = sanitizeFilename(input.settings.outputName || input.settings.title || "walkthrough");
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptw-preflight-"));
  const runId = randomUUID();
  const scriptPath = path.join(workDir, `${baseName}.md`);

  const validateOpts: ValidateOptions = {
    expectedUrl: input.url,
    allowedViewports: ALLOWED_VIEWPORTS,
    maxBytes: LIMITS.scriptBytesMax,
    maxSteps: LIMITS.scriptStepsMax,
  };

  try {
    const executor = await getExecutor();
    let ai: AIProvider | undefined;
    let inspection: InspectionResult | undefined;
    let script: string;
    let generated = false;

    if (input.script?.trim()) {
      const checked = validateScript(input.script, validateOpts);
      if (!checked.ok) return { ok: false, errors: checked.errors, script: input.script };
      script = input.script;
    } else {
      ai = await getAIProvider();
      inspection = await executor.inspect({ url: input.url, viewport: dims, workDir, jobId: runId });
      const gen = await generateValidatedScript(
        ai,
        generateInput(input, inspection, dims, baseName),
        validateOpts
      );
      script = gen.script;
      generated = true;
    }

    let repairs = 0;
    let repairedFrom = 0;
    let report: PreflightResult;

    for (;;) {
      fs.writeFileSync(scriptPath, script);
      report = await executor.preflight({
        workDir,
        scriptPath,
        url: input.url,
        viewport: dims,
        jobId: runId,
      });
      log("preflight", `${runId} round ${repairs}: ${report.okCount}/${report.checkedSteps} ok`);

      if (report.failedCount === 0 || !input.repair || repairs >= MAX_REPAIRS) break;

      if (!ai) {
        // Repairing a hand-supplied script still needs a model and the page context.
        ai = await getAIProvider();
        inspection = await executor
          .inspect({ url: input.url, viewport: dims, workDir, jobId: runId })
          .catch(() => undefined);
      }
      if (repairs === 0) repairedFrom = report.failedCount;

      const repaired = await repairScript(
        ai,
        generateInput(input, inspection, dims, baseName),
        script,
        report,
        validateOpts
      );
      if (!repaired) break;
      script = repaired;
      repairs++;
    }

    return {
      ok: true,
      script,
      generated,
      repairs,
      repairedFrom: repairs > 0 ? repairedFrom : undefined,
      report,
    };
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

function generateInput(
  input: PreflightInput,
  inspection: InspectionResult | undefined,
  dims: { width: number; height: number },
  baseName: string
): GenerateScriptInput {
  return {
    url: input.url,
    instructions: input.instructions,
    viewport: dims,
    outputBaseName: baseName,
    targetSeconds: targetSeconds(input.settings),
    closeIgnore: input.settings.ignoreOverlayText,
    inspection: inspection && {
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
  };
}

/**
 * Ask the model to rewrite only the steps that failed the dry run, then insist
 * the result still validates. Returns undefined when no usable repair came back.
 */
async function repairScript(
  ai: AIProvider,
  base: GenerateScriptInput,
  script: string,
  report: PreflightResult,
  validateOpts: ValidateOptions
): Promise<string | undefined> {
  const failures: PreflightFailure[] = report.results
    .filter((r) => r.status === "failed")
    .map((r) => ({ step: r.raw, error: r.error ?? "not found", suggestions: r.suggestions ?? [] }));
  if (!failures.length) return undefined;

  const res = await ai
    .generateScript({ ...base, previousScript: script, preflightFailures: failures })
    .catch(() => undefined);
  if (!res) return undefined;

  const checked = validateScript(res.script, validateOpts);
  if (!checked.ok) {
    log("preflight", `repair produced an invalid script: ${checked.errors[0] ?? "unknown"}`);
    return undefined;
  }
  // An identical script would just burn another round.
  return res.script.trim() === script.trim() ? undefined : res.script;
}
