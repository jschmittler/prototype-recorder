"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PublicJob } from "@ptw/job-contracts";
import { ProjectBar } from "@/components/studio/ProjectBar";
import { StudioShell } from "@/components/studio/StudioShell";
import { PreflightPanel, type PreflightReport } from "@/components/PreflightPanel";
import { draftFromPublicJob, settingsFromDraft } from "@/lib/job-draft";
import { rememberJob } from "@/lib/recent-jobs";

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
  return (
    <Suspense fallback={<CreatePageFallback />}>
      <CreatePageInner />
    </Suspense>
  );
}

function CreatePageFallback() {
  return (
    <StudioShell breadcrumb={[{ label: "New project" }]}>
      <ProjectBar title="New walkthrough project" subtitle="Loading…" status="draft" />
      <p className="text-sm text-studio-500">Loading project…</p>
    </StudioShell>
  );
}

function CreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromJobId = searchParams.get("from");

  // Handed over from the home-page composer.
  const [url, setUrl] = useState(() => searchParams.get("url") ?? "");
  const [instructions, setInstructions] = useState(() => searchParams.get("brief") ?? "");
  const [title, setTitle] = useState("");
  const [durationTarget, setDurationTarget] = useState("auto");
  const [viewport, setViewport] = useState<keyof typeof VIEWPORT_PREVIEWS>("desktop");
  const [pacing, setPacing] = useState("standard");
  const [outputName, setOutputName] = useState("");
  const [includeOptimizedCopy, setIncludeOptimizedCopy] = useState(true);
  const [keepDiagnostics, setKeepDiagnostics] = useState(false);
  const [ignoreOverlayText, setIgnoreOverlayText] = useState<string[]>([]);
  const [script, setScript] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(!!fromJobId);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // The brief the restored script was written for — used to detect staleness.
  const [scriptBrief, setScriptBrief] = useState("");
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [checkedScript, setCheckedScript] = useState("");
  const [reportGenerated, setReportGenerated] = useState(false);
  const [repairs, setRepairs] = useState(0);
  const [repairedFrom, setRepairedFrom] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!fromJobId) return;
    let cancelled = false;

    (async () => {
      try {
        const jobRes = await fetch(`/api/jobs/${fromJobId}`);
        if (!jobRes.ok) throw new Error("Job not found");
        const job = (await jobRes.json()) as PublicJob;

        let scriptContent = "";
        if (job.hasScript) {
          const scriptRes = await fetch(`/api/jobs/${fromJobId}/script?preview=1`);
          if (scriptRes.ok) {
            const data = (await scriptRes.json()) as { content?: string };
            scriptContent = data.content ?? "";
          }
        }

        if (cancelled) return;
        const draft = draftFromPublicJob(job, scriptContent);
        setUrl(draft.url);
        setInstructions(draft.instructions);
        setTitle(draft.title);
        setDurationTarget(draft.durationTarget);
        setViewport(draft.viewport);
        setPacing(draft.pacing);
        setOutputName(draft.outputName);
        setIncludeOptimizedCopy(draft.includeOptimizedCopy);
        setKeepDiagnostics(draft.keepDiagnostics);
        setIgnoreOverlayText(draft.ignoreOverlayText);
        setScript(draft.script);
        setScriptBrief(draft.script ? draft.instructions : "");
        if (draft.script) setAdvancedOpen(true);
        setDraftNote(
          scriptContent
            ? "Restored your previous project settings and walkthrough script."
            : "Restored your previous project settings."
        );
      } catch {
        if (!cancelled) setErrors(["Could not load the previous project — start fresh or try again."]);
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fromJobId]);

  const vp = VIEWPORT_PREVIEWS[viewport];
  const activeStep = !url ? 1 : !instructions ? 2 : 3;
  const scriptIsStale = Boolean(script.trim()) && Boolean(scriptBrief) && instructions.trim() !== scriptBrief.trim();

  function currentSettings() {
    return settingsFromDraft({
      title,
      durationTarget,
      viewport,
      pacing,
      outputName,
      includeOptimizedCopy,
      keepDiagnostics,
      ignoreOverlayText,
    });
  }

  async function check() {
    setChecking(true);
    setErrors([]);
    setReport(null);
    try {
      const res = await fetch("/api/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          instructions,
          settings: currentSettings(),
          ...(script.trim() && !scriptIsStale ? { script: script.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrors(data.errors ?? ["Preflight could not complete."]);
        return;
      }
      setReport(data.report);
      setCheckedScript(data.script ?? "");
      setReportGenerated(Boolean(data.generated));
      setRepairs(data.repairs ?? 0);
      setRepairedFrom(data.repairedFrom);
    } catch {
      setErrors(["Network error while checking the script."]);
    } finally {
      setChecking(false);
    }
  }

  function useCheckedScript() {
    if (!checkedScript) return;
    setScript(checkedScript);
    setScriptBrief(instructions);
    setAdvancedOpen(true);
    setReportGenerated(false);
    setRepairs(0);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);
    try {
      const body: Record<string, unknown> = {
        url,
        instructions,
        idempotencyKey: crypto.randomUUID(),
        settings: currentSettings(),
      };
      // A script written for a different brief would silently ignore the edit.
      if (script.trim() && !scriptIsStale) body.script = script.trim();

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Something went wrong."]);
        setSubmitting(false);
        return;
      }
      rememberJob(data.job.id);
      router.push(`/jobs/${data.job.id}`);
    } catch {
      setErrors(["Network error — please try again."]);
      setSubmitting(false);
    }
  }

  if (loadingDraft) {
    return <CreatePageFallback />;
  }

  return (
    <StudioShell breadcrumb={[{ label: "New project" }]}>
      <ProjectBar
        title={fromJobId ? "Retry walkthrough project" : "New walkthrough project"}
        subtitle={
          fromJobId
            ? "Settings restored from your last run — edit anything, then export again."
            : "Import your prototype, write a brief, and send it to the render queue."
        }
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
          {draftNote && (
            <div className="mb-6 rounded-lg border border-brand-500/30 bg-brand-500/10 p-4 text-sm text-brand-100">
              {draftNote}
            </div>
          )}

          {errors.length > 0 && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <ul className="list-disc pl-5 space-y-1">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {report && (
            <PreflightPanel
              report={report}
              generated={reportGenerated}
              repairs={repairs}
              repairedFrom={repairedFrom}
              onUseScript={useCheckedScript}
            />
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

              <details className="group" open={advancedOpen}>
                <summary
                  className="cursor-pointer text-xs text-studio-500 hover:text-studio-300 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    setAdvancedOpen((v) => !v);
                  }}
                >
                  Advanced encoding & script options
                </summary>
                {advancedOpen && (
                  <div className="mt-4 space-y-4 pt-4 border-t border-studio-800">
                    <Field label="Custom output name">
                      <input
                        value={outputName}
                        onChange={(e) => setOutputName(e.target.value)}
                        className="studio-input"
                        placeholder="my-walkthrough"
                      />
                    </Field>
                    <Field label="Walkthrough script (optional)">
                      <textarea
                        rows={8}
                        value={script}
                        onChange={(e) => {
                          setScript(e.target.value);
                          setScriptBrief(instructions);
                        }}
                        placeholder="Leave empty to generate a fresh script from your brief. Paste or edit a script here to skip AI generation and re-run recording."
                        className="studio-input resize-y min-h-[160px] font-mono text-xs"
                      />
                      {scriptIsStale ? (
                        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                          <p className="text-[11px] text-amber-100">
                            Your brief changed, so this saved script will be ignored and a new one generated.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setScript("");
                              setScriptBrief("");
                            }}
                            className="text-[11px] font-medium text-amber-200 underline underline-offset-2"
                          >
                            Discard it
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-studio-600 leading-relaxed">
                          A saved script is reused exactly as-is, skipping AI generation — the same journey records the
                          same way every time.
                        </p>
                      )}
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
                )}
              </details>
            </section>

            <p className="text-xs text-studio-600 leading-relaxed">
              By generating a walkthrough you allow this service to open and interact with the URL you provide in an
              automated browser. Your prototype credentials are never requested or stored.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={check}
                disabled={checking || submitting || !url || (!instructions && !script.trim())}
                className="sm:w-56 rounded-lg border border-studio-600 px-5 py-3.5 text-studio-100 font-medium hover:bg-studio-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {checking ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-studio-500/40 border-t-studio-200 rounded-full animate-spin" />
                    {script.trim() && !scriptIsStale ? "Checking steps…" : "Exploring prototype…"}
                  </>
                ) : (
                  <>Check before recording</>
                )}
              </button>
              <button
                type="submit"
                disabled={submitting || checking}
                className="flex-1 rounded-lg bg-brand-600 px-5 py-3.5 text-white font-medium hover:bg-brand-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
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
            </div>
            <p className="text-xs text-studio-600">
              {script.trim() && !scriptIsStale
                ? "Checking dry-runs every step against the live prototype — no video — in about ten seconds."
                : "Checking opens your prototype, maps a few screens, writes a script, and dry-runs every step — about a minute. Save the script afterwards and later checks take seconds."}{" "}
              Steps that fail are repaired automatically where possible.
            </p>
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
              {script.trim() && <PreviewRow k="Script" v="Manual override" />}
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
