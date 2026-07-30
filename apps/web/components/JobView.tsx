"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { STAGES, type JobEvent, type JobStatus, type PublicJob } from "@ptw/job-contracts";
import { ProgressRing } from "./ProgressRing";
import { ScriptPanel } from "./ScriptPanel";
import { ShareHub } from "./ShareHub";
import { PipelineTimeline } from "./studio/PipelineTimeline";
import { ProjectBar } from "./studio/ProjectBar";
import { StudioShell } from "./studio/StudioShell";

export function JobView({ id }: { id: string }) {
  const [status, setStatus] = useState<JobStatus>("QUEUED");
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("Queued");
  const [stageMessage, setStageMessage] = useState("Your walkthrough is in line.");
  const [logs, setLogs] = useState<string[]>([]);
  const [job, setJob] = useState<PublicJob | null>(null);
  const [errorCat, setErrorCat] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: PublicJob | null) => {
        if (j) setJob(j);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const es = new EventSource(`/api/jobs/${id}/events`);
    es.onmessage = (e) => {
      let ev: JobEvent;
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      if (ev.type === "status") {
        setStatus(ev.status);
        setProgress(ev.progress);
        setStageLabel(ev.stageLabel);
        setStageMessage(ev.stageMessage);
      } else if (ev.type === "log") {
        setLogs((l) => [...l.slice(-200), ev.line]);
      } else if (ev.type === "done") {
        setJob(ev.job);
        setStatus("COMPLETED");
        setProgress(1);
        es.close();
      } else if (ev.type === "error") {
        setErrorCat(ev.category);
        setStatus("FAILED");
        fetch(`/api/jobs/${id}`)
          .then((r) => r.json())
          .then((j: PublicJob) => setJob(j))
          .catch(() => {});
        es.close();
      }
    };
    es.onerror = () => {};
    return () => es.close();
  }, [id]);

  if (status === "COMPLETED" && job) {
    return <DeliveryHub job={job} id={id} />;
  }
  if (status === "FAILED") return <FailureView job={job} category={errorCat} logs={logs} />;

  const pipelineStages = STAGES.filter((s) => s.key !== "COMPLETED").map((s) => ({
    key: s.key,
    label: s.label,
    message: s.message,
  }));

  return (
    <StudioShell breadcrumb={[{ label: "Projects", href: "/create" }, { label: job?.title ?? "Rendering" }]}>
      <ProjectBar
        title={job?.title ?? "Walkthrough export"}
        subtitle={stageMessage}
        status="rendering"
      />

      <PipelineTimeline stages={pipelineStages} currentKey={status} progress={progress} />

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-3 mb-8">
        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" aria-hidden />
        <div>
          <p className="text-sm font-medium text-amber-100">Render in progress — keep this tab open</p>
          <p className="text-sm text-amber-200/70 mt-0.5">
            Closing the tab won&apos;t cancel the job, but you&apos;ll lose live progress updates.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="studio-panel p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <ProgressRing progress={progress} size={152} variant="studio" />
            <div className="flex-1 w-full text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Current stage</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">{stageLabel}</h2>
              <p className="mt-2 text-sm text-studio-400">{stageMessage}</p>
              <p className="mt-4 text-xs text-studio-500 tabular-nums">{elapsed}s elapsed</p>
            </div>
          </div>

          <div className="mt-8 aspect-video rounded-lg bg-studio-950 border border-studio-800 flex items-center justify-center">
            <div className="text-center px-6">
              <div className="mx-auto h-12 w-12 rounded-full border-2 border-studio-700 border-t-brand-500 animate-spin" />
              <p className="mt-4 text-sm text-studio-400">Preview will appear when recording completes</p>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-xs text-studio-500 hover:text-studio-300 transition-colors"
            >
              {showDetails ? "Hide" : "Show"} render log
            </button>
            {showDetails && (
              <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-black/40 border border-studio-800 p-3 text-[11px] text-studio-300 font-mono">
                {logs.length ? logs.join("\n") : "Waiting for logs…"}
              </pre>
            )}
          </div>
        </div>

        <aside className="studio-panel p-5 lg:sticky lg:top-6 h-fit">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-studio-500">Project inspector</h2>
          <dl className="mt-4 space-y-4 text-sm">
            {job?.title && (
              <InspectorRow label="Title" value={job.title} />
            )}
            <InspectorRow label="Prototype" value={job?.url ?? "—"} mono />
            <InspectorRow label="Format" value="WebM · VP8" />
            <InspectorRow label="Job ID" value={id} mono />
          </dl>
        </aside>
      </div>
    </StudioShell>
  );
}

function DeliveryHub({ job, id }: { job: PublicJob; id: string }) {
  return (
    <StudioShell breadcrumb={[{ label: "Projects", href: "/create" }, { label: job.title ?? "Export" }]}>
      <ProjectBar
        title={job.title ?? "Your walkthrough"}
        subtitle="Preview your recording, review the transcript, and distribute to your team."
        status="complete"
        action={{ label: "New project", href: "/create" }}
      />

      <div className="grid gap-0 lg:grid-cols-[1fr_300px] lg:divide-x lg:divide-studio-800 border border-studio-800 rounded-xl overflow-hidden bg-studio-900/40">
        <div className="p-4 sm:p-6">
          <div className="rounded-lg overflow-hidden bg-black border border-studio-800">
            <video
              controls
              playsInline
              className="w-full aspect-video"
              src={`/api/jobs/${id}/video?inline=1`}
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 px-1 text-sm">
            <Meta k="Duration" v={job.metrics.durationSeconds ? `${job.metrics.durationSeconds.toFixed(1)}s` : "—"} />
            <Meta k="Resolution" v={job.metrics.width ? `${job.metrics.width}×${job.metrics.height}` : "—"} />
            <Meta k="Size" v={fmtSize(job.metrics.fileSizeBytes)} />
            <Meta k="Created" v={new Date(job.createdAt).toLocaleString()} />
          </dl>

          <div className="mt-8">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-studio-500">Transcript</h2>
              <span className="text-[10px] text-studio-600">Descript-style script panel</span>
            </div>
            <ScriptPanel jobId={id} hasScript={job.hasScript} variant="studio" />
          </div>

          {job.expiresAt && (
            <p className="mt-4 text-xs text-studio-600">
              Files available until {new Date(job.expiresAt).toLocaleString()}.
            </p>
          )}
        </div>

        <div className="p-4 sm:p-5 bg-studio-950/60 border-t lg:border-t-0 border-studio-800">
          <ShareHub
            jobId={id}
            title={job.title}
            hasVideo={job.hasVideo}
            hasOptimizedVideo={job.hasOptimizedVideo}
            durationSeconds={job.metrics.durationSeconds}
            width={job.metrics.width}
            height={job.metrics.height}
            fileSizeBytes={job.metrics.fileSizeBytes}
            variant="studio"
          />
        </div>
      </div>
    </StudioShell>
  );
}

function FailureView({
  job,
  category,
  logs,
}: {
  job: PublicJob | null;
  category: string | null;
  logs: string[];
}) {
  const copy = job?.error ?? {
    title: "Render failed",
    explanation: "An unexpected error occurred during export.",
    nextStep: "Review your prototype URL and instructions, then try again.",
  };
  const [showLogs, setShowLogs] = useState(false);

  return (
    <StudioShell breadcrumb={[{ label: "Projects", href: "/create" }, { label: "Failed export" }]}>
      <ProjectBar title={copy.title} subtitle={copy.explanation} status="failed" />

      <div className="max-w-2xl">
        <div className="studio-panel p-6">
          <p className="text-sm text-studio-300 leading-relaxed">{copy.explanation}</p>
          <p className="mt-4 text-sm text-studio-400">
            <span className="font-medium text-studio-200">Next step:</span> {copy.nextStep}
          </p>
          {category && <p className="mt-4 text-xs text-studio-600 font-mono">Ref: {category}</p>}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
          >
            Try again
          </Link>
          <Link
            href="/create"
            className="rounded-lg border border-studio-700 px-5 py-2.5 text-sm font-medium text-studio-200 hover:bg-studio-800 transition-colors"
          >
            Edit brief
          </Link>
        </div>

        {logs.length > 0 && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setShowLogs((v) => !v)}
              className="text-xs text-studio-500 hover:text-studio-300"
            >
              {showLogs ? "Hide" : "Show"} render log
            </button>
            {showLogs && (
              <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-black/40 border border-studio-800 p-4 text-[11px] text-studio-300 font-mono">
                {logs.join("\n")}
              </pre>
            )}
          </div>
        )}
      </div>
    </StudioShell>
  );
}

function InspectorRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-studio-500">{label}</dt>
      <dd className={`mt-1 font-medium text-studio-200 truncate ${mono ? "font-mono text-xs text-studio-400" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function fmtSize(bytes?: number) {
  if (!bytes) return "—";
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-studio-500">{k}</dt>
      <dd className="mt-0.5 font-medium text-studio-200">{v}</dd>
    </div>
  );
}
