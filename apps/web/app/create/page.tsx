"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLE =
  "Start on the home page, sign in using the prototype button, search for Fusion, open the first result, visit the Benefits tab, and return home.";

export default function CreatePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [instructions, setInstructions] = useState("");
  const [title, setTitle] = useState("");
  const [durationTarget, setDurationTarget] = useState("auto");
  const [viewport, setViewport] = useState("desktop");
  const [pacing, setPacing] = useState("standard");
  const [advanced, setAdvanced] = useState(false);
  const [outputName, setOutputName] = useState("");
  const [includeOptimizedCopy, setIncludeOptimizedCopy] = useState(true);
  const [keepDiagnostics, setKeepDiagnostics] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          instructions,
          idempotencyKey: crypto.randomUUID(),
          settings: {
            title: title || undefined,
            durationTarget,
            viewport,
            pacing,
            outputName: outputName || undefined,
            includeOptimizedCopy,
            keepDiagnostics,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Something went wrong."]);
        setSubmitting(false);
        return;
      }
      router.push(`/jobs/${data.job.id}`);
    } catch {
      setErrors(["Network error — please try again."]);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Create a walkthrough</h1>
      <p className="mt-2 text-gray-600">Give us a prototype and describe what to show. We'll do the rest.</p>

      {errors.length > 0 && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <ul className="list-disc pl-5 space-y-1">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submit} className="mt-8 space-y-6">
        <Field label="Prototype URL" hint="A publicly reachable published prototype (e.g. https://your-site.figma.site).">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-prototype.figma.site"
            className="input"
          />
        </Field>

        <Field label="What should the walkthrough show?" hint="Describe the journey in plain English.">
          <textarea
            required
            rows={5}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={EXAMPLE}
            className="input resize-y"
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Title (optional)">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Onboarding demo" />
          </Field>
          <Field label="Approximate duration">
            <select value={durationTarget} onChange={(e) => setDurationTarget(e.target.value)} className="input">
              <option value="auto">Auto</option>
              <option value="30">30 seconds</option>
              <option value="60">60 seconds</option>
              <option value="90">90 seconds</option>
            </select>
          </Field>
          <Field label="Viewport">
            <select value={viewport} onChange={(e) => setViewport(e.target.value)} className="input">
              <option value="desktop">Desktop — 1440 × 900</option>
              <option value="laptop">Laptop — 1280 × 800</option>
              <option value="mobile">Mobile — 390 × 844</option>
            </select>
          </Field>
          <Field label="Pacing">
            <select value={pacing} onChange={(e) => setPacing(e.target.value)} className="input">
              <option value="relaxed">Relaxed</option>
              <option value="standard">Standard</option>
              <option value="fast">Fast</option>
            </select>
          </Field>
        </div>

        <div className="rounded-xl border border-black/5">
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
          >
            Advanced settings
            <span className="text-gray-400">{advanced ? "▲" : "▼"}</span>
          </button>
          {advanced && (
            <div className="border-t border-black/5 p-4 space-y-4">
              <Field label="Custom output name">
                <input value={outputName} onChange={(e) => setOutputName(e.target.value)} className="input" placeholder="my-walkthrough" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeOptimizedCopy} onChange={(e) => setIncludeOptimizedCopy(e.target.checked)} />
                Include an optimized (VP9) copy
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={keepDiagnostics} onChange={(e) => setKeepDiagnostics(e.target.checked)} />
                Keep diagnostic artifacts (for troubleshooting)
              </label>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500">
          By generating a walkthrough you allow this service to open and interact with the URL you provide in an
          automated browser.
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-brand-600 px-5 py-3 text-white font-medium hover:bg-brand-700 shadow-soft disabled:opacity-60"
        >
          {submitting ? "Starting…" : "Generate walkthrough"}
        </button>
      </form>

      <style>{`
        .input { width:100%; border:1px solid rgba(0,0,0,0.12); border-radius:0.75rem; padding:0.625rem 0.75rem; background:white; font-size:0.925rem; }
        .input:focus { outline:none; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-800">{label}</span>
      {hint && <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}
