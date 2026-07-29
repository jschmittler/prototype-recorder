"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { STAGES, type JobEvent, type JobStatus, type PublicJob } from "@ptw/job-contracts";

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
        // fetch the public job for friendly copy
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

  if (status === "COMPLETED" && job) return <Result job={job} id={id} />;
  if (status === "FAILED") return <Failure job={job} category={errorCat} logs={logs} />;

  const currentIndex = STAGES.findIndex((s) => s.key === status);
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Creating your walkthrough</h1>
      <p className="mt-1 text-gray-600">{stageMessage}</p>

      <div className="mt-6 h-2 w-full rounded-full bg-black/5 overflow-hidden">
        <div className="h-full bg-brand-600 transition-[width] duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>{stageLabel}</span>
        <span>{elapsed}s elapsed</span>
      </div>

      <ol className="mt-8 space-y-2">
        {STAGES.filter((s) => s.key !== "COMPLETED").map((s, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "todo";
          return (
            <li key={s.key} className="flex items-center gap-3">
              <span
                className={
                  "grid place-items-center w-6 h-6 rounded-full text-xs " +
                  (state === "done"
                    ? "bg-brand-600 text-white"
                    : state === "active"
                      ? "bg-brand-100 text-brand-700 ring-2 ring-brand-300"
                      : "bg-black/5 text-gray-400")
                }
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={state === "todo" ? "text-gray-400" : "text-gray-800"}>{s.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-8">
        <button onClick={() => setShowDetails((v) => !v)} className="text-sm text-gray-500 hover:text-gray-800">
          {showDetails ? "Hide" : "Show"} technical details
        </button>
        {showDetails && (
          <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-200">
            {logs.length ? logs.join("\n") : "Waiting for logs…"}
          </pre>
        )}
      </div>
    </div>
  );
}

function fmtSize(bytes?: number) {
  if (!bytes) return "—";
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function Result({ job, id }: { job: PublicJob; id: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center gap-2 text-brand-700">
        <span className="grid place-items-center w-7 h-7 rounded-full bg-brand-100">✓</span>
        <span className="font-medium">Your walkthrough is ready</span>
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{job.title ?? "Walkthrough"}</h1>

      <div className="mt-6 rounded-2xl border border-black/5 bg-white shadow-soft p-3">
        <video controls className="w-full rounded-xl bg-black" src={`/api/jobs/${id}/video`} />
      </div>

      <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <Meta k="Duration" v={job.metrics.durationSeconds ? `${job.metrics.durationSeconds.toFixed(1)}s` : "—"} />
        <Meta k="Resolution" v={job.metrics.width ? `${job.metrics.width}×${job.metrics.height}` : "—"} />
        <Meta k="Size" v={fmtSize(job.metrics.fileSizeBytes)} />
        <Meta k="Created" v={new Date(job.createdAt).toLocaleString()} />
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        <a href={`/api/jobs/${id}/video`} className="rounded-xl bg-brand-600 px-5 py-3 text-white font-medium hover:bg-brand-700 shadow-soft">
          Download video
        </a>
        <a href={`/api/jobs/${id}/script`} className="rounded-xl border border-black/10 px-5 py-3 font-medium hover:bg-black/5">
          Download script
        </a>
        <Link href="/create" className="rounded-xl px-5 py-3 font-medium text-gray-700 hover:bg-black/5">
          Create another
        </Link>
      </div>
      {job.expiresAt && (
        <p className="mt-4 text-xs text-gray-500">Files are available until {new Date(job.expiresAt).toLocaleString()}.</p>
      )}
    </div>
  );
}

function Failure({ job, category, logs }: { job: PublicJob | null; category: string | null; logs: string[] }) {
  const copy = job?.error ?? {
    title: "Something went wrong",
    explanation: "An unexpected error occurred.",
    nextStep: "Please try again.",
  };
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-amber-900">{copy.title}</h1>
        <p className="mt-2 text-amber-800">{copy.explanation}</p>
        <p className="mt-1 text-amber-800"><strong>Next step:</strong> {copy.nextStep}</p>
        {category && <p className="mt-3 text-xs text-amber-700/80">Reference: {category}</p>}
      </div>
      <div className="mt-6 flex gap-3">
        <Link href="/create" className="rounded-xl bg-brand-600 px-5 py-3 text-white font-medium hover:bg-brand-700 shadow-soft">
          Try again
        </Link>
        <Link href="/create" className="rounded-xl border border-black/10 px-5 py-3 font-medium hover:bg-black/5">
          Edit instructions
        </Link>
      </div>
      {logs.length > 0 && (
        <pre className="mt-6 max-h-52 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-200">{logs.join("\n")}</pre>
      )}
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-gray-500">{k}</dt>
      <dd className="mt-0.5 font-medium text-gray-900">{v}</dd>
    </div>
  );
}
