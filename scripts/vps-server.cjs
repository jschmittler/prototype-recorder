/**
 * Production entry for a single VPS (full monorepo + real recorder).
 * PM2: script = scripts/vps-server.cjs, cwd = repo root.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const webRoot = path.join(root, "apps/web");
const buildId = path.join(webRoot, ".next/BUILD_ID");

/** Load repo-root .env when PM2 env_file is unavailable (simple KEY=VALUE parser). */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(root, ".env"));

const deployVersionFile = path.join(root, ".deploy-version");
if (!process.env.APP_VERSION && fs.existsSync(deployVersionFile)) {
  process.env.APP_VERSION = fs.readFileSync(deployVersionFile, "utf8").trim();
}

if (!fs.existsSync(buildId)) {
  console.error("[vps] Missing production build. Run: npm run build:vps");
  process.exit(1);
}

if (!process.env.ENGINE_DIR) {
  process.env.ENGINE_DIR = path.join(root, "packages/recorder-cli");
}

if (!process.env.STORAGE_DIR) {
  process.env.STORAGE_DIR = path.join(root, "storage");
}

process.env.NODE_ENV = "production";

const currentPort = parseInt(process.env.PORT, 10) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";

const reqFilesPath = path.join(webRoot, ".next/required-server-files.json");
let config;
if (fs.existsSync(reqFilesPath)) {
  config = JSON.parse(fs.readFileSync(reqFilesPath, "utf8")).config;
  if (config?.output === "standalone") {
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
  }
}

console.log(`[vps] webRoot=${webRoot}`);
console.log(`[vps] APP_VERSION=${process.env.APP_VERSION ?? "unknown"}`);
console.log(`[vps] ENGINE_DIR=${process.env.ENGINE_DIR}`);
console.log(`[vps] EXECUTOR=${process.env.EXECUTOR ?? "fake"}`);
console.log(`[vps] PORT=${currentPort}`);

require("next");
const { startServer } = require("next/dist/server/lib/start-server");

startServer({
  dir: webRoot,
  isDev: false,
  config,
  hostname,
  port: currentPort,
  allowRetry: false,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
