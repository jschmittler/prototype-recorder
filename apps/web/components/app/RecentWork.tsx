"use client";

import Link from "next/link";
import { useState } from "react";
import { useRecentJobs } from "@/lib/recent-jobs";
import { journeyFor, relativeTime, hostLabel, type JourneyTone } from "@/lib/journey";
import { JourneyBadge } from "./JourneyBadge";

/**
 * Recent walkthroughs, hydrated live from the API so every stage shown is the
 * job's real current state. Jobs that the server no longer holds render as an
 * honest "expired" row rather than disappearing silently.
 */
export function RecentWork() {
  const { entries, loading, ready, remove } = useRecentJobs();

  // Before storage is read, server and client markup must agree.
  if (!ready) return <SkeletonList />;
  if (loading) return <SkeletonList />;
  if (entries.length === 0) return <EmptyState />;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => {
        if (entry.state === "gone") {
          return (
            <li key={entry.id} className="panel-quiet flex items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink-400">Walkthrough no longer available</p>
                <p className="mt-1 font-mono text-[11px] text-ink-500">
                  {entry.id.slice(0, 8)} · files are cleared after a while
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                className="btn btn-ghost shrink-0 px-2 py-1 text-xs"
              >
                Remove
              </button>
            </li>
          );
        }

        const job = entry.job;
        const j = journeyFor(job.status);
        const title = job.title?.trim() || hostLabel(job.url);

        return (
          <li key={entry.id}>
            <Link
              href={`/jobs/${entry.id}`}
              className="panel group block h-full overflow-hidden transition-colors duration-fast hover:border-ink-600 hover:bg-ink-800"
            >
              <Thumbnail jobId={entry.id} hasPoster={job.hasPoster} tone={j.tone} />

              <div className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="truncate text-sm font-medium text-ink-50">{title}</h3>
                <span className="shrink-0 font-mono text-[11px] text-ink-500">
                  {relativeTime(job.createdAt)}
                </span>
              </div>

              <p className="mt-1 truncate text-xs text-ink-400">{hostLabel(job.url)}</p>

              <div className="mt-3 flex items-center justify-between gap-2">
                <JourneyBadge status={job.status} showPlain={false} />
                <span className="text-xs text-ink-400">
                  {j.tone === "ready"
                    ? "Watch and share"
                    : j.tone === "blocked"
                      ? "Inspect and retry"
                      : j.tone === "working"
                        ? j.plain
                        : j.plain}
                </span>
              </div>

              {/* Progress only appears while there is real progress to report. */}
              {j.tone === "working" && (
                <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full bg-signal-500 transition-[width] duration-panel ease-settle"
                    style={{ width: `${Math.round(Math.min(1, Math.max(0, job.progress)) * 100)}%` }}
                  />
                </div>
              )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Poster frame for finished walkthroughs.
 *
 * A job only has a poster once it has recorded something, so the fallback is not
 * a placeholder for a missing image — it is the accurate state of a walkthrough
 * that has no footage yet. It says which, rather than showing a grey box.
 */
function Thumbnail({
  jobId,
  hasPoster,
  tone,
}: {
  jobId: string;
  hasPoster: boolean;
  tone: JourneyTone;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = hasPoster && !failed;

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-ink-800 bg-ink-950">
      {showImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- served from a dynamic API route, already sized at 640px */}
          <img
            src={`/api/jobs/${encodeURIComponent(jobId)}/poster`}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover object-top transition-transform duration-panel ease-settle group-hover:scale-[1.02]"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/60 to-transparent"
            aria-hidden
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-grid opacity-90">
          <span className="label-tech">
            {failed
              ? "Preview unavailable"
              : tone === "working"
                ? "Recording in progress"
                : tone === "blocked"
                  ? "No footage"
                  : "Not recorded"}
          </span>
        </div>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="panel-quiet px-4 py-3.5">
          <div className="h-4 w-2/3 rounded bg-ink-800" />
          <div className="mt-2 h-3 w-1/2 rounded bg-ink-800/70" />
          <div className="mt-4 h-4 w-24 rounded-full bg-ink-800/70" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="panel-quiet px-5 py-8 text-center">
      <p className="text-sm text-ink-200">No walkthroughs yet.</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-400">
        Paste a prototype link above and describe the journey. Your walkthroughs will collect here,
        on this browser.
      </p>
    </div>
  );
}
