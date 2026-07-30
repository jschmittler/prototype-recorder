/**
 * Hostinger entry point when the app root is the monorepo (not apps/web).
 * hPanel → Entry file: server.js
 * Prefer `npm run start` if available — this file is a fallback.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

const server = fileURLToPath(
  new URL("./apps/web/.next/standalone/apps/web/server.js", import.meta.url)
);

await import(server);
