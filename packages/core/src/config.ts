/** Core runtime config + tiny logger. Adapter selection reads process.env. */
import os from "node:os";
import path from "node:path";

export const STORAGE_DIR = process.env.STORAGE_DIR || path.join(os.tmpdir(), "ptw-storage");
export const WORKDIR_ROOT = process.env.WORKDIR_ROOT || path.join(os.tmpdir(), "ptw-jobs");

export const ALLOWED_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
];

export const RETENTION_HOURS = Number(process.env.JOB_RETENTION_HOURS || 72);
export const LOG_TAIL_MAX = 200;

export function log(scope: string, msg: string): void {
  console.log(`[core:${scope}] ${msg}`);
}
