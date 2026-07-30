"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import "./hero-carousel.css";

const PANEL_MS = 5000;

const PANELS = [
  {
    src: "/hero/hero-panel-1-prototype.png",
    eyebrow: "The problem",
    title: "Great prototypes go unnoticed",
    description: "Designers ship polished Figma flows that never get the attention they deserve.",
  },
  {
    src: "/hero/hero-panel-2-ignored.png",
    eyebrow: "The problem",
    title: "Nobody clicks through",
    description: "Stakeholders don't have time to explore a link — the work sits unread in Slack threads.",
  },
  {
    src: "/hero/hero-panel-3-unused.png",
    eyebrow: "The problem",
    title: "Impact never lands",
    description: "Without a guided tour, even the best interaction design fails to communicate value.",
  },
  {
    src: "/hero/hero-panel-4-record.png",
    eyebrow: "The solution",
    title: "Automated walkthrough recording",
    description: "Paste a URL, describe the journey, and get a smooth screen recording with a visible cursor.",
  },
  {
    src: "/hero/hero-panel-5-share.png",
    eyebrow: "The solution",
    title: "Built to be shared",
    description: "Drop the video into decks, Slack, and boardrooms — no install, no friction.",
  },
  {
    src: "/hero/hero-panel-6-win.png",
    eyebrow: "The outcome",
    title: "Design gets the room",
    description: "When people can see the flow, the work speaks for itself.",
  },
] as const;

function normalizeIndex(index: number): number {
  return ((index % PANELS.length) + PANELS.length) % PANELS.length;
}

/** Polished illustration carousel — professional marketing art, one panel at a time. */
export function HeroStoryGraphic() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((index: number) => {
    setActive(normalizeIndex(index));
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setActive((prev) => normalizeIndex(prev + 1));
    }, PANEL_MS);
    return () => clearInterval(t);
  }, [paused]);

  const panel = PANELS[active];

  return (
    <div
      className="hero-carousel group relative overflow-hidden rounded-xl border border-black/[0.06] bg-slate-950 shadow-soft"
      role="region"
      aria-label="Product story"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-slate-100 via-white to-indigo-50">
        {PANELS.map((p, i) => (
          <div
            key={p.src}
            className={
              "absolute inset-0 transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
              (i === active
                ? "opacity-100 scale-100 z-10"
                : "opacity-0 scale-[1.02] z-0 pointer-events-none")
            }
            aria-hidden={i !== active}
          >
            {(i === active || i === normalizeIndex(active - 1)) && (
              <Image
                src={p.src}
                alt=""
                fill
                priority={i === 0}
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 1200px"
              />
            )}
          </div>
        ))}

        <div className="hero-grid pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-slate-950/95 via-slate-950/55 to-transparent"
          aria-hidden
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 px-5 pb-5 pt-16 sm:px-8 sm:pb-7">
        <div className="hero-caption-panel max-w-xl rounded-xl border border-white/10 bg-slate-950/55 px-5 py-4 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <p className="hero-caption-eyebrow text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-200">
            {panel.eyebrow}
          </p>
          <h2
            key={`title-${active}`}
            className="hero-caption-title mt-1.5 text-xl sm:text-2xl font-semibold tracking-tight text-white"
          >
            {panel.title}
          </h2>
          <p
            key={`desc-${active}`}
            className="hero-caption-desc mt-2 text-sm sm:text-[15px] leading-relaxed text-slate-100 max-w-lg"
          >
            {panel.description}
          </p>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <div className="flex items-center gap-2">
            {PANELS.map((p, i) => (
              <button
                key={p.src}
                type="button"
                aria-label={`Show panel ${i + 1}: ${p.title}`}
                aria-current={i === active ? "step" : undefined}
                onClick={() => go(i)}
                className={
                  "rounded-full transition-all duration-500 " +
                  (i === active ? "h-2 w-7 bg-white" : "h-2 w-2 bg-white/35 hover:bg-white/55")
                }
              />
            ))}
          </div>
          <div className="hidden sm:block flex-1 max-w-[200px] h-px bg-white/15 overflow-hidden rounded-full">
            <div
              key={active}
              className="hero-carousel-progress h-full bg-indigo-400/80 origin-left"
              style={{ animationDuration: paused ? "0ms" : `${PANEL_MS}ms` }}
            />
          </div>
          <span className="text-xs tabular-nums text-white/40 ml-auto">
            {String(active + 1).padStart(2, "0")} / {String(PANELS.length).padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
