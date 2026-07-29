/**
 * Generate → validate → repair pipeline. The model never runs; it only
 * proposes a script, which is deterministically validated. On failure we feed
 * the exact errors back for at most two repair attempts, then fail gracefully.
 */
import type { AIProvider, GenerateScriptInput } from "./provider";
import { validateScript, type ValidateOptions, type ScriptMeta } from "./validate";

export class ScriptGenerationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: string[],
    public readonly lastScript?: string
  ) {
    super(message);
    this.name = "ScriptGenerationError";
  }
}

export interface GeneratePipelineResult {
  script: string;
  meta: ScriptMeta;
  attempts: number;
  tokensIn: number;
  tokensOut: number;
}

export async function generateValidatedScript(
  provider: AIProvider,
  input: GenerateScriptInput,
  validateOpts: ValidateOptions,
  maxRepairs = 2
): Promise<GeneratePipelineResult> {
  let attempt = 0;
  let previousScript: string | undefined;
  let lastErrors: string[] = [];
  let tokensIn = 0;
  let tokensOut = 0;

  while (attempt <= maxRepairs) {
    const res = await provider.generateScript({
      ...input,
      previousScript,
      validationErrors: lastErrors.length ? lastErrors : undefined,
    });
    tokensIn += res.tokensIn ?? 0;
    tokensOut += res.tokensOut ?? 0;

    const v = validateScript(res.script, validateOpts);
    if (v.ok) {
      return { script: res.script, meta: v.meta, attempts: attempt + 1, tokensIn, tokensOut };
    }
    previousScript = res.script;
    lastErrors = v.errors;
    attempt++;
  }

  throw new ScriptGenerationError(
    "The generated walkthrough did not pass validation after repair attempts.",
    lastErrors,
    previousScript
  );
}
