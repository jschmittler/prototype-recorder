"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLES = [
  "Walk through the checkout flow, pausing on the payment step",
  "Show the onboarding from sign-up to the first project",
  "Open Settings, change the theme, then return home",
];

/**
 * The primary entry point: a prototype link plus a description of the journey.
 *
 * Submitting hands off to /create with both values prefilled, so the existing
 * settings, preflight, and script workflow stays intact — this is a faster front
 * door onto that flow, not a replacement for it.
 */
export function IntentComposer() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [brief, setBrief] = useState("");
  const [touched, setTouched] = useState(false);

  const urlValid = /^https?:\/\/\S+\.\S+/.test(url.trim());
  const canSubmit = urlValid && brief.trim().length >= 10;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    const params = new URLSearchParams({ url: url.trim(), brief: brief.trim() });
    router.push(`/create?${params.toString()}`);
  }

  const showUrlError = touched && url.trim().length > 0 && !urlValid;

  return (
    <form onSubmit={submit} className="panel p-4 sm:p-5" aria-label="Start a new walkthrough">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="composer-url" className="label-tech shrink-0 sm:w-24">
          Prototype
        </label>
        <div className="flex-1">
          <input
            id="composer-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-prototype.figma.site"
            aria-invalid={showUrlError}
            aria-describedby={showUrlError ? "composer-url-error" : undefined}
            className="field"
          />
        </div>
      </div>

      {showUrlError && (
        <p id="composer-url-error" role="alert" className="mt-1.5 text-xs text-danger-400 sm:pl-24">
          That doesn’t look like a full link. Include https://
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="composer-brief" className="label-tech shrink-0 pt-2.5 sm:w-24">
          Journey
        </label>
        <textarea
          id="composer-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="Describe what the walkthrough should show, in plain English."
          className="field flex-1 resize-y leading-relaxed"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-24">
        <span className="label-tech mr-1">Try</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setBrief(ex)}
            className="rounded-full border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition-colors duration-fast hover:border-ink-600 hover:bg-ink-800 hover:text-ink-100"
          >
            {ex.length > 44 ? `${ex.slice(0, 44)}…` : ex}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 sm:pl-24">
        <button type="submit" disabled={!canSubmit} className="btn btn-primary">
          Plan this walkthrough
        </button>
        <p className="text-xs text-ink-400">
          You’ll review the script and check it against the live prototype before recording.
        </p>
      </div>
    </form>
  );
}
