import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Package root (contains package.json + bundled scripts/ and templates).
 * Used to locate assets that ship with the tool.
 */
export const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Working directory where run artifacts are written. This is the caller's CWD,
 * so a globally-installed CLI writes output/ into the user's project (not into
 * the installed package). When run via `npm run` in this repo, CWD is the repo
 * root, so behaviour is unchanged.
 */
export const WORK_DIR = process.cwd();

/** Default prototype URL used when nothing else is provided. */
export const DEFAULT_PROTOTYPE_URL = "https://pull-doll-48384505.figma.site/";

/**
 * Resolve the prototype URL. Precedence:
 *   1. PROTOTYPE_URL environment variable
 *   2. the URL declared in the script.md front-matter (passed here)
 *   3. the built-in default
 */
export function getPrototypeUrl(scriptUrl?: string): string {
  const fromEnv = process.env.PROTOTYPE_URL?.trim();
  if (fromEnv) return fromEnv;
  if (scriptUrl && scriptUrl.trim()) return scriptUrl.trim();
  return DEFAULT_PROTOTYPE_URL;
}

/** Turn a human name into a safe file slug. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "walkthrough"
  );
}

/** Compute per-script output paths from the script name (or explicit output). */
export function outputPathsFor(nameOrFile: string): { final: string; optimized: string } {
  const base = nameOrFile.endsWith(".webm") ? nameOrFile.replace(/\.webm$/i, "") : slugify(nameOrFile);
  return {
    final: path.join(OUTPUT_DIR, `${base}.webm`),
    optimized: path.join(OUTPUT_DIR, `${base}.vp9.webm`),
  };
}

/** Recorded viewport. The Figma Make prototype is designed for a wide desktop layout. */
export const VIEWPORT = { width: 1440, height: 900 } as const;

/** Reusable Playwright storage-state file for authenticated sessions (in CWD). */
export const STORAGE_STATE_PATH = path.join(WORK_DIR, "auth", "figma-storage-state.json");

/** Output locations (written into the caller's working directory). */
export const OUTPUT_DIR = path.join(WORK_DIR, "output");
export const TEST_RESULTS_DIR = path.join(WORK_DIR, "test-results");
export const VIDEO_DIR = path.join(OUTPUT_DIR, "raw-video");
export const FINAL_WEBM = path.join(OUTPUT_DIR, "autodesk-post-purchase-onboarding-walkthrough.webm");
export const OPTIMIZED_WEBM = path.join(OUTPUT_DIR, "autodesk-post-purchase-onboarding-walkthrough.vp9.webm");

/** Hosted pages need generous timeouts. */
export const NAV_TIMEOUT = 60_000;
export const ACTION_TIMEOUT = 20_000;
