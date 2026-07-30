"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectBar } from "@/components/studio/ProjectBar";
import { StudioShell } from "@/components/studio/StudioShell";

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

const WIZARD_STEPS = [
  { id: 1, label: "Import", desc: "Prototype URL" },
  { id: 2, label: "Brief", desc: "Instructions" },
  { id: 3, label: "Output", desc: "Format settings" },
  { id: 4, label: "Export", desc: "Start render" },
] as const;

export default function CreatePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [instructions, setInstructions] = useState("");
  const [title, setTitle] = useState("");
  const [durationTarget, setDurationTarget] = useState("auto");
  const [viewport, setViewport] = useState<keyof typeof VIEWPORT_PREVIEWS>("desktop");
  const [pacing, setPacing] = useState("standard");
  const [outputName, setOutputName] = useState("");
  const [includeOptimizedCopy, setIncludeOptimizedCopy] = useState(true);
  const [keepDiagnostics, setKeepDiagnostics] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const vp = VIEWPORT_PREVIEWS[viewport];
  const activeStep = !url ? 1 : !instructions ? 2 : 3;

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
    <StudioShell breadcrumb={[{ label: "New project" }]}>
      <ProjectBar
        title="New walkthrough project"
        subtitle="Import your prototype, write a brief, and send it to the render queue."
        status="draft"
      />

      <div className="grid gap-8 lg:grid-cols-[220px_1fr_240px]">
        <aside className="hidden lg:block">
          <nav className="space-y-1">
            {WIZARD_STEPS.map((step) => {
              const isActive = step.id === activeStep;
              const isDone = step.id < activeStep;
              return (
                <div
                  key={step.id}
                  className={
                    "rounded-lg px-3 py-2.5 border transition-colors " +
                    (isActive
                      ? "border-brand-500/40 bg-brand-500/10"
                      : isDone
                        ? "border-studio-800 bg-studio-900/40"
                        : "border-transparent opacity-50")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "grid place-items-center h-5 w-5 rounded-full text-[10px] font-bold " +
                        (isDone
                          ? "bg-brand-500 text-white"
                          : isActive
                            ? "bg-brand-400/30 text-brand-200 ring-1 ring-brand-400/50"
                            : "bg-studio-800 text-studio-500")
                      }
                    >
                      {isDone ? "✓" : step.id}
                    </span>
                    <span className={"text-sm font-medium " + (isActive ? "text-white" : "text-studio-300")}>
                      {step.label}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-7 text-[11px] text-studio-500">{step.desc}</p>
                </div>
              );
            })}
          </nav>
        </aside>

        <div>
          {errors.length > 0 && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <ul className="list-disc pl-5 space-y-1">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={submit} className="space-y-6">
            <section className="studio-panel p-5 sm:p-6 space-y-5">
              <SectionHeader step={1} title="Import prototype" subtitle="Paste a published Figma Site or prototype URL." />
              <Field label="Prototype URL">
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-prototype.figma.site"
                  className="studio-input"
                />
              </Field>
              <Field label="Project title (optional)">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="studio-input"
                  placeholder="Onboarding demo"
                />
              </Field>
            </section>

            <section className="studio-panel p-5 sm:p-6 space-y-5">
              <SectionHeader step={2} title="Write the brief" subtitle="Describe the journey in plain English — we turn it into a script." />
              <Field label="Instructions">
                <textarea
                  required
                  rows={5}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder={EXAMPLE}
                  className="studio-input resize-y min-h-[120px]"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {EXAMPLE_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setInstructions(chip)}
                      className="rounded-full border border-studio-700 bg-studio-950 px-3 py-1 text-xs text-studio-400 hover:border-brand-500/40 hover:text-brand-200 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </Field>
            </section>

            <section className="studio-panel p-5 sm:p-6 space-y-5">
              <SectionHeader step={3} title="Output settings" subtitle="Viewport, duration, and encoding options." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Duration">
                  <select value={durationTarget} onChange={(e) => setDurationTarget(e.target.value)} className="studio-input">
                    <option value="auto">Auto</option>
                    <option value="30">30 seconds</option>
                    <option value="60">60 seconds</option>
                    <option value="90">90 seconds</option>
                  </select>
                </Field>
                <Field label="Pacing">
                  <select value={pacing} onChange={(e) => setPacing(e.target.value)} className="studio-input">
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
                          "rounded-lg border p-3 text-left transition-all " +
                          (active
                            ? "border-brand-500/50 bg-brand-500/10 ring-1 ring-brand-500/30"
                            : "border-studio-700 hover:border-studio-600")
                        }
                      >
                        <span className="block text-xs font-medium text-studio-200">{v.label}</span>
                        <span className="block text-[10px] text-studio-500 mt-0.5">
                          {v.w}×{v.h}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Field>

              <details className="group">
                <summary className="cursor-pointer text-xs text-studio-500 hover:text-studio-300 transition-colors">
                  Advanced encoding options
                </summary>
                <div className="mt-4 space-y-4 pt-4 border-t border-studio-800">
                  <Field label="Custom output name">
                    <input
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      className="studio-input"
                      placeholder="my-walkthrough"
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-studio-400">
                    <input
                      type="checkbox"
                      checked={includeOptimizedCopy}
                      onChange={(e) => setIncludeOptimizedCopy(e.target.checked)}
                      className="rounded border-studio-600"
                    />
                    Include optimized VP9 copy
                  </label>
                  <label className="flex items-center gap-2 text-sm text-studio-400">
                    <input
                      type="checkbox"
                      checked={keepDiagnostics}
                      onChange={(e) => setKeepDiagnostics(e.target.checked)}
                      className="rounded border-studio-600"
                    />
                    Keep diagnostic artifacts
                  </label>
                </div>
              </details>
            </section>

            <p className="text-xs text-studio-600 leading-relaxed">
              By generating a walkthrough you allow this service to open and interact with the URL you provide in an
              automated browser. Your prototype credentials are never requested or stored.
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand-600 px-5 py-3.5 text-white font-medium hover:bg-brand-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending to render queue…
                </>
              ) : (
                <>Start export →</>
              )}
            </button>
          </form>
        </div>

        <aside className="hidden lg:block">
          <div className="studio-panel p-4 sticky top-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-studio-500">Canvas preview</p>
            <div
              className="mt-3 mx-auto rounded-md border border-studio-700 bg-studio-950 flex items-center justify-center"
              style={{
                aspectRatio: `${vp.w}/${vp.h}`,
                maxHeight: viewport === "mobile" ? 200 : 140,
                width: viewport === "mobile" ? 88 : "100%",
              }}
            >
              <span className="text-[10px] text-studio-600">{vp.w}×{vp.h}</span>
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              <PreviewRow k="Format" v="WebM · VP8" />
              <PreviewRow k="Viewport" v={vp.label} />
              <PreviewRow k="Duration" v={durationTarget === "auto" ? "Auto" : `${durationTarget}s`} />
              <PreviewRow k="Pacing" v={pacing} />
            </dl>
          </div>
        </aside>
      </div>
    </StudioShell>
  );
}

function SectionHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">Step {step}</p>
      <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm text-studio-400">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-studio-300">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function PreviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-studio-600">{k}</dt>
      <dd className="font-medium text-studio-300 capitalize">{v}</dd>
    </div>
  );
}
