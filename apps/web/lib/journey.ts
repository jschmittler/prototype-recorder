import type { JobStatus } from "@ptw/job-contracts";

export type JourneyTone = "idle" | "working" | "ready" | "blocked" | "gone";

export interface JourneyStage {
  /** Branded stage name. */
  stage: string;
  /** Plain-language equivalent, always shown alongside so nothing needs decoding. */
  plain: string;
  /** Who the next move belongs to. */
  owner: "AI" | "System" | "You" | null;
  tone: JourneyTone;
}

/**
 * Journey stages map one-to-one onto real pipeline statuses. There is no stage
 * that the backend cannot actually be in, so a stage badge is never decorative.
 *
 * `ready` is the only tone permitted to use gold.
 */
const JOURNEY: Record<JobStatus, JourneyStage> = {
  DRAFT: { stage: "Trailhead", plain: "Draft", owner: "You", tone: "idle" },
  QUEUED: { stage: "Trailhead", plain: "Queued", owner: null, tone: "idle" },
  PREPARING: { stage: "Setting out", plain: "Preparing", owner: "System", tone: "working" },
  INSPECTING: { stage: "Surveying", plain: "Inspecting prototype", owner: "AI", tone: "working" },
  GENERATING_SCRIPT: { stage: "Charting", plain: "Writing the script", owner: "AI", tone: "working" },
  VALIDATING_SCRIPT: { stage: "Checking", plain: "Validating the script", owner: "System", tone: "working" },
  RECORDING: { stage: "Travelling", plain: "Recording", owner: "System", tone: "working" },
  OPTIMIZING: { stage: "Travelling", plain: "Encoding video", owner: "System", tone: "working" },
  UPLOADING: { stage: "Arriving", plain: "Finalising", owner: "System", tone: "working" },
  COMPLETED: { stage: "Ready to show", plain: "Complete", owner: "You", tone: "ready" },
  FAILED: { stage: "Blocked", plain: "Failed", owner: "You", tone: "blocked" },
  CANCELED: { stage: "Stopped", plain: "Canceled", owner: "You", tone: "idle" },
  EXPIRED: { stage: "Expired", plain: "No longer available", owner: null, tone: "gone" },
};

export function journeyFor(status: JobStatus): JourneyStage {
  return JOURNEY[status] ?? JOURNEY.QUEUED;
}

/**
 * Tone styling. Gold is reserved for `ready` and used nowhere else in the
 * application, so a completed walkthrough is visually distinct from every other
 * state on screen.
 */
export const TONE_CLASS: Record<JourneyTone, string> = {
  idle: "border-ink-600 text-ink-300",
  working: "border-signal-500/40 text-signal-300",
  ready: "border-gold-400/45 text-gold-300",
  blocked: "border-danger-500/40 text-danger-400",
  gone: "border-ink-700 text-ink-500",
};

export const DOT_CLASS: Record<JourneyTone, string> = {
  idle: "bg-ink-500",
  working: "bg-signal-400 animate-pulse-soft",
  ready: "bg-gold-400",
  blocked: "bg-danger-500",
  gone: "bg-ink-600",
};

/** "4m ago" / "2h ago" — compact enough for a metadata row. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Strip the scheme so a URL can sit in a dense metadata row. */
export function hostLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}
