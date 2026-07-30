"use client";

import type { JobStatus } from "@ptw/job-contracts";

export type PipelineStage = {
  key: JobStatus | string;
  label: string;
  message?: string;
};

export function PipelineTimeline({
  stages,
  currentKey,
  progress,
}: {
  stages: PipelineStage[];
  currentKey: string;
  progress: number;
}) {
  const currentIndex = stages.findIndex((s) => s.key === currentKey);
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between text-xs text-studio-500 mb-2">
        <span>Production pipeline</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-studio-800 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-brand-500 transition-[width] duration-700 ease-out rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="mt-4 flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {stages.map((stage, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "todo";
          return (
            <li
              key={stage.key}
              className={
                "flex-1 min-w-[88px] rounded-lg px-2.5 py-2 border transition-colors " +
                (state === "active"
                  ? "border-brand-500/40 bg-brand-500/10"
                  : state === "done"
                    ? "border-studio-700/60 bg-studio-900/50"
                    : "border-studio-800/60 bg-studio-950/50 opacity-60")
              }
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    "grid place-items-center h-4 w-4 rounded-full text-[9px] font-bold shrink-0 " +
                    (state === "done"
                      ? "bg-brand-500 text-white"
                      : state === "active"
                        ? "bg-brand-400/30 text-brand-200 ring-1 ring-brand-400/50"
                        : "bg-studio-800 text-studio-500")
                  }
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span
                  className={
                    "text-[11px] font-medium leading-tight truncate " +
                    (state === "active" ? "text-brand-100" : state === "done" ? "text-studio-200" : "text-studio-500")
                  }
                >
                  {stage.label}
                </span>
              </div>
              {state === "active" && stage.message && (
                <p className="mt-1 text-[10px] text-studio-400 leading-snug line-clamp-2 pl-5">{stage.message}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
