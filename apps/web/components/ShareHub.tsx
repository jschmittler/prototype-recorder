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
  variant = "light",
}: {
  jobId: string;
  title?: string;
  hasVideo: boolean;
  hasOptimizedVideo: boolean;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  variant?: "light" | "studio";
}) {
  const [copied, setCopied] = useState<"link" | "embed" | "video" | null>(null);
  const shareTitle = title ?? "Walkthrough";
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/jobs/${jobId}` : "";
  const videoUrl = `/api/jobs/${jobId}/video?inline=1`;
  const embedCode = `<video controls width="${width ?? 1280}" src="${typeof window !== "undefined" ? window.location.origin : ""}${videoUrl}"></video>`;
  const isStudio = variant === "studio";

  const copy = useCallback(async (text: string, kind: typeof copied) => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const tweet = `Check out this prototype walkthrough: ${shareTitle}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(pageUrl)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;

  const sectionClass = isStudio ? "space-y-3" : "rounded-xl border border-black/5 bg-white p-4 shadow-soft space-y-3";
  const headingClass = isStudio
    ? "text-[11px] font-semibold uppercase tracking-wider text-studio-500"
    : "text-sm font-semibold text-gray-900";
  const presetClass = isStudio
    ? "flex items-center justify-between rounded-lg border border-studio-800 bg-studio-900 px-3 py-2.5 text-sm font-medium text-studio-200 hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors group"
    : "flex items-center justify-between rounded-lg border border-black/10 px-3 py-2.5 text-sm font-medium hover:bg-brand-50 hover:border-brand-200 transition-colors group";

  return (
    <div className="space-y-6">
      <div>
        <h3 className={headingClass}>Export</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <Spec k="Format" v="WebM (VP8)" studio={isStudio} />
          <Spec k="Duration" v={durationSeconds ? `${durationSeconds.toFixed(1)}s` : "—"} studio={isStudio} />
          <Spec k="Resolution" v={width && height ? `${width}×${height}` : "—"} studio={isStudio} />
          <Spec k="File size" v={fileSizeBytes ? `${(fileSizeBytes / 1_000_000).toFixed(2)} MB` : "—"} studio={isStudio} />
        </dl>

        <div className="mt-4 space-y-2">
          {hasVideo && (
            <a href={`/api/jobs/${jobId}/video`} className={presetClass}>
              <span>Standard WebM</span>
              <span className="text-brand-400 group-hover:text-brand-300">Download</span>
            </a>
          )}
          {hasOptimizedVideo && (
            <a href={`/api/jobs/${jobId}/video?optimized=1`} className={presetClass}>
              <span>Optimized VP9</span>
              <span className="text-brand-400 group-hover:text-brand-300">Download</span>
            </a>
          )}
          <a
            href={`/api/jobs/${jobId}/script`}
            className={
              isStudio
                ? "flex items-center justify-between rounded-lg border border-studio-800 px-3 py-2.5 text-sm font-medium text-studio-300 hover:bg-studio-900 transition-colors"
                : "flex items-center justify-between rounded-lg border border-black/10 px-3 py-2.5 text-sm font-medium hover:bg-black/5 transition-colors"
            }
          >
            <span>Transcript (Markdown)</span>
            <span className={isStudio ? "text-studio-500" : "text-gray-500"}>Download</span>
          </a>
        </div>
      </div>

      <div className={isStudio ? "" : sectionClass}>
        <h3 className={headingClass}>Share</h3>
        <div className="mt-3 space-y-2">
          <CopyRow
            label="Page link"
            value={pageUrl}
            onCopy={() => copy(pageUrl, "link")}
            copied={copied === "link"}
            studio={isStudio}
          />
          <CopyRow
            label="Direct video"
            value={typeof window !== "undefined" ? `${window.location.origin}${videoUrl}` : videoUrl}
            onCopy={() =>
              copy(typeof window !== "undefined" ? `${window.location.origin}${videoUrl}` : videoUrl, "video")
            }
            copied={copied === "video"}
            studio={isStudio}
          />
          <CopyRow
            label="Embed code"
            value={embedCode}
            onCopy={() => copy(embedCode, "embed")}
            copied={copied === "embed"}
            studio={isStudio}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={twitterUrl}
            target="_blank"
            rel="noreferrer"
            className={
              isStudio
                ? "rounded-lg border border-studio-800 px-3 py-1.5 text-xs font-medium text-studio-400 hover:text-studio-200 hover:border-studio-600 transition-colors"
                : "rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black/5"
            }
          >
            Share on X
          </a>
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noreferrer"
            className={
              isStudio
                ? "rounded-lg border border-studio-800 px-3 py-1.5 text-xs font-medium text-studio-400 hover:text-studio-200 hover:border-studio-600 transition-colors"
                : "rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black/5"
            }
          >
            Share on LinkedIn
          </a>
        </div>
      </div>
    </div>
  );
}

function Spec({ k, v, studio }: { k: string; v: string; studio?: boolean }) {
  return (
    <div>
      <dt className={studio ? "text-studio-600" : "text-gray-500"}>{k}</dt>
      <dd className={"mt-0.5 font-medium " + (studio ? "text-studio-200" : "text-gray-900")}>{v}</dd>
    </div>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
  copied,
  studio,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  studio?: boolean;
}) {
  return (
    <div className={"rounded-lg p-2.5 " + (studio ? "bg-studio-900 border border-studio-800" : "bg-black/[0.03]")}>
      <div className="flex items-center justify-between gap-2">
        <span className={"text-xs font-medium " + (studio ? "text-studio-500" : "text-gray-600")}>{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className={"mt-1 truncate text-xs font-mono " + (studio ? "text-studio-600" : "text-gray-500")}>{value}</p>
    </div>
  );
}
