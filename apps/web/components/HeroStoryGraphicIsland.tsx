"use client";

import dynamic from "next/dynamic";

const HeroStoryGraphicInner = dynamic(
  () => import("./HeroStoryGraphic").then((mod) => mod.HeroStoryGraphic),
  {
    ssr: false,
    loading: () => (
      <div
        className="aspect-[16/10] w-full rounded-xl bg-gradient-to-br from-slate-100 via-white to-indigo-50 animate-pulse"
        aria-hidden
      />
    ),
  }
);

/** Client-only island — keeps the carousel out of the server RSC graph. */
export default function HeroStoryGraphicIsland() {
  return <HeroStoryGraphicInner />;
}
