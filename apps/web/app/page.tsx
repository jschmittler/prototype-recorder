import { CompactIntro } from "@/components/CompactIntro";
import { IntentComposer } from "@/components/app/IntentComposer";
import { RecentWork } from "@/components/app/RecentWork";

const STEPS = [
  {
    n: "01",
    t: "Paste your prototype",
    d: "Any publicly reachable published prototype link.",
  },
  {
    n: "02",
    t: "Describe the journey",
    d: "Plain English. The script is written for you, then checked against the live page before recording.",
  },
  {
    n: "03",
    t: "Share the result",
    d: "Download the video, copy a link, or embed it. The script comes with it.",
  },
];

const FAQ = [
  {
    q: "What kind of link works best?",
    a: "A publicly reachable published prototype, such as a Figma Site. Login-gated links aren’t supported in the hosted flow yet.",
  },
  {
    q: "Do you store my prototype?",
    a: "We open the URL you submit and keep generated files temporarily. We never ask for or store Figma passwords.",
  },
  {
    q: "How long does it take?",
    a: "Usually under a couple of minutes, depending on the length of the journey.",
  },
];

export default function Home() {
  return (
    <>
      <CompactIntro />

      <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-6">
        {/* Work first: the composer sits immediately below the intro. */}
        <section aria-labelledby="start-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="start-heading" className="text-base font-medium text-ink-50">
              Start a walkthrough
            </h2>
            <span className="label-tech hidden sm:inline">Step 1 of 3</span>
          </div>
          <div className="mt-3">
            <IntentComposer />
          </div>
        </section>

        <section aria-labelledby="recent-heading" className="mt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="recent-heading" className="text-base font-medium text-ink-50">
              Continue your journey
            </h2>
            <span className="text-xs text-ink-400">Saved on this browser</span>
          </div>
          <div className="mt-3">
            <RecentWork />
          </div>
        </section>

        <section aria-labelledby="how-heading" className="mt-14">
          <h2 id="how-heading" className="text-base font-medium text-ink-50">
            How it works
          </h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="panel-quiet p-4">
                <span className="label-tech">{s.n}</span>
                <h3 className="mt-2 text-sm font-medium text-ink-100">{s.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-400">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq-heading" className="mt-14 max-w-2xl">
          <h2 id="faq-heading" className="text-base font-medium text-ink-50">
            Questions
          </h2>
          <dl className="mt-3 divide-y divide-ink-800 border-y border-ink-800">
            {FAQ.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="text-sm font-medium text-ink-100">{f.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink-400">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
