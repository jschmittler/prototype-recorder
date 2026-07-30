"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { STAGES, type JobEvent, type JobStatus, type PublicJob } from "@ptw/job-contracts";
import { ProgressRing } from "./ProgressRing";
import { ScriptPanel } from "./ScriptPanel";
import { ShareHub } from "./ShareHub";

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
  const [resultTab, setResultTab] = useState<"preview" | "script">("preview");
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
    es.onerror = () => {
      /* the browser auto-reconnects; terminal events close the stream explicitly */
    };
    return () => es.close();
  }, [id]);

  if (status === "COMPLETED" && job) {
    return <Result job={job} id={id} resultTab={resultTab} setResultTab={setResultTab} />;
  }
  if (status === "FAILED") return <Failure job={job} category={errorCat} logs={logs} />;

  const currentIndex = STAGES.findIndex((s) => s.key === status);
  const activeStage = STAGES[currentIndex];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <span className="text-lg leading-none mt-0.5" aria-hidden>
          ⏳
        </span>
        <div>
          <p className="text-sm font-medium text-amber-900">Keep this tab open</p>
          <p className="text-sm text-amber-800/90 mt-0.5">
            Your walkthrough is being generated. Closing the tab won&apos;t cancel the job, but you&apos;ll lose live
            progress updates.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_280px] lg:items-start">
        <div>
          <p className="text-sm font-medium text-brand-700">Generating walkthrough</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{stageLabel}</h1>
          <p className="mt-2 text-gray-600 max-w-xl">{stageMessage}</p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-8">
            <ProgressRing progress={progress} size={168} />
            <div className="flex-1 w-full">
              <div className="h-2 w-full rounded-full bg-black/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-brand-600 transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>{activeStage?.label ?? stageLabel}</span>
                <span>{elapsed}s elapsed</span>
              </div>
            </div>
          </div>

          <ol className="mt-10 space-y-1">
            {STAGES.filter((s) => s.key !== "COMPLETED").map((s, i) => {
              const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "todo";
              return (
                <li
                  key={s.key}
                  className={
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors " +
                    (state === "active" ? "bg-brand-50 ring-1 ring-brand-100" : "")
                  }
                >
                  <span
                    className={
                      "grid place-items-center w-7 h-7 rounded-full text-xs shrink-0 " +
                      (state === "done"
                        ? "bg-brand-600 text-white"
                        : state === "active"
                          ? "bg-white text-brand-700 ring-2 ring-brand-400 animate-pulse-soft"
                          : "bg-black/5 text-gray-400")
                    }
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0">
                    <span className={state === "todo" ? "text-gray-400" : "text-gray-900 font-medium"}>{s.label}</span>
                    {state === "active" && <p className="text-xs text-gray-500 mt-0.5 truncate">{s.message}</p>}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-8">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              {showDetails ? "Hide" : "Show"} technical details
            </button>
            {showDetails && (
              <pre className="mt-3 max-h-52 overflow-auto rounded-xl bg-gray-900 p-4 text-xs text-gray-200 font-mono">
                {logs.length ? logs.join("\n") : "Waiting for logs…"}
              </pre>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft lg:sticky lg:top-6">
          <h2 className="text-sm font-semibold text-gray-900">Job details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {job?.title && (
              <div>
                <dt className="text-gray-500 text-xs">Title</dt>
                <dd className="mt-0.5 font-medium truncate">{job.title}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 text-xs">Prototype</dt>
              <dd className="mt-0.5 font-medium truncate text-brand-700">{job?.url ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs">Output format</dt>
              <dd className="mt-0.5 font-medium">WebM · VP8</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs">Job ID</dt>
              <dd className="mt-0.5 font-mono text-xs text-gray-600 truncate">{id}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Result({
  job,
  id,
  resultTab,
  setResultTab,
}: {
  job: PublicJob;
  id: string;
  resultTab: "preview" | "script";
  setResultTab: (t: "preview" | "script") => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
            <span className="grid place-items-center w-5 h-5 rounded-full bg-brand-600 text-white text-xs">✓</span>
            Export complete
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{job.title ?? "Your walkthrough"}</h1>
          <p className="mt-2 text-gray-600">
            Preview, download, or share your recording. The generated script is available for review and reuse.
          </p>
        </div>
        <Link
          href="/create"
          className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium hover:bg-black/5 shrink-0"
        >
          Create another
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex gap-1 rounded-xl bg-black/[0.04] p-1 w-fit">
            <TabButton active={resultTab === "preview"} onClick={() => setResultTab("preview")}>
              Preview
            </TabButton>
            <TabButton active={resultTab === "script"} onClick={() => setResultTab("script")}>
              Script
            </TabButton>
          </div>

          <div className="mt-4">
            {resultTab === "preview" ? (
              <div className="rounded-2xl border border-black/5 bg-white shadow-soft p-3">
                <video
                  controls
                  playsInline
                  className="w-full rounded-xl bg-black aspect-video"
                  src={`/api/jobs/${id}/video?inline=1`}
                />
                <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 px-2 pb-2 text-sm">
                  <Meta k="Duration" v={job.metrics.durationSeconds ? `${job.metrics.durationSeconds.toFixed(1)}s` : "—"} />
                  <Meta k="Resolution" v={job.metrics.width ? `${job.metrics.width}×${job.metrics.height}` : "—"} />
                  <Meta k="Size" v={fmtSize(job.metrics.fileSizeBytes)} />
                  <Meta k="Created" v={new Date(job.createdAt).toLocaleString()} />
                </dl>
              </div>
            ) : (
              <ScriptPanel jobId={id} hasScript={job.hasScript} />
            )}
          </div>

          {job.expiresAt && (
            <p className="mt-4 text-xs text-gray-500">
              Files are available until {new Date(job.expiresAt).toLocaleString()}.
            </p>
          )}
        </div>

        <ShareHub
          jobId={id}
          title={job.title}
          hasVideo={job.hasVideo}
          hasOptimizedVideo={job.hasOptimizedVideo}
          durationSeconds={job.metrics.durationSeconds}
          width={job.metrics.width}
          height={job.metrics.height}
          fileSizeBytes={job.metrics.fileSizeBytes}
        />
      </div>
    </div>
  );
}

function Failure({ job, category, logs }: { job: PublicJob | null; category: string | null; logs: string[] }) {
  const copy = job?.error ?? {
    title: "Something went wrong",
    explanation: "An unexpected error occurred.",
    nextStep: "Please try again.",
  };
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-8 shadow-soft">
        <div className="w-12 h-12 grid place-items-center rounded-2xl bg-amber-100 text-2xl">⚠️</div>
        <h1 className="mt-4 text-2xl font-semibold text-amber-950">{copy.title}</h1>
        <p className="mt-3 text-amber-900/90 leading-relaxed">{copy.explanation}</p>
        <p className="mt-3 text-sm text-amber-900">
          <span className="font-medium">Suggested next step:</span> {copy.nextStep}
        </p>
        {category && <p className="mt-4 text-xs text-amber-700/70 font-mono">Reference: {category}</p>}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/create" className="rounded-xl bg-brand-600 px-5 py-3 text-white font-medium hover:bg-brand-700 shadow-soft">
          Try again
        </Link>
        <Link href="/create" className="rounded-xl border border-black/10 px-5 py-3 font-medium hover:bg-black/5">
          Edit instructions
        </Link>
      </div>

      {logs.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            {showLogs ? "Hide" : "Show"} technical logs
          </button>
          {showLogs && (
            <pre className="mt-3 max-h-52 overflow-auto rounded-xl bg-gray-900 p-4 text-xs text-gray-200 font-mono">
              {logs.join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg px-4 py-2 text-sm font-medium transition-colors " +
        (active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")
      }
    >
      {children}
    </button>
  );
}

function fmtSize(bytes?: number) {
  if (!bytes) return "—";
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-gray-500 text-xs">{k}</dt>
      <dd className="mt-0.5 font-medium text-gray-900">{v}</dd>
    </div>
  );
}
