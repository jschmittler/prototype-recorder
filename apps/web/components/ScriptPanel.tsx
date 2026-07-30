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
      <div className="rounded-xl border border-dashed border-black/10 bg-black/[0.02] p-8 text-center text-sm text-gray-500">
        No script was generated for this walkthrough.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-black/5 bg-white shadow-soft overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-black/5 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Generated script</h3>
          <p className="text-xs text-gray-500 mt-0.5">Edit your instructions and re-run to refine this journey.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={copy}
            disabled={!content}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black/5 disabled:opacity-50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <a
            href={`/api/jobs/${jobId}/script`}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            Download
          </a>
        </div>
      </div>

      <div className="max-h-[420px] overflow-auto bg-gray-950 p-4">
        {loading && <p className="text-sm text-gray-400 animate-pulse">Loading script…</p>}
        {error && <p className="text-sm text-amber-400">{error}</p>}
        {content && (
          <pre className="text-xs leading-relaxed text-gray-200 whitespace-pre-wrap font-mono">{content}</pre>
        )}
      </div>
    </div>
  );
}
