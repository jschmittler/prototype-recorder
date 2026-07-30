"use client";

import { useCallback, useState } from "react";

export function ShareHub({
  jobId,
  title,
  hasVideo,
  hasOptimizedVideo,
  durationSeconds,
  width,
  height,
  fileSizeBytes,
}: {
  jobId: string;
  title?: string;
  hasVideo: boolean;
  hasOptimizedVideo: boolean;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
}) {
  const [copied, setCopied] = useState<"link" | "embed" | "video" | null>(null);
  const shareTitle = title ?? "Walkthrough";
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/jobs/${jobId}` : "";
  const videoUrl = `/api/jobs/${jobId}/video?inline=1`;
  const embedCode = `<video controls width="${width ?? 1280}" src="${typeof window !== "undefined" ? window.location.origin : ""}${videoUrl}"></video>`;

  const copy = useCallback(async (text: string, kind: typeof copied) => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const tweet = `Check out this prototype walkthrough: ${shareTitle}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(pageUrl)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-soft">
        <h3 className="text-sm font-semibold text-gray-900">Export</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <Spec k="Format" v="WebM (VP8)" />
          <Spec k="Duration" v={durationSeconds ? `${durationSeconds.toFixed(1)}s` : "—"} />
          <Spec k="Resolution" v={width && height ? `${width}×${height}` : "—"} />
          <Spec k="File size" v={fileSizeBytes ? `${(fileSizeBytes / 1_000_000).toFixed(2)} MB` : "—"} />
        </dl>

        <div className="mt-4 space-y-2">
          {hasVideo && (
            <a
              href={`/api/jobs/${jobId}/video`}
              className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2.5 text-sm font-medium hover:bg-brand-50 hover:border-brand-200 transition-colors group"
            >
              <span>Standard WebM</span>
              <span className="text-brand-600 group-hover:text-brand-700">Download ↓</span>
            </a>
          )}
          {hasOptimizedVideo && (
            <a
              href={`/api/jobs/${jobId}/video?optimized=1`}
              className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2.5 text-sm font-medium hover:bg-brand-50 hover:border-brand-200 transition-colors group"
            >
              <span>Optimized VP9</span>
              <span className="text-brand-600 group-hover:text-brand-700">Download ↓</span>
            </a>
          )}
          <a
            href={`/api/jobs/${jobId}/script`}
            className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2.5 text-sm font-medium hover:bg-black/5 transition-colors"
          >
            <span>Script (Markdown)</span>
            <span className="text-gray-500">Download ↓</span>
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-soft">
        <h3 className="text-sm font-semibold text-gray-900">Share</h3>
        <div className="mt-3 space-y-2">
          <CopyRow
            label="Page link"
            value={pageUrl}
            onCopy={() => copy(pageUrl, "link")}
            copied={copied === "link"}
          />
          <CopyRow
            label="Direct video"
            value={typeof window !== "undefined" ? `${window.location.origin}${videoUrl}` : videoUrl}
            onCopy={() =>
              copy(typeof window !== "undefined" ? `${window.location.origin}${videoUrl}` : videoUrl, "video")
            }
            copied={copied === "video"}
          />
          <CopyRow label="Embed code" value={embedCode} onCopy={() => copy(embedCode, "embed")} copied={copied === "embed"} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={twitterUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black/5"
          >
            Share on X
          </a>
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black/5"
          >
            Share on LinkedIn
          </a>
        </div>
      </div>
    </div>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-gray-500">{k}</dt>
      <dd className="mt-0.5 font-medium text-gray-900">{v}</dd>
    </div>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="rounded-lg bg-black/[0.03] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <button type="button" onClick={onCopy} className="text-xs font-medium text-brand-600 hover:text-brand-700">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="mt-1 truncate text-xs text-gray-500 font-mono">{value}</p>
    </div>
  );
}
