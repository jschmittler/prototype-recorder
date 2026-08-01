"use client";

import { useCallback, useEffect, useState } from "react";

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
  // window.location is unavailable during SSR, so the absolute URLs are filled
  // in after mount rather than read during render, which would not match.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const shareTitle = title ?? "Walkthrough";
  const pageUrl = origin ? `${origin}/jobs/${jobId}` : "";
  const videoPath = `/api/jobs/${jobId}/video?inline=1`;
  const videoUrl = origin ? `${origin}${videoPath}` : videoPath;
  const embedCode = `<video controls width="${width ?? 1280}" src="${videoUrl}"></video>`;

  const copy = useCallback(async (text: string, kind: "link" | "embed" | "video") => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `Check out this prototype walkthrough: ${shareTitle}`
  )}&url=${encodeURIComponent(pageUrl)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="label-tech">Export</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <Spec k="Format" v="WebM (VP8)" />
          <Spec k="Duration" v={durationSeconds ? `${durationSeconds.toFixed(1)}s` : "—"} />
          <Spec k="Resolution" v={width && height ? `${width}×${height}` : "—"} />
          <Spec k="File size" v={fileSizeBytes ? `${(fileSizeBytes / 1_000_000).toFixed(2)} MB` : "—"} />
        </dl>

        <div className="mt-4 space-y-2">
          {/* The finished artefact — the one place gold is earned. */}
          {hasVideo && (
            <a
              href={`/api/jobs/${jobId}/video`}
              className="group flex items-center justify-between rounded-lg border border-gold-400/35 bg-gold-400/[0.06] px-3 py-2.5 text-sm font-medium text-ink-100 transition-colors duration-fast hover:border-gold-400/60 hover:bg-gold-400/10"
            >
              <span>Standard WebM</span>
              <span className="text-gold-300">Download</span>
            </a>
          )}
          {hasOptimizedVideo && (
            <a
              href={`/api/jobs/${jobId}/video?optimized=1`}
              className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm font-medium text-ink-200 transition-colors duration-fast hover:border-ink-600 hover:bg-ink-800"
            >
              <span>Optimized VP9</span>
              <span className="text-ink-400">Download</span>
            </a>
          )}
          <a
            href={`/api/jobs/${jobId}/script`}
            className="flex items-center justify-between rounded-lg border border-ink-700 px-3 py-2.5 text-sm font-medium text-ink-300 transition-colors duration-fast hover:bg-ink-900"
          >
            <span>Transcript (Markdown)</span>
            <span className="text-ink-400">Download</span>
          </a>
        </div>
      </div>

      <div>
        <h3 className="label-tech">Share</h3>
        <div className="mt-3 space-y-2">
          <CopyRow label="Page link" value={pageUrl} onCopy={() => copy(pageUrl, "link")} copied={copied === "link"} />
          <CopyRow
            label="Direct video"
            value={videoUrl}
            onCopy={() => copy(videoUrl, "video")}
            copied={copied === "video"}
          />
          <CopyRow
            label="Embed code"
            value={embedCode}
            onCopy={() => copy(embedCode, "embed")}
            copied={copied === "embed"}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a href={twitterUrl} target="_blank" rel="noreferrer" className="btn btn-secondary px-3 py-1.5 text-xs">
            Share on X
          </a>
          <a href={linkedInUrl} target="_blank" rel="noreferrer" className="btn btn-secondary px-3 py-1.5 text-xs">
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
      <dt className="text-ink-400">{k}</dt>
      <dd className="mt-0.5 font-medium text-ink-100">{v}</dd>
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
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-400">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          className="text-xs font-medium text-signal-300 transition-colors duration-fast hover:text-signal-200 disabled:opacity-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1 truncate font-mono text-xs text-ink-500">{value || "…"}</p>
    </div>
  );
}
