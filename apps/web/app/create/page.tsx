"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLE =
  "Start on the home page, sign in using the prototype button, search for Fusion, open the first result, visit the Benefits tab, and return home.";

const EXAMPLE_CHIPS = [
  "Sign in and explore the dashboard",
  "Search for a product and open its detail page",
  "Walk through the onboarding flow from start to finish",
];

const VIEWPORT_PREVIEWS = {
  desktop: { w: 1440, h: 900, label: "Desktop" },
  laptop: { w: 1280, h: 800, label: "Laptop" },
  mobile: { w: 390, h: 844, label: "Mobile" },
} as const;

export default function CreatePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [instructions, setInstructions] = useState("");
  const [title, setTitle] = useState("");
  const [durationTarget, setDurationTarget] = useState("auto");
  const [viewport, setViewport] = useState<keyof typeof VIEWPORT_PREVIEWS>("desktop");
  const [pacing, setPacing] = useState("standard");
  const [customize, setCustomize] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [outputName, setOutputName] = useState("");
  const [includeOptimizedCopy, setIncludeOptimizedCopy] = useState(true);
  const [keepDiagnostics, setKeepDiagnostics] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const vp = VIEWPORT_PREVIEWS[viewport];

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
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Step n={1} label="Describe" active />
        <span className="text-gray-300">→</span>
        <Step n={2} label="Generate" />
        <span className="text-gray-300">→</span>
        <Step n={3} label="Export" />
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Create a walkthrough</h1>
      <p className="mt-2 text-gray-600 max-w-xl">
        Paste your prototype and describe the journey. We&apos;ll inspect it, write a script, record with a smooth cursor,
        and hand you a share-ready video.
      </p>

      {errors.length > 0 && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <ul className="list-disc pl-5 space-y-1">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submit} className="mt-8 space-y-8">
        <section className="card p-6 space-y-6">
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

          <Field label="What should the walkthrough show?" hint="Describe the journey in plain English — we'll turn it into a script.">
            <textarea
              required
              rows={5}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={EXAMPLE}
              className="input resize-y min-h-[120px]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setInstructions(chip)}
                  className="rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-xs text-gray-600 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-800 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Title (optional)" hint="Shown on the export page and in share links.">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Onboarding demo" />
          </Field>
        </section>

        <section className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setCustomize((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-black/[0.02] transition-colors"
          >
            <div>
              <span className="block text-sm font-medium text-gray-900">Customize output</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                {vp.label} · {vp.w}×{vp.h} · {durationTarget === "auto" ? "Auto duration" : `${durationTarget}s`}
              </span>
            </div>
            <span className="text-gray-400 text-sm">{customize ? "▲" : "▼"}</span>
          </button>

          {customize && (
            <div className="border-t border-black/5 p-5 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Approximate duration">
                  <select value={durationTarget} onChange={(e) => setDurationTarget(e.target.value)} className="input">
                    <option value="auto">Auto</option>
                    <option value="30">30 seconds</option>
                    <option value="60">60 seconds</option>
                    <option value="90">90 seconds</option>
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

              <Field label="Viewport">
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(VIEWPORT_PREVIEWS) as Array<keyof typeof VIEWPORT_PREVIEWS>).map((key) => {
                    const v = VIEWPORT_PREVIEWS[key];
                    const active = viewport === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setViewport(key)}
                        className={
                          "rounded-xl border p-3 text-left transition-all " +
                          (active
                            ? "border-brand-400 bg-brand-50 ring-2 ring-brand-200"
                            : "border-black/10 hover:border-black/20")
                        }
                      >
                        <span className="block text-xs font-medium text-gray-900">{v.label}</span>
                        <span className="block text-[10px] text-gray-500 mt-0.5">
                          {v.w}×{v.h}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-gray-700 hover:bg-black/[0.02]"
          >
            Advanced settings
            <span className="text-gray-400">{advanced ? "▲" : "▼"}</span>
          </button>
          {advanced && (
            <div className="border-t border-black/5 p-5 space-y-4">
              <Field label="Custom output name">
                <input value={outputName} onChange={(e) => setOutputName(e.target.value)} className="input" placeholder="my-walkthrough" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeOptimizedCopy} onChange={(e) => setIncludeOptimizedCopy(e.target.checked)} />
                Include an optimized (VP9) copy for smaller file size
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={keepDiagnostics} onChange={(e) => setKeepDiagnostics(e.target.checked)} />
                Keep diagnostic artifacts (for troubleshooting)
              </label>
            </div>
          )}
        </section>

        <p className="text-xs text-gray-500 leading-relaxed">
          By generating a walkthrough you allow this service to open and interact with the URL you provide in an
          automated browser. Your prototype credentials are never requested or stored.
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-brand-600 px-5 py-3.5 text-white font-medium hover:bg-brand-700 shadow-soft disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Starting export…
            </>
          ) : (
            <>Generate walkthrough →</>
          )}
        </button>
      </form>
    </div>
  );
}

function Step({ n, label, active }: { n: number; label: string; active?: boolean }) {
  return (
    <span className={"inline-flex items-center gap-1.5 " + (active ? "text-brand-700 font-medium" : "")}>
      <span
        className={
          "grid place-items-center w-5 h-5 rounded-full text-[10px] font-semibold " +
          (active ? "bg-brand-600 text-white" : "bg-black/5 text-gray-400")
        }
      >
        {n}
      </span>
      {label}
    </span>
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
