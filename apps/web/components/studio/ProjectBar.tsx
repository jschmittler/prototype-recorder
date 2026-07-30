"use client";

import Link from "next/link";

type Status = "draft" | "rendering" | "complete" | "failed";

const STATUS_STYLES: Record<Status, string> = {
  draft: "bg-studio-800 text-studio-300 ring-studio-700",
  rendering: "bg-brand-500/15 text-brand-300 ring-brand-500/30",
  complete: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  failed: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
};

const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  rendering: "Rendering",
  complete: "Ready",
  failed: "Failed",
};

export function ProjectBar({
  title,
  subtitle,
  status,
  action,
}: {
  title: string;
  subtitle?: string;
  status: Status;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-studio-800/80">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white truncate">{title}</h1>
          <span
            className={
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 " +
              STATUS_STYLES[status]
            }
          >
            {status === "rendering" && (
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" aria-hidden />
            )}
            {STATUS_LABEL[status]}
          </span>
        </div>
        {subtitle && <p className="mt-1.5 text-sm text-studio-400 max-w-2xl">{subtitle}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="shrink-0 rounded-lg border border-studio-700 bg-studio-900 px-4 py-2 text-sm font-medium text-studio-100 hover:bg-studio-800 hover:border-studio-600 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
