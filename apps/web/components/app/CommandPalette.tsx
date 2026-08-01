"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRecentJobs } from "@/lib/recent-jobs";
import { journeyFor, hostLabel } from "@/lib/journey";

interface Command {
  id: string;
  label: string;
  /** Shown dimmed after the label, e.g. the section a page belongs to. */
  hint?: string;
  group: string;
  shortcut?: string;
  run: () => void;
}

/**
 * Universal command access (⌘K / Ctrl+K).
 *
 * Every entry navigates somewhere real — the three routes the product actually
 * has, plus the user's own recent jobs. Nothing here is a placeholder.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const { entries } = useRecentJobs();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    restoreFocus.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        restoreFocus.current = document.activeElement as HTMLElement;
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      setOpen(false);
      setQuery("");
    };

    const nav: Command[] = [
      { id: "home", label: "Home", hint: "Trailhead", group: "Go to", run: go("/") },
      { id: "create", label: "New walkthrough", hint: "Create", group: "Actions", shortcut: "C", run: go("/create") },
    ];

    const recents: Command[] = entries.flatMap((entry) => {
      if (entry.state !== "loaded") return [];
      const j = journeyFor(entry.job.status);
      return [
        {
          id: entry.id,
          label: entry.job.title?.trim() || hostLabel(entry.job.url),
          hint: `${j.stage} · ${j.plain}`,
          group: "Recent",
          run: go(`/jobs/${entry.id}`),
        },
      ];
    });

    return [...nav, ...recents];
  }, [entries, router]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.hint ?? ""} ${c.group}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Keep the highlighted row in view during keyboard traversal.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of results) {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    }
    return [...map.entries()];
  }, [results]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[active]?.run();
    }
  }

  if (!open) return null;

  let index = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        aria-label="Close command palette"
        onClick={close}
        className="absolute inset-0 cursor-default bg-ink-950/75 backdrop-blur-sm animate-fade-in"
      />

      <div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-panel animate-fade-rise"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-ink-800 px-4">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-ink-400">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages and recent walkthroughs…"
            aria-label="Search commands"
            className="w-full bg-transparent py-3.5 text-sm text-ink-100 outline-none placeholder:text-ink-500"
          />
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2" role="listbox" aria-label="Commands">
          {results.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-ink-400">
              Nothing matches “{query}”. Try a page name, or press{" "}
              <kbd className="kbd">Esc</kbd> to close.
            </p>
          )}

          {grouped.map(([group, items]) => (
            <div key={group} className="mb-1">
              <p className="label-tech px-4 pb-1 pt-2">{group}</p>
              {items.map((c) => {
                index += 1;
                const isActive = index === active;
                const myIndex = index;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive}
                    onMouseMove={() => setActive(myIndex)}
                    onClick={c.run}
                    className={
                      "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-fast " +
                      (isActive ? "bg-ink-800" : "hover:bg-ink-850")
                    }
                  >
                    <span className="truncate text-sm text-ink-100">{c.label}</span>
                    {c.hint && <span className="truncate text-xs text-ink-400">{c.hint}</span>}
                    {c.shortcut && <kbd className="kbd ml-auto shrink-0">{c.shortcut}</kbd>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend stays visible so the palette teaches its own keyboard model. */}
        <div className="flex items-center gap-4 border-t border-ink-800 px-4 py-2 text-[11px] text-ink-400">
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">↵</kbd> open
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">Esc</kbd> close
          </span>
          <span className="ml-auto font-mono tabular-nums">
            {results.length} result{results.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}
