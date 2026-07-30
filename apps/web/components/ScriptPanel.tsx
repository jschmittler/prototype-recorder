"use client";

import { useCallback, useEffect, useState } from "react";

export function ScriptPanel({
  jobId,
  hasScript,
  variant = "light",
}: {
  jobId: string;
  hasScript: boolean;
  variant?: "light" | "studio";
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasScript);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isStudio = variant === "studio";

  useEffect(() => {
    if (!hasScript) return;
    let cancelled = false;
    fetch(`/api/jobs/${jobId}/script?preview=1`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load script");
        return r.json() as Promise<{ content: string }>;
      })
      .then((data) => {
        if (!cancelled) setContent(data.content);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, hasScript]);

  const copy = useCallback(async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  if (!hasScript) {
    return (
      <div
        className={
          isStudio
            ? "rounded-lg border border-dashed border-studio-700 bg-studio-950/50 p-8 text-center text-sm text-studio-500"
            : "rounded-xl border border-dashed border-black/10 bg-black/[0.02] p-8 text-center text-sm text-gray-500"
        }
      >
        No transcript was generated for this walkthrough.
      </div>
    );
  }

  return (
    <div
      className={
        isStudio
          ? "rounded-lg border border-studio-800 bg-studio-950 overflow-hidden"
          : "rounded-xl border border-black/5 bg-white shadow-soft overflow-hidden"
      }
    >
      <div
        className={
          "flex items-center justify-between gap-3 border-b px-4 py-3 " +
          (isStudio ? "border-studio-800" : "border-black/5")
        }
      >
        <div>
          <h3 className={"text-sm font-medium " + (isStudio ? "text-studio-200" : "text-gray-900")}>
            Generated transcript
          </h3>
          <p className={"text-xs mt-0.5 " + (isStudio ? "text-studio-500" : "text-gray-500")}>
            Edit your brief and re-run to refine this journey.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={copy}
            disabled={!content}
            className={
              "rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition-colors " +
              (isStudio
                ? "border-studio-700 text-studio-300 hover:bg-studio-800"
                : "border-black/10 hover:bg-black/5")
            }
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <a
            href={`/api/jobs/${jobId}/script`}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500"
          >
            Download
          </a>
        </div>
      </div>

      <div className={"max-h-[320px] overflow-auto p-4 " + (isStudio ? "bg-black/30" : "bg-gray-950")}>
        {loading && <p className="text-sm text-gray-400 animate-pulse">Loading transcript…</p>}
        {error && <p className="text-sm text-amber-400">{error}</p>}
        {content && (
          <pre className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap font-mono">{content}</pre>
        )}
      </div>
    </div>
  );
}
