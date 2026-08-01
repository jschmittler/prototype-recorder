"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Mark } from "./brand/Mark";

const SESSION_KEY = "ft.intro.played";

/**
 * The intro, reduced from a full-viewport six-panel loop to a header band.
 *
 * Height is clamp(132px, 22vh, 208px) — inside the brief's 18–26% desktop and
 * 120–200px mobile targets. It plays once per session and then holds its settled
 * end state; it never loops, never blocks the actions beneath it, and renders
 * the settled state directly when motion is reduced or JS has not yet hydrated.
 */
export function CompactIntro() {
  // Start settled. Only a confirmed first visit in this session animates, so
  // there is no flash of pre-animation state on repeat views.
  const [phase, setPhase] = useState<"settled" | "playing">("settled");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Private mode: play once for this mount rather than failing closed.
    }
    setPhase("playing");
  }, []);

  const playing = phase === "playing";

  return (
    <section
      aria-label="Frodotyping"
      className="relative isolate overflow-hidden border-b border-ink-800"
      style={{ height: "clamp(132px, 22vh, 208px)" }}
    >
      {/* The band is far wider than the artwork, so the crop is anchored on the
          route rather than the centre. Narrow screens crop horizontally instead
          of vertically, so they anchor right to keep the destination in frame. */}
      <Image
        src="/intro-route.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover object-[88%_36%] sm:object-[50%_36%]"
        style={playing ? { animation: "fade-in var(--motion-intro) var(--ease-settle) both" } : undefined}
      />

      <div className="mx-auto flex h-full max-w-[1400px] flex-col justify-center px-5 sm:px-6">
        <div
          className="flex items-center gap-3.5"
          style={playing ? { animation: "fade-rise var(--motion-panel) var(--ease-settle) both" } : undefined}
        >
          <Mark size={51} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">Frodotyping</h1>
            <p className="mt-0.5 text-xs text-ink-400 sm:text-sm">Small prototypes. Long journeys.</p>
          </div>
        </div>
        <p
          className="mt-3 max-w-xl text-sm leading-relaxed text-ink-300"
          style={
            playing
              ? {
                  animation: "fade-rise var(--motion-panel) var(--ease-settle) both",
                  animationDelay: "140ms",
                }
              : undefined
          }
        >
          Turn a prototype link into a narrated walkthrough your stakeholders will actually watch.
        </p>
      </div>
    </section>
  );
}
