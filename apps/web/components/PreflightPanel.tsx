"use client";

export interface PreflightStepResult {
  section: string;
  line: number;
  verb: string;
  raw: string;
  status: "ok" | "failed" | "skipped";
  cascaded?: boolean;
  error?: string;
  suggestions?: string[];
}

export interface PreflightReport {
  url: string;
  finalUrl: string;
  totalSteps: number;
  checkedSteps: number;
  okCount: number;
  failedCount: number;
  durationSeconds: number;
  results: PreflightStepResult[];
}

const STATUS_STYLES: Record<PreflightStepResult["status"], { dot: string; label: string }> = {
  ok: { dot: "bg-emerald-400", label: "Resolved" },
  failed: { dot: "bg-red-400", label: "Not found" },
  skipped: { dot: "bg-studio-600", label: "Skipped (optional)" },
};

export function PreflightPanel({
  report,
  generated,
  repairs = 0,
  repairedFrom,
  onUseScript,
}: {
  report: PreflightReport;
  generated?: boolean;
  repairs?: number;
  repairedFrom?: number;
  onUseScript?: () => void;
}) {
  const clean = report.failedCount === 0;
  const firstFailureIndex = report.results.findIndex((r) => r.status === "failed");
  const fixed = repairedFrom !== undefined ? repairedFrom - report.failedCount : 0;

  return (
    <div
      className={
        "mb-6 rounded-lg border p-4 " +
        (clean ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10")
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={"text-sm font-medium " + (clean ? "text-emerald-100" : "text-amber-100")}>
            {clean
              ? `All ${report.okCount} steps resolved against the live prototype`
              : `${report.failedCount} of ${report.checkedSteps} steps could not be found`}
          </p>
          <p className="mt-0.5 text-xs text-studio-400">
            Checked in {report.durationSeconds}s
            {generated ? " · script written from your brief" : " · using your saved script"}
            {repairs > 0 &&
              ` · ${fixed > 0 ? `${fixed} step${fixed === 1 ? "" : "s"} repaired` : "repair attempted"} over ${repairs} round${repairs === 1 ? "" : "s"}`}
          </p>
        </div>
        {(generated || repairs > 0) && onUseScript && (
          <button
            type="button"
            onClick={onUseScript}
            className="rounded-lg border border-studio-600 px-3 py-1.5 text-xs font-medium text-studio-200 hover:bg-studio-800 transition-colors"
          >
            Save this script
          </button>
        )}
      </div>

      {!clean && firstFailureIndex > -1 && (
        <p className="mt-3 text-xs text-amber-200/80">
          Recording would stop at step {firstFailureIndex + 1}.
          {repairs > 0
            ? " Automatic repair could not resolve the rest — edit the script below, then check again."
            : " Fix the brief or edit the script below, then check again."}
        </p>
      )}
      {clean && repairs > 0 && (
        <p className="mt-3 text-xs text-emerald-200/80">
          Save the repaired script so this journey records the same way every time.
        </p>
      )}

      <ol className="mt-4 space-y-1.5 max-h-80 overflow-auto pr-1">
        {report.results.map((r, i) => {
          const style = STATUS_STYLES[r.status];
          return (
            <li key={`${r.line}-${i}`} className="rounded-md bg-black/20 px-3 py-2">
              <div className="flex items-start gap-2.5">
                <span className={"mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " + style.dot} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] text-studio-300 break-words">{r.raw}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-studio-600">
                    {r.section} · {style.label}
                  </p>
                  {r.error && <p className="mt-1 text-[11px] text-red-300">{r.error}</p>}
                  {r.suggestions && r.suggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] uppercase tracking-wider text-studio-600">On screen instead</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {r.suggestions.map((s) => (
                          <span
                            key={s}
                            className="rounded-full border border-studio-700 bg-studio-950 px-2 py-0.5 text-[11px] text-studio-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
