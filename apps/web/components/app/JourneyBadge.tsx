import type { JobStatus } from "@ptw/job-contracts";
import { journeyFor, TONE_CLASS, DOT_CLASS } from "@/lib/journey";

/**
 * Stage indicator. The dot never carries meaning alone — the label is always
 * present, so status is not conveyed by colour only.
 */
export function JourneyBadge({ status, showPlain = true }: { status: JobStatus; showPlain?: boolean }) {
  const j = journeyFor(status);
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${TONE_CLASS[j.tone]}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[j.tone]}`} aria-hidden />
        {j.stage}
      </span>
      {showPlain && <span className="text-ink-400">{j.plain}</span>}
    </span>
  );
}
