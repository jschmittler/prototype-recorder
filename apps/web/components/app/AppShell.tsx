"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Mark, Wordmark } from "@/components/brand/Mark";
import { CommandPalette } from "./CommandPalette";

const GITHUB = "https://github.com/jschmittler/prototype-recorder";

/** Only destinations the product can actually deliver. */
const NAV = [
  { href: "/", label: "Home" },
  { href: "/create", label: "Create" },
];

function CommandHint() {
  // The modifier symbol depends on the platform, which is unknown during SSR.
  // Render the neutral form first, then refine on the client.
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod("⌘");
  }, []);
  return (
    <>
      <kbd className="kbd">{mod}</kbd>
      <kbd className="kbd">K</kbd>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-ink-200">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-signal-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Frodotyping, home">
            <Mark size={26} />
            <Wordmark className="hidden text-[15px] sm:inline" />
          </Link>

          <nav aria-label="Primary" className="ml-2 flex items-center gap-1">
            {NAV.map((item) => {
              const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={
                    "rounded-lg px-3 py-1.5 text-sm transition-colors duration-fast " +
                    (current ? "bg-ink-850 text-ink-50" : "text-ink-300 hover:bg-ink-900 hover:text-ink-100")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-ink-400 md:flex">
              <CommandHint />
              <span className="ml-0.5">to search</span>
            </span>
            <Link href="/create" className="btn btn-primary px-3.5 py-2 text-sm">
              New walkthrough
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-ink-800">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-6 text-xs text-ink-400 sm:px-6">
          <span>© {new Date().getFullYear()} Frodotyping · MIT</span>
          <div className="flex gap-6">
            <a href={GITHUB} target="_blank" rel="noreferrer" className="transition-colors duration-fast hover:text-ink-200">
              Repository
            </a>
            <a
              href={`${GITHUB}/blob/main/PLAYBOOK.md`}
              target="_blank"
              rel="noreferrer"
              className="transition-colors duration-fast hover:text-ink-200"
            >
              Playbook
            </a>
            <a
              href={`${GITHUB}/issues`}
              target="_blank"
              rel="noreferrer"
              className="transition-colors duration-fast hover:text-ink-200"
            >
              Support
            </a>
          </div>
        </div>
      </footer>

      <CommandPalette />
    </div>
  );
}
