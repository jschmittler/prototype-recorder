/**
 * Hostinger entry file (CommonJS — lsnode loads this via require()).
 * hPanel → Entry file: server.cjs  |  Output directory: .
 */
const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = __dirname;

function log(msg) {
  console.log(`[ptw-start] ${msg}`);
}

const port = String(process.env.PORT || "3000");
process.env.PORT = port;
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const webRoot = path.join(root, "apps/web");
const buildIdPath = path.join(webRoot, ".next/BUILD_ID");

log(`root=${root}`);
log(`webRoot=${webRoot}`);
log(`PORT=${port} HOSTNAME=${process.env.HOSTNAME} NODE_ENV=${process.env.NODE_ENV}`);

if (!existsSync(path.join(webRoot, "package.json"))) {
  log("ERROR: apps/web not found — set Root directory to repo root (./).");
  process.exit(1);
}

if (!existsSync(buildIdPath)) {
  log(`ERROR: Production build missing (${buildIdPath}). Run npm run build first.`);
  process.exit(1);
}

const nextBinCandidates = [
  path.join(webRoot, "node_modules/next/dist/bin/next"),
  path.join(root, "node_modules/next/dist/bin/next"),
];

const nextBin = nextBinCandidates.find(existsSync);
if (!nextBin) {
  log("ERROR: next binary not found in node_modules.");
  process.exit(1);
}

log(`Starting Next.js via ${nextBin} (cwd=${webRoot})`);

const child = spawn(process.execPath, [nextBin, "start", "-H", process.env.HOSTNAME, "-p", port], {
  cwd: webRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("error", (err) => {
  log(`ERROR: failed to spawn next start — ${err.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (code !== 0) {
    log(`next start exited with code=${code ?? "null"} signal=${signal ?? "null"}`);
  }
  process.exit(code ?? 1);
});
