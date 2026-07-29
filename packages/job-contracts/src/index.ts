/**
 * @ptw/job-contracts — the single source of truth for the shapes that cross the
 * web ↔ queue ↔ worker boundary. Everything here is framework-agnostic and
 * zod-validated so the same definitions guard client input, API handlers, the
 * queue payload, and the worker.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ statuses */

/** Persisted job status (drives DB + high-level lifecycle). */
export const JOB_STATUSES = [
  "DRAFT",
  "QUEUED",
  "PREPARING",
  "INSPECTING",
  "GENERATING_SCRIPT",
  "VALIDATING_SCRIPT",
  "RECORDING",
  "OPTIMIZING",
  "UPLOADING",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "EXPIRED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const TERMINAL_STATUSES: JobStatus[] = ["COMPLETED", "FAILED", "CANCELED", "EXPIRED"];
export const isTerminal = (s: JobStatus) => TERMINAL_STATUSES.includes(s);

/** User-facing progress stages, in display order, with friendly copy. */
export const STAGES = [
  { key: "QUEUED", label: "Queued", message: "Your walkthrough is in line." },
  { key: "PREPARING", label: "Preparing workspace", message: "Setting up an isolated workspace." },
  { key: "INSPECTING", label: "Inspecting prototype", message: "Opening your prototype and reading its structure." },
  { key: "GENERATING_SCRIPT", label: "Creating walkthrough script", message: "Turning your description into a walkthrough." },
  { key: "VALIDATING_SCRIPT", label: "Validating script", message: "Double-checking every step is safe and supported." },
  { key: "RECORDING", label: "Recording walkthrough", message: "Driving the prototype with a smooth on-screen cursor." },
  { key: "OPTIMIZING", label: "Optimizing video", message: "Encoding a high-quality video." },
  { key: "UPLOADING", label: "Finalizing download", message: "Preparing your download." },
  { key: "COMPLETED", label: "Complete", message: "Your walkthrough is ready." },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];

/** Fraction (0..1) representing overall progress when a status begins. */
export const STATUS_PROGRESS: Record<JobStatus, number> = {
  DRAFT: 0,
  QUEUED: 0.02,
  PREPARING: 0.08,
  INSPECTING: 0.2,
  GENERATING_SCRIPT: 0.38,
  VALIDATING_SCRIPT: 0.5,
  RECORDING: 0.6,
  OPTIMIZING: 0.85,
  UPLOADING: 0.95,
  COMPLETED: 1,
  FAILED: 1,
  CANCELED: 1,
  EXPIRED: 1,
};

/* ---------------------------------------------------------------- viewports */

export const VIEWPORTS = {
  desktop: { label: "Desktop", width: 1440, height: 900 },
  laptop: { label: "Laptop", width: 1280, height: 800 },
  mobile: { label: "Mobile", width: 390, height: 844 },
} as const;
export type ViewportKey = keyof typeof VIEWPORTS;

export const PACING = {
  relaxed: { label: "Relaxed", pace: 1.25 },
  standard: { label: "Standard", pace: 1.0 },
  fast: { label: "Fast", pace: 0.8 },
} as const;
export type PacingKey = keyof typeof PACING;

export const DURATION_TARGETS = ["auto", "30", "60", "90", "custom"] as const;
export type DurationTarget = (typeof DURATION_TARGETS)[number];

/* ------------------------------------------------------------------- limits */

export const LIMITS = {
  instructionsMin: 10,
  instructionsMax: 4000,
  titleMax: 120,
  scriptBytesMax: 20_000,
  scriptStepsMax: 120,
  customSecondsMin: 15,
  customSecondsMax: 180,
  ignoreOverlayItemsMax: 10,
} as const;

/* ------------------------------------------------------------------ settings */

export const JobSettingsSchema = z.object({
  title: z.string().trim().max(LIMITS.titleMax).optional(),
  durationTarget: z.enum(DURATION_TARGETS).default("auto"),
  customSeconds: z.number().int().min(LIMITS.customSecondsMin).max(LIMITS.customSecondsMax).optional(),
  viewport: z.enum(["desktop", "laptop", "mobile"]).default("desktop"),
  pacing: z.enum(["relaxed", "standard", "fast"]).default("standard"),
  // advanced
  outputName: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-zA-Z0-9 _-]*$/, "Only letters, numbers, spaces, dashes and underscores")
    .optional(),
  includeOptimizedCopy: z.boolean().default(true),
  keepDiagnostics: z.boolean().default(false),
  ignoreOverlayText: z.array(z.string().trim().min(1).max(80)).max(LIMITS.ignoreOverlayItemsMax).default([]),
});
export type JobSettings = z.infer<typeof JobSettingsSchema>;

/* --------------------------------------------------------------- create input */

/** Base URL shape check; deep SSRF checks live in the security package. */
export const SubmittedUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .refine((u) => /^https?:\/\//i.test(u), "URL must start with http:// or https://")
  .refine((u) => !/^[a-z]+:\/\/[^/@]*@/i.test(u), "URLs with embedded credentials are not allowed");

export const CreateJobInputSchema = z.object({
  url: SubmittedUrlSchema,
  instructions: z.string().trim().min(LIMITS.instructionsMin).max(LIMITS.instructionsMax),
  settings: JobSettingsSchema.default({}),
  /** Client-generated key so double-clicks don't create duplicate jobs. */
  idempotencyKey: z.string().uuid().optional(),
});
export type CreateJobInput = z.infer<typeof CreateJobInputSchema>;

/* --------------------------------------------------------------- error model */

export const ERROR_CATEGORIES = [
  "URL_NOT_REACHABLE",
  "REQUIRES_AUTH",
  "BLOCKED_AUTOMATION",
  "ELEMENT_NOT_FOUND",
  "UNEXPECTED_STATE",
  "RECORDING_TIMEOUT",
  "ENCODING_FAILED",
  "INVALID_SCRIPT",
  "SERVICE_CONFIG",
  "CANCELED",
  "UNKNOWN",
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

/** Friendly, non-technical copy for each error category. */
export const ERROR_COPY: Record<ErrorCategory, { title: string; explanation: string; nextStep: string }> = {
  URL_NOT_REACHABLE: {
    title: "We couldn't reach that URL",
    explanation: "The prototype address didn't respond, or isn't publicly reachable.",
    nextStep: "Check the link opens in a normal browser tab, then try again.",
  },
  REQUIRES_AUTH: {
    title: "This prototype needs a sign-in",
    explanation: "The page redirected to a login screen, which the hosted flow can't complete for you.",
    nextStep: "Use a publicly published prototype link, or see the authenticated-prototypes guide.",
  },
  BLOCKED_AUTOMATION: {
    title: "The site blocked automated access",
    explanation: "The prototype's host refused an automated browser.",
    nextStep: "Try a published Figma Site URL, which is designed to be openable.",
  },
  ELEMENT_NOT_FOUND: {
    title: "We couldn't find something you described",
    explanation: "One of the steps referred to a control we couldn't locate on the page.",
    nextStep: "Edit your instructions to match the labels you see in the prototype, then retry.",
  },
  UNEXPECTED_STATE: {
    title: "The prototype didn't reach the expected screen",
    explanation: "A step waited for a screen that didn't appear in time.",
    nextStep: "Simplify or reorder your instructions and try again.",
  },
  RECORDING_TIMEOUT: {
    title: "The recording took too long",
    explanation: "The walkthrough exceeded the maximum recording time.",
    nextStep: "Shorten the journey or choose a faster pacing, then retry.",
  },
  ENCODING_FAILED: {
    title: "We couldn't finish the video",
    explanation: "Something went wrong while encoding the recording.",
    nextStep: "Retry — this is usually temporary.",
  },
  INVALID_SCRIPT: {
    title: "We couldn't turn that into a valid walkthrough",
    explanation: "The generated steps didn't pass our safety and format checks.",
    nextStep: "Rephrase your instructions to be more concrete and try again.",
  },
  SERVICE_CONFIG: {
    title: "The service isn't fully configured",
    explanation: "A required server setting is missing.",
    nextStep: "Contact the operator of this deployment.",
  },
  CANCELED: {
    title: "Walkthrough canceled",
    explanation: "This run was canceled.",
    nextStep: "Start a new walkthrough whenever you're ready.",
  },
  UNKNOWN: {
    title: "Something went wrong",
    explanation: "An unexpected error occurred.",
    nextStep: "Retry, and contact support if it persists.",
  },
};

/* --------------------------------------------------------------------- job */

export interface JobArtifacts {
  scriptKey?: string;
  videoKey?: string;
  optimizedVideoKey?: string;
  diagnosticsKey?: string;
}

export interface JobMetrics {
  durationSeconds?: number;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  modelTokensIn?: number;
  modelTokensOut?: number;
  stageDurationsMs?: Partial<Record<JobStatus, number>>;
}

export interface Job {
  id: string;
  ownerId: string;
  status: JobStatus;
  progress: number; // 0..1
  url: string;
  instructions: string;
  settings: JobSettings;
  errorCategory?: ErrorCategory;
  errorDetailInternal?: string; // never sent to the browser
  artifacts: JobArtifacts;
  metrics: JobMetrics;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  retryCount: number;
}

/** The subset of a Job that is safe to send to the browser. */
export interface PublicJob {
  id: string;
  status: JobStatus;
  progress: number;
  stageLabel: string;
  stageMessage: string;
  url: string;
  title?: string;
  errorCategory?: ErrorCategory;
  error?: { title: string; explanation: string; nextStep: string };
  metrics: Omit<JobMetrics, "modelTokensIn" | "modelTokensOut">;
  hasVideo: boolean;
  hasScript: boolean;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
}

export function toPublicJob(job: Job): PublicJob {
  const stage = STAGES.find((s) => s.key === (job.status as StageKey));
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    stageLabel: stage?.label ?? job.status,
    stageMessage: stage?.message ?? "",
    url: job.url,
    title: job.settings.title,
    errorCategory: job.errorCategory,
    error: job.errorCategory ? ERROR_COPY[job.errorCategory] : undefined,
    metrics: {
      durationSeconds: job.metrics.durationSeconds,
      fileSizeBytes: job.metrics.fileSizeBytes,
      width: job.metrics.width,
      height: job.metrics.height,
      stageDurationsMs: job.metrics.stageDurationsMs,
    },
    hasVideo: !!job.artifacts.videoKey,
    hasScript: !!job.artifacts.scriptKey,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    expiresAt: job.expiresAt,
  };
}

/* --------------------------------------------------------------- job events */

/** Live events streamed to the UI (SSE/WebSocket). Never contains secrets. */
export type JobEvent =
  | { type: "status"; status: JobStatus; progress: number; stageLabel: string; stageMessage: string; at: string }
  | { type: "log"; line: string; at: string }
  | { type: "done"; job: PublicJob; at: string }
  | { type: "error"; category: ErrorCategory; at: string };

/* ------------------------------------------------------------------ helpers */

/** Make a filesystem/URL-safe base filename (no extension, no traversal). */
export function sanitizeFilename(name: string, fallback = "walkthrough"): string {
  const base = name
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || fallback;
}

/** Resolve the recording viewport dimensions for a settings object. */
export function viewportDims(settings: JobSettings): { width: number; height: number } {
  const v = VIEWPORTS[settings.viewport];
  return { width: v.width, height: v.height };
}

/** Resolve a target-seconds hint (or undefined for "auto"). */
export function targetSeconds(settings: JobSettings): number | undefined {
  if (settings.durationTarget === "auto") return undefined;
  if (settings.durationTarget === "custom") return settings.customSeconds ?? 60;
  return Number(settings.durationTarget);
}
