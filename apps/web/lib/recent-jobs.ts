"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicJob } from "@ptw/job-contracts";

const KEY = "ft.recent.jobs";
const MAX = 12;

/**
 * Recent work is per-browser because the product has no accounts. Only job IDs
 * are stored; every card is hydrated from the live API so status and stage are
 * always real rather than a cached guess.
 */
function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    // Storage disabled or full: recents degrade to empty, nothing else breaks.
  }
}

export function rememberJob(id: string): void {
  if (typeof window === "undefined" || !id) return;
  writeIds([id, ...readIds().filter((existing) => existing !== id)]);
}

export function forgetJob(id: string): void {
  if (typeof window === "undefined") return;
  writeIds(readIds().filter((existing) => existing !== id));
}

export type RecentEntry =
  | { id: string; state: "loaded"; job: PublicJob }
  | { id: string; state: "gone" };

export interface RecentJobs {
  entries: RecentEntry[];
  loading: boolean;
  /** True once the client has read storage, so the server and first paint agree. */
  ready: boolean;
  remove: (id: string) => void;
}

/**
 * Loads recent jobs on mount. Returns `ready: false` for the first paint so the
 * server-rendered markup and the initial client render match — storage is not
 * available during SSR, and reading it during render would cause a mismatch.
 */
export function useRecentJobs(): RecentJobs {
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ids = readIds();
    setReady(true);

    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    (async () => {
      const settled = await Promise.all(
        ids.map(async (id): Promise<RecentEntry> => {
          try {
            const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { cache: "no-store" });
            if (!res.ok) return { id, state: "gone" };
            const job = (await res.json()) as PublicJob;
            return { id, state: "loaded", job };
          } catch {
            return { id, state: "gone" };
          }
        })
      );
      if (cancelled) return;
      setEntries(settled);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const remove = useCallback((id: string) => {
    forgetJob(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { entries, loading, ready, remove };
}
