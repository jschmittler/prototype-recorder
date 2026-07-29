import Link from "next/link";

const STEPS = [
  { n: "1", t: "Paste your prototype", d: "Drop in a published Figma prototype URL." },
  { n: "2", t: "Describe the journey", d: "Say what the walkthrough should show, in plain English." },
  { n: "3", t: "Download the video", d: "We record it with a smooth cursor and hand you a WebM." },
];

const BENEFITS = [
  { t: "No tools to install", d: "Everything runs on our servers — no Node, Chromium, or FFmpeg on your machine." },
  { t: "Readable, human motion", d: "A visible cursor and smooth scrolling make the result feel hand-driven." },
  { t: "You stay in control", d: "Download the generated script, tweak your instructions, and re-run." },
];

const FAQ = [
  { q: "What kind of URL works best?", a: "A publicly reachable published prototype (e.g. a Figma Site). Login-gated links aren't supported in the hosted flow yet." },
  { q: "Do you store my prototype?", a: "We open the URL you submit and keep generated files temporarily. We never ask for or store Figma passwords." },
  { q: "How long does it take?", a: "Usually under a couple of minutes, depending on the length of the journey." },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 to-transparent" />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <p className="text-sm font-medium text-brand-700">Prototype Walkthrough</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight max-w-2xl">
            Turn a prototype into a polished walkthrough video.
          </h1>
          <p className="mt-5 text-lg text-gray-600 max-w-xl">
            Paste a prototype link, describe the journey in plain English, and get a smooth, narratable
            screen recording you can share.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link href="/create" className="rounded-xl bg-brand-600 px-5 py-3 text-white font-medium hover:bg-brand-700 shadow-soft">
              Create walkthrough
            </Link>
            <a href="#how" className="rounded-xl px-5 py-3 font-medium text-gray-700 hover:bg-black/5">
              View tutorial
            </a>
          </div>

          <div className="mt-14 rounded-2xl border border-black/5 bg-white shadow-soft p-3">
            <div className="aspect-video rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 grid place-items-center text-white/80">
              <div className="text-center">
                <div className="text-5xl">▶</div>
                <p className="mt-2 text-sm text-white/60">Your walkthrough preview appears here</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <div className="w-9 h-9 grid place-items-center rounded-lg bg-brand-100 text-brand-700 font-semibold">{s.n}</div>
              <h3 className="mt-4 font-medium">{s.t}</h3>
              <p className="mt-1 text-sm text-gray-600">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.t}>
              <h3 className="font-medium">{b.t}</h3>
              <p className="mt-1 text-sm text-gray-600">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
        <dl className="mt-6 divide-y divide-black/5">
          {FAQ.map((f) => (
            <div key={f.q} className="py-4">
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 text-sm text-gray-600">{f.a}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8">
          <Link href="/create" className="rounded-xl bg-brand-600 px-5 py-3 text-white font-medium hover:bg-brand-700 shadow-soft">
            Create your first walkthrough
          </Link>
        </div>
      </section>
    </div>
  );
}
