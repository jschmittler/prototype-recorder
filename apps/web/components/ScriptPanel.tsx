"use client";

import { useCallback, useEffect, useState } from "react";

export function ScriptPanel({ jobId, hasScript }: { jobId: string; hasScript: boolean }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasScript);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      <div className="rounded-lg border border-dashed border-ink-700 bg-ink-900/50 p-8 text-center text-sm text-ink-400">
        No transcript was generated for this walkthrough.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-ink-100">Generated transcript</h3>
          <p className="mt-0.5 text-xs text-ink-400">Edit your brief and re-run to refine this journey.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={copy} disabled={!content} className="btn btn-secondary px-3 py-1.5 text-xs">
            {copied ? "Copied" : "Copy"}
          </button>
          <a href={`/api/jobs/${jobId}/script`} className="btn btn-primary px-3 py-1.5 text-xs">
            Download
          </a>
        </div>
      </div>

      <div className="max-h-[320px] overflow-auto bg-ink-950 p-4">
        {loading && <p className="animate-pulse-soft text-sm text-ink-400">Loading transcript…</p>}
        {error && (
          <p role="alert" className="text-sm text-warn-400">
            {error}
          </p>
        )}
        {content && (
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-300">{content}</pre>
        )}
      </div>
    </div>
  );
}
