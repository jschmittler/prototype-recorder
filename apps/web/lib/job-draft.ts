import type { JobSettings, PublicJob } from "@ptw/job-contracts";

type ViewportKey = "desktop" | "laptop" | "mobile";

/** Form state restored when retrying from a previous job. */
export interface CreateFormDraft {
  url: string;
  instructions: string;
  title: string;
  durationTarget: string;
  viewport: ViewportKey;
  pacing: string;
  outputName: string;
  includeOptimizedCopy: boolean;
  keepDiagnostics: boolean;
  ignoreOverlayText: string[];
  script: string;
}

const VIEWPORT_KEYS: Record<ViewportKey, true> = { desktop: true, laptop: true, mobile: true };

export function draftFromPublicJob(job: PublicJob, script = ""): CreateFormDraft {
  const s = job.settings;
  const viewport: ViewportKey = s.viewport in VIEWPORT_KEYS ? s.viewport : "desktop";
  return {
    url: job.url,
    instructions: job.instructions,
    title: job.title ?? s.title ?? "",
    durationTarget: s.durationTarget ?? "auto",
    viewport,
    pacing: s.pacing ?? "standard",
    outputName: s.outputName ?? "",
    includeOptimizedCopy: s.includeOptimizedCopy ?? true,
    keepDiagnostics: s.keepDiagnostics ?? false,
    ignoreOverlayText: s.ignoreOverlayText ?? [],
    script,
  };
}

export function settingsFromDraft(draft: Pick<CreateFormDraft, "title" | "durationTarget" | "viewport" | "pacing" | "outputName" | "includeOptimizedCopy" | "keepDiagnostics" | "ignoreOverlayText">): JobSettings {
  return {
    title: draft.title.trim() || undefined,
    durationTarget: draft.durationTarget as JobSettings["durationTarget"],
    viewport: draft.viewport,
    pacing: draft.pacing as JobSettings["pacing"],
    outputName: draft.outputName.trim() || undefined,
    includeOptimizedCopy: draft.includeOptimizedCopy,
    keepDiagnostics: draft.keepDiagnostics,
    ignoreOverlayText: draft.ignoreOverlayText,
  };
}
